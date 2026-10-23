import { Product, NotificationItem, StockStatusType, Warehouse, StockBalance, SystemUser } from '../types';
import { calculateStockStatus } from '../utils/inventoryUtils';
import { notificationService } from './notificationService';

interface AlertStateItem {
  status: StockStatusType;
  lastStock: number;
  lastLimit: number | null;
  lastNotifiedAt: number;
}

const STORAGE_PREFIX = 'erp_stock_alert_state_';

import { getAppStorage } from '../utils/storageUtils';

export const stockAlertService = {
  /**
   * Evaluates stock levels per warehouse against product minimum thresholds.
   * Dispatches targeted notifications ONLY to the assigned Warehouse Manager(s).
   * - Sales Persons, cashiers, and unrelated managers never receive alerts.
   * - Restocking auto-resolves alerts.
   * - Repeated checks prevent duplicate notifications.
   */
  async checkProductsStockAlerts(
    products: Product[],
    companyId: string,
    warehouses: Warehouse[] = [],
    stockBalances: StockBalance[] = [],
    users: SystemUser[] = [],
    currentUserId?: string,
    currentUserRole?: string
  ): Promise<NotificationItem[]> {
    if (!products || products.length === 0 || !companyId) return [];

    const existing = await notificationService.getNotifications(companyId);
    const newItems: NotificationItem[] = [];

    await this.checkAndTriggerStockAlerts({
      products,
      companyId,
      warehouses,
      stockBalances,
      users,
      existingNotifications: existing || [],
      createNotification: async (notif, cId) => {
        const item = await notificationService.createNotification(notif, cId || companyId);
        newItems.push(item);
        return item;
      },
      markAsRead: async id => {
        await notificationService.markAsRead(id, companyId);
      },
      onNewNotification: item => {
        if (!newItems.some(n => n.id === item.id)) {
          newItems.push(item);
        }
      }
    });

    // Return only items authorized for current user
    // - Owner and Admin receive administrative alerts (e.g. Missing Warehouse Manager Assignment)
    // - Purchase Managers receive stock alerts across all warehouses for replenishment action
    // - Warehouse Managers receive stock alerts strictly for their assigned warehouse(s)
    // - Salespersons, cashiers, and unrelated staff receive 0 stock alerts
    if (currentUserRole === 'Salesperson' || currentUserRole === 'Cashier') {
      return [];
    }

    if (currentUserId) {
      return newItems.filter(item => {
        if (item.title === 'Missing Warehouse Manager Assignment') {
          return currentUserRole === 'Owner' || currentUserRole === 'Admin';
        }
        if (currentUserRole === 'Purchase Manager') {
          return item.type === 'limited_stock' || item.type === 'out_of_stock' || item.type === 'low_stock';
        }
        if (currentUserRole === 'Warehouse Manager') {
          return (item.type === 'limited_stock' || item.type === 'out_of_stock' || item.type === 'low_stock') && item.userId === currentUserId;
        }
        if (currentUserRole === 'Owner' || currentUserRole === 'Admin') {
          return item.type === 'system';
        }
        return false;
      });
    }
    return newItems;
  },

  /**
   * Loads persisted alert history for a company
   */
  getAlertState(companyId: string): Record<string, AlertStateItem> {
    const storage = getAppStorage();
    if (!storage) return {};
    try {
      const raw = storage.getItem(`${STORAGE_PREFIX}${companyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Persists alert history for a company
   */
  saveAlertState(companyId: string, state: Record<string, AlertStateItem>): void {
    const storage = getAppStorage();
    if (!storage) return;
    try {
      storage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save stock alert state:', e);
    }
  },

  /**
   * Evaluates products across warehouses and dispatches alerts strictly to authorized managers.
   */
  async checkAndTriggerStockAlerts(options: {
    products: Product[];
    companyId: string;
    warehouses?: Warehouse[];
    stockBalances?: StockBalance[];
    users?: SystemUser[];
    existingNotifications: NotificationItem[];
    createNotification: (
      notif: {
        title: string;
        message: string;
        type: string;
        link?: string;
        userId?: string | null;
        warehouseId?: string | null;
        productId?: string | null;
        warehouseName?: string;
      },
      companyId?: string
    ) => Promise<NotificationItem>;
    markAsRead: (id: string) => Promise<void>;
    onNewNotification?: (notif: NotificationItem) => void;
    onResolveNotifications?: (notificationIds: string[]) => void;
  }): Promise<void> {
    const {
      products,
      companyId,
      warehouses = [],
      stockBalances = [],
      users = [],
      existingNotifications,
      createNotification,
      markAsRead,
      onNewNotification,
      onResolveNotifications
    } = options;

    if (!products || products.length === 0) return;

    const alertState = this.getAlertState(companyId);
    let stateChanged = false;
    const resolvedIds: string[] = [];

    // Fallback warehouse if none defined
    const activeWarehouses = warehouses.length > 0
      ? warehouses.filter(w => w.isActive ?? true)
      : [{
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Main Warehouse',
          code: 'MAIN',
          address: '',
          isActive: true
        }];

    for (const w of activeWarehouses) {
      // 1. Identify authorized Warehouse Managers for warehouse w
      const targetManagerIds: string[] = Array.from(new Set([
        ...(w.managerIds || []),
        ...(w.managerId ? [w.managerId] : [])
      ])).filter(Boolean);

      // Safe Fallback Policy: If no manager is explicitly assigned to this warehouse,
      // CRITICAL RULE: NEVER broadcast stock alerts to company users or staff!
      // Group all affected products (e.g. cement, paint) into a SINGLE administrative system alert for Admins/Owners.
      if (targetManagerIds.length === 0) {
        const affectedProducts: Product[] = [];
        for (const p of products) {
          if (p.reorderLevel === null || p.reorderLevel === undefined) continue;

          let whStock = 0;
          const matchingBalance = stockBalances.find(b => b.warehouseId === w.id && b.productId === p.id);
          if (matchingBalance !== undefined) {
            whStock = Number(matchingBalance.quantity);
          } else if (activeWarehouses.length <= 1) {
            whStock = Number(p.currentStock || 0);
          }

          const currentStatus = calculateStockStatus(whStock, p.reorderLevel);
          if (currentStatus === 'Out of Stock' || currentStatus === 'Limited Stock') {
            affectedProducts.push(p);
          }
        }

        if (affectedProducts.length > 0) {
          const productListStr = affectedProducts.map(p => p.sku ? `${p.name} (SKU: ${p.sku})` : p.name).join(', ');
          const missingAlertExists = existingNotifications.some(
            n => !n.read && n.type === 'system' && n.warehouseId === w.id && n.title === 'Missing Warehouse Manager Assignment'
          );

          if (!missingAlertExists) {
            try {
              const missingNotif = await createNotification(
                {
                  title: 'Missing Warehouse Manager Assignment',
                  message: `Warehouse "${w.name}" has stock alerts for ${productListStr}, but no Warehouse Manager is assigned. Please assign a Warehouse Manager.`,
                  type: 'system',
                  link: '/warehouses',
                  warehouseId: w.id,
                  warehouseName: w.name
                },
                companyId
              );
              onNewNotification?.(missingNotif);
            } catch (err) {
              console.error('Failed to record missing manager notification:', err);
            }
          }
        }
        continue;
      } else {
        // Warehouse has assigned manager(s) -> auto-resolve any pending "Missing Warehouse Manager Assignment" alerts
        try {
          await notificationService.resolveMissingWarehouseManagerAlert(w.id, companyId);
        } catch (e) {
          console.warn('Failed to auto-resolve missing manager alert:', e);
        }
      }

      for (const p of products) {
        // Skip products without a configured minimum stock limit
        if (p.reorderLevel === null || p.reorderLevel === undefined) {
          continue;
        }

        // Determine stock in this specific warehouse
        let whStock = 0;
        const matchingBalance = stockBalances.find(
          b => b.warehouseId === w.id && b.productId === p.id
        );

        if (matchingBalance !== undefined) {
          whStock = Number(matchingBalance.quantity);
        } else if (activeWarehouses.length <= 1) {
          whStock = Number(p.currentStock || 0);
        } else {
          whStock = 0;
        }

        const currentStatus = calculateStockStatus(whStock, p.reorderLevel);
        const stateKey = `${w.id}:${p.id}`;
        const prevRecord = alertState[stateKey];
        const prevStatus = prevRecord ? prevRecord.status : null;
        const unit = p.primaryUnit || 'Piece';
        const skuLabel = p.sku ? `(SKU: ${p.sku}) ` : '';

        // ---------------------------------------------------------------------
        // 1. LIMITED STOCK TRANSITION (0 < whStock <= reorderLevel)
        // ---------------------------------------------------------------------
        if (currentStatus === 'Limited Stock') {
          if (prevStatus !== 'Limited Stock') {
            const message = `Limited Stock: ${p.name} ${skuLabel}in Warehouse "${w.name}". Current available quantity: ${whStock} ${unit}. Minimum threshold: ${p.reorderLevel} ${unit}.`;

            // Deliver notification strictly to assigned manager(s)
            for (const managerId of targetManagerIds) {
              const duplicateExists = existingNotifications.some(
                n =>
                  !n.read &&
                  (n.type === 'limited_stock' || n.type === 'low_stock') &&
                  (n.productId === p.id || n.title.includes(p.name)) &&
                  (n.warehouseId === w.id || n.message.includes(w.name)) &&
                  n.userId === managerId
              );

              if (!duplicateExists) {
                try {
                  const newNotif = await createNotification(
                    {
                      title: `Limited Stock: ${p.name}`,
                      message,
                      type: 'limited_stock',
                      link: `/products?search=${encodeURIComponent(p.sku || p.name)}`,
                      userId: managerId,
                      warehouseId: w.id,
                      productId: p.id,
                      warehouseName: w.name
                    },
                    companyId
                  );
                  onNewNotification?.(newNotif);
                } catch (err) {
                  console.error(`Failed to trigger Limited Stock notification for ${p.name}:`, err);
                }
              }
            }

            alertState[stateKey] = {
              status: 'Limited Stock',
              lastStock: whStock,
              lastLimit: p.reorderLevel,
              lastNotifiedAt: Date.now()
            };
            stateChanged = true;
          } else {
            if (prevRecord.lastStock !== whStock || prevRecord.lastLimit !== p.reorderLevel) {
              alertState[stateKey] = {
                ...prevRecord,
                lastStock: whStock,
                lastLimit: p.reorderLevel
              };
              stateChanged = true;
            }
          }
        }

        // ---------------------------------------------------------------------
        // 2. OUT OF STOCK TRANSITION (whStock <= 0)
        // ---------------------------------------------------------------------
        else if (currentStatus === 'Out of Stock') {
          if (prevStatus !== 'Out of Stock') {
            const message = `Out of Stock: ${p.name} ${skuLabel}in Warehouse "${w.name}". Available quantity: 0 ${unit}. Minimum threshold: ${p.reorderLevel} ${unit}.`;

            for (const managerId of targetManagerIds) {
              const duplicateExists = existingNotifications.some(
                n =>
                  !n.read &&
                  n.type === 'out_of_stock' &&
                  (n.productId === p.id || n.title.includes(p.name)) &&
                  (n.warehouseId === w.id || n.message.includes(w.name)) &&
                  n.userId === managerId
              );

              if (!duplicateExists) {
                try {
                  const newNotif = await createNotification(
                    {
                      title: `Out of Stock: ${p.name}`,
                      message,
                      type: 'out_of_stock',
                      link: `/products?search=${encodeURIComponent(p.sku || p.name)}`,
                      userId: managerId,
                      warehouseId: w.id,
                      productId: p.id,
                      warehouseName: w.name
                    },
                    companyId
                  );
                  onNewNotification?.(newNotif);
                } catch (err) {
                  console.error(`Failed to trigger Out of Stock notification for ${p.name}:`, err);
                }
              }
            }

            alertState[stateKey] = {
              status: 'Out of Stock',
              lastStock: whStock,
              lastLimit: p.reorderLevel,
              lastNotifiedAt: Date.now()
            };
            stateChanged = true;
          } else {
            if (prevRecord.lastStock !== whStock) {
              alertState[stateKey] = {
                ...prevRecord,
                lastStock: whStock
              };
              stateChanged = true;
            }
          }
        }

        // ---------------------------------------------------------------------
        // 3. REPLENISHED BACK TO ACTIVE
        // ---------------------------------------------------------------------
        else if (currentStatus === 'Active') {
          if (prevStatus === 'Limited Stock' || prevStatus === 'Out of Stock') {
            // Product was replenished above threshold in this warehouse!
            // Auto-resolve unread alerts for this product & warehouse
            const activeAlerts = existingNotifications.filter(
              n =>
                !n.read &&
                (n.productId === p.id || n.title.includes(p.name) || n.message.includes(p.name)) &&
                (n.warehouseId === w.id || n.message.includes(w.name)) &&
                (n.type === 'low_stock' || n.type === 'limited_stock' || n.type === 'out_of_stock')
            );

            for (const alert of activeAlerts) {
              try {
                await markAsRead(alert.id);
                resolvedIds.push(alert.id);
              } catch {}
            }
          }

          if (prevStatus !== 'Active' || prevRecord?.lastStock !== whStock || prevRecord?.lastLimit !== p.reorderLevel) {
            alertState[stateKey] = {
              status: 'Active',
              lastStock: whStock,
              lastLimit: p.reorderLevel,
              lastNotifiedAt: Date.now()
            };
            stateChanged = true;
          }
        }
      }
    }

    if (resolvedIds.length > 0) {
      onResolveNotifications?.(resolvedIds);
    }

    if (stateChanged) {
      this.saveAlertState(companyId, alertState);
    }
  }
};
