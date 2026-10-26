import {
  Product,
  NotificationItem,
  StockStatusType,
  Warehouse,
  StockBalance,
  SystemUser,
  Batch,
  CompanyProfile,
  CustomerSupportPriority
} from '../types';
import { calculateStockStatus } from '../utils/inventoryUtils';
import { notificationService } from './notificationService';
import { getAppStorage } from '../utils/storageUtils';

interface AlertStateItem {
  status: StockStatusType;
  lastStock: number;
  lastLimit: number | null;
  lastNotifiedAt: number;
}

const STORAGE_PREFIX = 'erp_stock_alert_state_';

export interface BusinessDayConfig {
  timezone: string;
  closingTime: string; // e.g. "18:00"
  closingHour: number;
  closingMinute: number;
  currentBusinessDate: string; // "YYYY-MM-DD"
  isAfterClosingTime: boolean;
}

/**
 * Derives business day closing time and current business date using the company's
 * configured timezone and closing time. Never hardcodes an arbitrary time.
 */
export function getBusinessDayConfig(company?: Partial<CompanyProfile> | null): BusinessDayConfig {
  const timezone =
    (company as any)?.timezone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata') ||
    'Asia/Kolkata';

  const rawClosing =
    (company as any)?.closingTime ||
    (company as any)?.businessClosingTime ||
    '18:00';

  const [hStr, mStr] = String(rawClosing).split(':');
  const closingHour = parseInt(hStr || '18', 10);
  const closingMinute = parseInt(mStr || '0', 10);

  // Extract current date and time in the configured timezone
  const now = new Date();
  let currentBusinessDate = now.toISOString().split('T')[0];
  let hour = now.getHours();
  let minute = now.getMinutes();

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const findPart = (t: string) => parts.find(p => p.type === t)?.value;
    const y = findPart('year');
    const m = findPart('month');
    const d = findPart('day');
    const h = findPart('hour');
    const min = findPart('minute');
    if (y && m && d) currentBusinessDate = `${y}-${m}-${d}`;
    if (h) hour = parseInt(h, 10);
    if (min) minute = parseInt(min, 10);
  } catch {}

  const isAfterClosingTime = hour > closingHour || (hour === closingHour && minute >= closingMinute);

  return {
    timezone,
    closingTime: rawClosing,
    closingHour,
    closingMinute,
    currentBusinessDate,
    isAfterClosingTime
  };
}

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
          return (
            (item.type === 'limited_stock' ||
              item.type === 'out_of_stock' ||
              item.type === 'low_stock' ||
              item.type === 'expiring_batch' ||
              item.type === 'expiring_batches' ||
              item.type === 'eod_expiry') &&
            item.userId === currentUserId
          );
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
   * Enforces Out of Stock Alert and Limited Stock Alert rules:
   * 1. Out of Stock Alert:
   *    - Title: Out of Stock Alert
   *    - Message: Cement (SKU: BUI-CEM-00001) is out of stock in Main Central Warehouse.
   *    - Priority: Critical
   *    - Action: View Product
   * 2. Limited Stock Alert:
   *    - Title: Limited Stock Alert
   *    - Message: Paint (SKU: PAI-PAI-00005) has 8 Piece remaining in Main Central Warehouse. Warning limit: 10 Piece.
   *    - Priority: High
   *    - Action: View Product
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
        priority?: CustomerSupportPriority;
        actionText?: string;
        dedupKey?: string;
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
    const activeWarehouses =
      warehouses.length > 0
        ? warehouses.filter(w => w.isActive ?? true)
        : [
            {
              id: '00000000-0000-0000-0000-000000000002',
              name: 'Main Central Warehouse',
              code: 'MAIN',
              address: '',
              isActive: true
            }
          ];

    for (const w of activeWarehouses) {
      // Identify authorized Warehouse Managers for warehouse w
      const targetManagerIds: string[] = Array.from(
        new Set([...(w.managerIds || []), ...(w.managerId ? [w.managerId] : [])])
      ).filter(Boolean);

      // Safe Fallback Policy: If no manager is explicitly assigned to this warehouse,
      // notify authorized administrator with a single administrative alert
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
          const productListStr = affectedProducts
            .map(p => (p.sku ? `${p.name} (SKU: ${p.sku})` : p.name))
            .join(', ');
          const missingAlertExists = existingNotifications.some(
            n =>
              !n.read &&
              n.type === 'system' &&
              n.warehouseId === w.id &&
              n.title === 'Missing Warehouse Manager Assignment'
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
                  warehouseName: w.name,
                  priority: 'High',
                  actionText: 'View Warehouses',
                  dedupKey: `missing_manager_${w.id}`
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
        const productSkuStr = p.sku ? ` (SKU: ${p.sku})` : '';

        // ---------------------------------------------------------------------
        // 1. OUT OF STOCK TRANSITION (whStock <= 0)
        // Rule: Trigger when available stock changes from above zero to zero.
        // Title: Out of Stock Alert
        // Message: Cement (SKU: BUI-CEM-00001) is out of stock in Main Central Warehouse.
        // Priority: Critical
        // Action: View Product
        // ---------------------------------------------------------------------
        if (currentStatus === 'Out of Stock') {
          if (prevStatus !== 'Out of Stock') {
            const outOfStockMessage = `${p.name}${productSkuStr} is out of stock in ${w.name}.`;

            for (const managerId of targetManagerIds) {
              const dedupKey = `out_of_stock_${w.id}_${p.id}_${managerId}`;
              const duplicateExists = existingNotifications.some(
                n =>
                  !n.read &&
                  n.type === 'out_of_stock' &&
                  (n.dedupKey === dedupKey ||
                    ((n.productId === p.id || n.title.includes(p.name)) &&
                      (n.warehouseId === w.id || n.message.includes(w.name)) &&
                      n.userId === managerId))
              );

              if (!duplicateExists) {
                try {
                  const newNotif = await createNotification(
                    {
                      title: 'Out of Stock Alert',
                      message: outOfStockMessage,
                      type: 'out_of_stock',
                      link: `/products?search=${encodeURIComponent(p.sku || p.name)}`,
                      userId: managerId,
                      warehouseId: w.id,
                      productId: p.id,
                      warehouseName: w.name,
                      priority: 'Critical',
                      actionText: 'View Product',
                      dedupKey
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
        // 2. LIMITED STOCK TRANSITION (0 < whStock <= reorderLevel)
        // Rule: Trigger when stock reaches or falls below warning limit, provided stock > 0.
        // Do not classify zero stock as limited stock.
        // Title: Limited Stock Alert
        // Message: Paint (SKU: PAI-PAI-00005) has 8 Piece remaining in Main Central Warehouse. Warning limit: 10 Piece.
        // Priority: High
        // Action: View Product
        // ---------------------------------------------------------------------
        else if (currentStatus === 'Limited Stock') {
          if (prevStatus !== 'Limited Stock') {
            const limitedStockMessage = `${p.name}${productSkuStr} has ${whStock} ${unit} remaining in ${w.name}. Warning limit: ${p.reorderLevel} ${unit}.`;

            for (const managerId of targetManagerIds) {
              const dedupKey = `limited_stock_${w.id}_${p.id}_${managerId}`;
              const duplicateExists = existingNotifications.some(
                n =>
                  !n.read &&
                  (n.type === 'limited_stock' || n.type === 'low_stock') &&
                  (n.dedupKey === dedupKey ||
                    ((n.productId === p.id || n.title.includes(p.name)) &&
                      (n.warehouseId === w.id || n.message.includes(w.name)) &&
                      n.userId === managerId))
              );

              if (!duplicateExists) {
                try {
                  const newNotif = await createNotification(
                    {
                      title: 'Limited Stock Alert',
                      message: limitedStockMessage,
                      type: 'limited_stock',
                      link: `/products?search=${encodeURIComponent(p.sku || p.name)}`,
                      userId: managerId,
                      warehouseId: w.id,
                      productId: p.id,
                      warehouseName: w.name,
                      priority: 'High',
                      actionText: 'View Product',
                      dedupKey
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
        // 3. REPLENISHED BACK TO ACTIVE (whStock > reorderLevel)
        // When stock recovers above threshold, auto-resolve previous stock alerts
        // and reset state to Active so future drops can notify again.
        // ---------------------------------------------------------------------
        else if (currentStatus === 'Active') {
          if (prevStatus === 'Limited Stock' || prevStatus === 'Out of Stock') {
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

          if (
            prevStatus !== 'Active' ||
            prevRecord?.lastStock !== whStock ||
            prevRecord?.lastLimit !== p.reorderLevel
          ) {
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
  },

  /**
   * Evaluates product batches approaching their expiration date (starting 30 days before expiry).
   * Title: Product Expiring Soon
   * Message: Medicine Antiseptic Cream, Batch [actual batch number], expires on [actual expiry date]. Please review the remaining stock.
   * Priority: High
   * Action: View Batch & Expiry Management
   */
  async checkBatchExpiryAlerts(options: {
    batches: Batch[];
    companyId: string;
    warehouses?: Warehouse[];
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
        priority?: CustomerSupportPriority;
        actionText?: string;
        dedupKey?: string;
      },
      companyId?: string
    ) => Promise<NotificationItem>;
    onNewNotification?: (notif: NotificationItem) => void;
  }): Promise<NotificationItem[]> {
    const {
      batches,
      companyId,
      warehouses = [],
      existingNotifications,
      createNotification,
      onNewNotification
    } = options;

    if (!batches || batches.length === 0) return [];

    const newAlerts: NotificationItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeWarehouses =
      warehouses.length > 0
        ? warehouses.filter(w => w.isActive ?? true)
        : [
            {
              id: '00000000-0000-0000-0000-000000000002',
              name: 'Main Central Warehouse',
              code: 'MAIN',
              address: '',
              isActive: true
            }
          ];

    for (const batch of batches) {
      if (!batch.expiryDate || (Number(batch.qty) || 0) <= 0) {
        continue;
      }

      const expDate = new Date(batch.expiryDate);
      if (isNaN(expDate.getTime())) continue;
      expDate.setHours(0, 0, 0, 0);

      // Rule: Do not alert for batches that have already expired as if they were merely approaching expiry
      if (expDate < today) {
        continue;
      }

      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Rule: Trigger when batch enters 30-day window
      if (diffDays >= 0 && diffDays <= 30) {
        // Resolve target warehouse
        const matchingWarehouse =
          activeWarehouses.find(w => w.id === batch.warehouseId) ||
          activeWarehouses[0];

        const targetManagerIds: string[] = Array.from(
          new Set([
            ...(matchingWarehouse?.managerIds || []),
            ...(matchingWarehouse?.managerId ? [matchingWarehouse.managerId] : [])
          ])
        ).filter(Boolean);

        const recipients = targetManagerIds.length > 0 ? targetManagerIds : [null];

        for (const managerId of recipients) {
          // Dedup key includes batch ID and expiry date:
          // Rule: If the expiry date is changed, recalculate the alert timing using updated date
          const dedupKey = `batch_expiry_30d_${batch.id}_${batch.expiryDate}_${managerId || 'admin'}`;

          const duplicateExists = existingNotifications.some(
            n =>
              !n.read &&
              n.type === 'expiring_batch' &&
              (n.dedupKey === dedupKey ||
                (n.title === 'Product Expiring Soon' &&
                  n.message.includes(batch.batchNumber) &&
                  n.message.includes(batch.expiryDate) &&
                  n.userId === (managerId || null)))
          );

          if (!duplicateExists) {
            try {
              const newNotif = await createNotification(
                {
                  title: 'Product Expiring Soon',
                  message: `${batch.productName}, Batch ${batch.batchNumber}, expires on ${batch.expiryDate}. Please review the remaining stock.`,
                  type: 'expiring_batch',
                  link: `/inventory/batches?search=${encodeURIComponent(batch.batchNumber || batch.productName)}`,
                  userId: managerId,
                  warehouseId: matchingWarehouse?.id || null,
                  productId: batch.productId,
                  warehouseName: matchingWarehouse?.name,
                  priority: 'High',
                  actionText: 'View Batch & Expiry Management',
                  dedupKey
                },
                companyId
              );
              newAlerts.push(newNotif);
              onNewNotification?.(newNotif);
            } catch (err) {
              console.error(`Failed to trigger 30-day batch expiry alert for ${batch.batchNumber}:`, err);
            }
          }
        }
      }
    }

    return newAlerts;
  },

  /**
   * End-of-Day Expiry Reminder
   * At the end of each business day, checks for batches that are already in their 30-day
   * expiry-warning window and sends a daily reminder to the responsible Warehouse Manager.
   * - Title: End-of-Day Expiry Reminder
   * - Message: 3 batches across your assigned warehouses are approaching expiry. Review the batch list before closing for the day.
   * - Priority: High
   * - Action: View Expiring Batches
   * - Send at most one end-of-day reminder per Warehouse Manager per business date.
   * - Do not send if count === 0.
   */
  async checkEndOfDayExpiryReminder(options: {
    batches: Batch[];
    companyId: string;
    company?: Partial<CompanyProfile> | null;
    warehouses?: Warehouse[];
    users?: SystemUser[];
    currentUserId?: string;
    currentUserRole?: string;
    forceDate?: string;
    forceCheck?: boolean;
    existingNotifications: NotificationItem[];
    createNotification: (
      notif: {
        title: string;
        message: string;
        type: string;
        link?: string;
        userId?: string | null;
        warehouseId?: string | null;
        priority?: CustomerSupportPriority;
        actionText?: string;
        dedupKey?: string;
      },
      companyId?: string
    ) => Promise<NotificationItem>;
    onNewNotification?: (notif: NotificationItem) => void;
  }): Promise<NotificationItem[]> {
    const {
      batches,
      companyId,
      company,
      warehouses = [],
      forceDate,
      forceCheck,
      existingNotifications,
      createNotification,
      onNewNotification
    } = options;

    if (!batches || batches.length === 0) return [];

    // Derive closing time and business date from company configuration
    const bConfig = getBusinessDayConfig(company);
    const businessDate = forceDate || bConfig.currentBusinessDate;

    // Run only if current time is at or after closing time, unless forced (for tests / CLI scheduler)
    if (!forceCheck && !bConfig.isAfterClosingTime) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Identify all batches in the 30-day warning window that are not yet expired
    const warningBatches = batches.filter(b => {
      if (!b.expiryDate || (Number(b.qty) || 0) <= 0) return false;
      const expDate = new Date(b.expiryDate);
      if (isNaN(expDate.getTime())) return false;
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) return false; // Already expired
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });

    // Rule: Do not send a reminder if there are no batches in the warning window
    if (warningBatches.length === 0) {
      return [];
    }

    const activeWarehouses =
      warehouses.length > 0
        ? warehouses.filter(w => w.isActive ?? true)
        : [
            {
              id: '00000000-0000-0000-0000-000000000002',
              name: 'Main Central Warehouse',
              code: 'MAIN',
              address: '',
              isActive: true
            }
          ];

    // Collect batches by manager across their assigned warehouses
    const managerBatchesMap = new Map<string, Batch[]>();

    for (const b of warningBatches) {
      const targetWh =
        activeWarehouses.find(w => w.id === b.warehouseId) || activeWarehouses[0];
      const targetManagerIds: string[] = Array.from(
        new Set([
          ...(targetWh?.managerIds || []),
          ...(targetWh?.managerId ? [targetWh.managerId] : [])
        ])
      ).filter(Boolean);

      if (targetManagerIds.length === 0) {
        // Fallback: unassigned manager bucket
        const list = managerBatchesMap.get('unassigned_admin') || [];
        list.push(b);
        managerBatchesMap.set('unassigned_admin', list);
      } else {
        for (const mId of targetManagerIds) {
          const list = managerBatchesMap.get(mId) || [];
          list.push(b);
          managerBatchesMap.set(mId, list);
        }
      }
    }

    const newReminders: NotificationItem[] = [];

    for (const [managerKey, managerBatches] of managerBatchesMap.entries()) {
      const count = managerBatches.length;
      if (count === 0) continue;

      const isUnassigned = managerKey === 'unassigned_admin';
      const targetUserId = isUnassigned ? null : managerKey;
      const dedupKey = `eod_expiry_${managerKey}_${businessDate}`;

      // Rule: Send at most one end-of-day reminder per Warehouse Manager per business date, even if the scheduler retries
      const alreadySent = existingNotifications.some(
        n =>
          n.type === 'expiring_batches' &&
          (n.dedupKey === dedupKey ||
            (n.title === 'End-of-Day Expiry Reminder' &&
              n.userId === targetUserId &&
              n.createdAt?.startsWith(businessDate)))
      );

      if (alreadySent) continue;

      const batchWord = count === 1 ? 'batch' : 'batches';
      const verbWord = count === 1 ? 'is' : 'are';
      const message = `${count} ${batchWord} across your assigned warehouses ${verbWord} approaching expiry. Review the batch list before closing for the day.`;

      try {
        const notif = await createNotification(
          {
            title: 'End-of-Day Expiry Reminder',
            message,
            type: 'expiring_batches',
            link: '/inventory/batches',
            userId: targetUserId,
            priority: 'High',
            actionText: 'View Expiring Batches',
            dedupKey
          },
          companyId
        );
        newReminders.push(notif);
        onNewNotification?.(notif);
      } catch (err) {
        console.error(`Failed to trigger EOD reminder for manager ${managerKey}:`, err);
      }
    }

    return newReminders;
  }
};
