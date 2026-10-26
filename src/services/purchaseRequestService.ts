import { assertCallerPermission, getActiveUserRole, hasPermission } from '../utils/rbac';
import { supabase } from '../lib/supabase';
import {
  PurchaseRequest,
  PurchaseRequestHistory,
  PurchaseRequestStatus,
  PurchaseRequestPriority,
  CreatePurchaseRequestInput,
  CustomerSupportPriority
} from '../types';
import { getAppStorage } from '../utils/storageUtils';
import { notificationService } from './notificationService';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../utils/schemaDetector';

const STORAGE_KEY = (cId: string) => `universal_billing_purchase_requests_${cId}`;

export const purchaseRequestService = {
  /**
   * Retrieves all purchase requests for a company with item details and history
   */
  async getPurchaseRequests(
    params?: {
      status?: string;
      warehouseId?: string;
      priority?: string;
      search?: string;
    },
    companyId?: string,
    userRole?: string,
    userId?: string
  ): Promise<PurchaseRequest[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let requests: PurchaseRequest[] = [];

    // Helper maps to enrich requester and product information
    const profileMap = new Map<string, { full_name?: string; email?: string; role?: string }>();
    const productMap = new Map<string, { name: string; sku?: string; primary_unit?: string }>();

    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        // Fetch profiles for the company to resolve actual requester names and roles
        try {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('company_id', finalCompanyId);
          if (pData) {
            pData.forEach((p: any) => {
              profileMap.set(p.id, p);
              if (p.email) profileMap.set(p.email.toLowerCase(), p);
            });
          }
        } catch {}

        // Fetch products for the company to ensure accurate name, SKU, and unit mapping
        try {
          const { data: prData } = await supabase
            .from('products')
            .select('id, name, sku, primary_unit')
            .eq('company_id', finalCompanyId);
          if (prData) {
            prData.forEach((p: any) => {
              productMap.set(p.id, p);
            });
          }
        } catch {}

        let query = supabase
          .from('purchase_requests')
          .select(`
            *,
            purchase_request_items (*),
            purchase_request_history (*)
          `)
          .eq('company_id', finalCompanyId)
          .order('created_at', { ascending: false });

        if (params?.status && params.status !== 'All') {
          query = query.eq('status', params.status);
        }
        if (params?.warehouseId && params.warehouseId !== 'All') {
          query = query.eq('warehouse_id', params.warehouseId);
        }
        if (params?.priority && params.priority !== 'All') {
          query = query.eq('priority', params.priority);
        }

        const { data, error } = await query;

        if (error) {
          if (isTableNotFoundError(error)) {
            markTableMissing('purchase_requests');
          }
        } else if (data && data.length > 0) {
          requests = data.map((d: any) => {
            const p = (d.requester_id && profileMap.get(d.requester_id)) || (d.requester_name && profileMap.get(d.requester_name.toLowerCase()));
            let requesterName = p?.full_name || d.requester_name || 'Warehouse Manager';
            const requesterRole = p?.role || 'Warehouse Manager';

            // Clean up if it was stored literally as "warehouse", "purchase", an email address, or generic username
            const lowerReq = requesterName.trim().toLowerCase();
            if (lowerReq === 'warehouse' || lowerReq === 'purchase' || lowerReq.includes('@')) {
              if (p?.full_name && !p.full_name.toLowerCase().includes('warehouse') && !p.full_name.toLowerCase().includes('purchase')) {
                requesterName = p.full_name;
              } else if (p?.email && !p.email.toLowerCase().startsWith('warehouse') && !p.email.toLowerCase().startsWith('purchase')) {
                requesterName = p.email.split('@')[0].split(/[._-]/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
              } else {
                requesterName = lowerReq.includes('purchase') ? 'Purchase Manager' : 'Warehouse Manager';
              }
            }

            return {
              id: d.id,
              companyId: d.company_id,
              requestNumber: d.request_number,
              warehouseId: d.warehouse_id,
              warehouseName: d.warehouse_name,
              requesterId: d.requester_id,
              requesterName,
              requesterRole,
              status: d.status as PurchaseRequestStatus,
              priority: d.priority as PurchaseRequestPriority,
              reason: d.reason,
              requestedDeliveryDate: d.requested_delivery_date,
              notes: d.notes,
              reviewerId: d.reviewer_id,
              reviewerName: d.reviewer_name,
              rejectionReason: d.rejection_reason,
              clarificationNotes: d.clarification_notes,
              purchaseOrderId: d.purchase_order_id,
              purchaseOrderNumber: d.purchase_order_number,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              items: (d.purchase_request_items || []).map((it: any) => {
                const prod = it.product_id ? productMap.get(it.product_id) : undefined;
                const requestedQty = Number(it.requested_qty || 0);
                const approvedQty = it.approved_qty !== null && it.approved_qty !== undefined ? Number(it.approved_qty) : null;
                const receivedQty = Number(it.received_qty || 0);
                const targetQty = approvedQty !== null ? approvedQty : requestedQty;
                const remainingQty = Math.max(0, targetQty - receivedQty);

                let receivingStatus: 'Not Received' | 'Partially Received' | 'Fully Received' = 'Not Received';
                if (receivedQty > 0 && receivedQty < targetQty) {
                  receivingStatus = 'Partially Received';
                } else if (receivedQty >= targetQty && targetQty > 0) {
                  receivingStatus = 'Fully Received';
                }

                return {
                  id: it.id,
                  requestId: it.request_id,
                  productId: it.product_id,
                  productName: it.product_name || prod?.name || 'Product',
                  sku: it.sku || prod?.sku,
                  currentStock: Number(it.current_stock || 0),
                  warningLimit: it.warning_limit !== null ? Number(it.warning_limit) : null,
                  requestedQty,
                  approvedQty,
                  receivedQty,
                  remainingQty,
                  receivingStatus,
                  unit: it.unit || prod?.primary_unit || 'Piece',
                  estimatedCost: Number(it.estimated_cost || 0),
                  adjustmentReason: it.adjustment_reason,
                  createdAt: it.created_at
                };
              }),
              history: (d.purchase_request_history || [])
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((h: any) => ({
                  id: h.id,
                  requestId: h.request_id,
                  statusFrom: h.status_from,
                  statusTo: h.status_to as PurchaseRequestStatus,
                  userId: h.user_id,
                  userName: h.user_name,
                  role: h.role,
                  comments: h.comments,
                  createdAt: h.created_at
                }))
            };
          });
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // Merge or fallback to local storage cache for offline/test resilience
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: PurchaseRequest[] = JSON.parse(raw);
          const existingIds = new Set(requests.map(r => r.id));
          cached.forEach(c => {
            if (!existingIds.has(c.id)) {
              // Ensure cached items have remainingQty and receivingStatus computed
              const enrichedItems = (c.items || []).map(it => {
                const requestedQty = Number(it.requestedQty || 0);
                const approvedQty = it.approvedQty !== null && it.approvedQty !== undefined ? Number(it.approvedQty) : null;
                const receivedQty = Number(it.receivedQty || 0);
                const targetQty = approvedQty !== null ? approvedQty : requestedQty;
                const remainingQty = Math.max(0, targetQty - receivedQty);

                let receivingStatus: 'Not Received' | 'Partially Received' | 'Fully Received' = 'Not Received';
                if (receivedQty > 0 && receivedQty < targetQty) {
                  receivingStatus = 'Partially Received';
                } else if (receivedQty >= targetQty && targetQty > 0) {
                  receivingStatus = 'Fully Received';
                }

                return {
                  ...it,
                  requestedQty,
                  approvedQty,
                  receivedQty,
                  remainingQty,
                  receivingStatus
                };
              });

              let reqName = c.requesterName || 'Warehouse Manager';
              if (reqName.toLowerCase() === 'warehouse' || reqName.toLowerCase() === 'purchase') {
                reqName = reqName.toLowerCase() === 'purchase' ? 'Purchase Manager' : 'Warehouse Manager';
              }

              requests.push({
                ...c,
                requesterName: reqName,
                requesterRole: c.requesterRole || 'Warehouse Manager',
                items: enrichedItems
              });
            }
          });
        }
      } catch {}
    }

    // Optional Search Filter
    if (params?.search) {
      const q = params.search.toLowerCase();
      requests = requests.filter(r =>
        r.requestNumber.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.items.some(i => i.productName.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)))
      );
    }

    // Role-based visibility scoping:
    // Warehouse Managers can only view requests they created or for their assigned warehouse
    if (userRole === 'Warehouse Manager' && userId) {
      return requests.filter(r => r.requesterId === userId);
    }

    return requests;
  },

  /**
   * Retrieves single purchase request by ID
   */
  async getPurchaseRequestById(id: string, companyId?: string): Promise<PurchaseRequest | null> {
    const list = await this.getPurchaseRequests(undefined, companyId);
    return list.find(r => r.id === id) || null;
  },

  /**
   * Generates a unique, concurrency-safe request number formatted as PR-YYYYMMDD-XXXX
   */
  generateRequestNumber(existingCount = 0): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const seq = String(existingCount + 1).padStart(4, '0');
    return `PR-${yyyy}${mm}${dd}-${seq.length > 4 ? randomSuffix : seq}`;
  },

  /**
   * Creates a new purchase request with line items and dispatches in-app notifications
   */
  async createPurchaseRequest(
    input: CreatePurchaseRequestInput,
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<PurchaseRequest> {
    // Strict RBAC: Salespersons have view-only access and cannot create purchase requests
    await assertCallerPermission('inventory', 'create');
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const requesterId = user?.id || '00000000-0000-0000-0000-000000000000';
    const requesterName = user?.name || 'Warehouse Manager';

    if (!input.items || input.items.length === 0) {
      throw new Error('At least one product item must be included in the purchase request.');
    }

    for (const item of input.items) {
      if (item.requestedQty <= 0) {
        throw new Error(`Requested quantity for "${item.productName}" must be greater than zero.`);
      }
    }

    // Determine current count to generate sequence
    const existing = await this.getPurchaseRequests(undefined, finalCompanyId);
    const requestNumber = this.generateRequestNumber(existing.length);
    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const newRequest: PurchaseRequest = {
      id: requestId,
      companyId: finalCompanyId,
      requestNumber,
      warehouseId: input.warehouseId,
      warehouseName: input.warehouseName,
      requesterId,
      requesterName,
      status: 'Pending Approval',
      priority: input.priority || 'Normal',
      reason: input.reason || '',
      requestedDeliveryDate: input.requestedDeliveryDate,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: input.items.map((it, idx) => ({
        id: `${requestId}-item-${idx + 1}`,
        requestId,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        currentStock: Number(it.currentStock || 0),
        warningLimit: it.warningLimit,
        requestedQty: Number(it.requestedQty),
        approvedQty: null,
        receivedQty: 0,
        unit: it.unit || 'Piece',
        estimatedCost: Number(it.estimatedCost || 0),
        createdAt: new Date().toISOString()
      })),
      history: [
        {
          id: `${requestId}-hist-1`,
          requestId,
          statusFrom: undefined,
          statusTo: 'Pending Approval',
          userId: requesterId,
          userName: requesterName,
          role: user?.role || 'Warehouse Manager',
          comments: input.reason ? `Request submitted: ${input.reason}` : 'Purchase request submitted',
          createdAt: new Date().toISOString()
        }
      ]
    };

    // 1. Insert into Supabase if connected and table is available
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        const { data: prData, error: prErr } = await supabase
          .from('purchase_requests')
          .insert({
            id: newRequest.id,
            company_id: finalCompanyId,
            request_number: newRequest.requestNumber,
            warehouse_id: newRequest.warehouseId,
            warehouse_name: newRequest.warehouseName,
            requester_id: newRequest.requesterId,
            requester_name: newRequest.requesterName,
            status: newRequest.status,
            priority: newRequest.priority,
            reason: newRequest.reason,
            requested_delivery_date: newRequest.requestedDeliveryDate || null,
            notes: newRequest.notes
          })
          .select()
          .single();

        if (prErr) {
          if (isTableNotFoundError(prErr)) {
            markTableMissing('purchase_requests');
          }
        } else if (prData) {
          // Insert items
          const itemRows = newRequest.items.map(it => ({
            request_id: newRequest.id,
            product_id: it.productId,
            product_name: it.productName,
            sku: it.sku,
            current_stock: it.currentStock,
            warning_limit: it.warningLimit,
            requested_qty: it.requestedQty,
            unit: it.unit,
            estimated_cost: it.estimatedCost
          }));
          await supabase.from('purchase_request_items').insert(itemRows);

          // Insert initial history
          await supabase.from('purchase_request_history').insert({
            request_id: newRequest.id,
            status_to: 'Pending Approval',
            user_id: requesterId,
            user_name: requesterName,
            role: user?.role || 'Warehouse Manager',
            comments: newRequest.history![0].comments
          });
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }


    // 2. Update local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        const list: PurchaseRequest[] = raw ? JSON.parse(raw) : [];
        list.unshift(newRequest);
        storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    // 3. Dispatch in-app notification to Purchase Managers and Admins
    try {
      const productSummary = newRequest.items.map(i => `${i.productName} (${i.requestedQty} ${i.unit})`).join(', ');
      await notificationService.createNotification(
        {
          title: `New Purchase Request: ${newRequest.requestNumber}`,
          message: `${requesterName} requested replenishment for ${newRequest.warehouseName}: ${productSummary}. Priority: ${newRequest.priority}.`,
          type: 'purchase_request',
          link: `/purchases/requests?id=${newRequest.id}`,
          warehouseId: newRequest.warehouseId,
          warehouseName: newRequest.warehouseName
        },
        finalCompanyId
      );
    } catch (err) {
      console.warn('Failed to dispatch purchase request notification:', err);
    }

    return newRequest;
  },

  /**
   * Updates request status, records history, adjusts quantities, and notifies stakeholders
   */
  async updateRequestStatus(
    params: {
      requestId: string;
      status: PurchaseRequestStatus;
      comments?: string;
      rejectionReason?: string;
      clarificationNotes?: string;
      cancellationReason?: string;
      adjustedItems?: { itemId: string; approvedQty: number; adjustmentReason?: string }[];
    },
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<PurchaseRequest> {
    // Strict RBAC: Purchase Manager (approvals) or Warehouse Manager (submit/cancel) only; Salesperson blocked
    const callerRole = await getActiveUserRole();
    if (callerRole && !hasPermission(callerRole, 'purchases', 'approve') && !hasPermission(callerRole, 'inventory', 'edit') && !hasPermission(callerRole, 'inventory', 'create')) {
      throw new Error(`Unauthorized (403): User role ${callerRole} is not authorized to update purchase requests.`);
    }
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const reviewerId = user?.id || '00000000-0000-0000-0000-000000000000';
    const reviewerName = user?.name || 'Reviewer';
    const reviewerRole = user?.role || 'Staff';

    // 1. Fetch current request
    const existing = await this.getPurchaseRequestById(params.requestId, finalCompanyId);
    if (!existing) {
      throw new Error(`Purchase request #${params.requestId} not found.`);
    }

    // RBAC Safety Rule: Warehouse Manager cannot approve their own requests
    if (params.status === 'Approved' && reviewerRole === 'Warehouse Manager') {
      throw new Error('Warehouse Managers cannot approve their own purchase requests.');
    }

    if (params.status === 'Rejected' && !params.rejectionReason?.trim()) {
      throw new Error('A mandatory rejection reason is required to reject a purchase request.');
    }

    const previousStatus = existing.status;
    const nowIso = new Date().toISOString();

    // 2. Apply item adjustments if approving with changed quantities
    const updatedItems = existing.items.map(it => {
      const adj = params.adjustedItems?.find(a => a.itemId === it.id);
      if (adj) {
        return {
          ...it,
          approvedQty: Number(adj.approvedQty),
          adjustmentReason: adj.adjustmentReason || it.adjustmentReason
        };
      }
      if (params.status === 'Approved' && it.approvedQty === null) {
        return {
          ...it,
          approvedQty: it.requestedQty
        };
      }
      return it;
    });

    // 3. Prepare new history entry
    const newHistoryEntry: PurchaseRequestHistory = {
      id: `${params.requestId}-hist-${(existing.history?.length || 0) + 1}`,
      requestId: params.requestId,
      statusFrom: previousStatus,
      statusTo: params.status,
      userId: reviewerId,
      userName: reviewerName,
      role: reviewerRole,
      comments: params.comments || params.rejectionReason || params.clarificationNotes || `Status updated to ${params.status}`,
      createdAt: nowIso
    };

    const updatedRequest: PurchaseRequest = {
      ...existing,
      status: params.status,
      reviewerId,
      reviewerName,
      rejectionReason: params.rejectionReason || existing.rejectionReason,
      clarificationNotes: params.clarificationNotes || existing.clarificationNotes,
      updatedAt: nowIso,
      items: updatedItems,
      history: [...(existing.history || []), newHistoryEntry]
    };

    // 4. Update in Supabase if table is available
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        const { error: upErr } = await supabase
          .from('purchase_requests')
          .update({
            status: params.status,
            reviewer_id: reviewerId,
            reviewer_name: reviewerName,
            rejection_reason: updatedRequest.rejectionReason || null,
            clarification_notes: updatedRequest.clarificationNotes || null,
            updated_at: nowIso
          })
          .eq('id', params.requestId);

        if (upErr) {
          if (isTableNotFoundError(upErr)) {
            markTableMissing('purchase_requests');
          }
        } else {
          // Update adjusted items
          if (params.adjustedItems && params.adjustedItems.length > 0) {
            for (const adj of params.adjustedItems) {
              await supabase
                .from('purchase_request_items')
                .update({
                  approved_qty: adj.approvedQty,
                  adjustment_reason: adj.adjustmentReason || null
                })
                .eq('id', adj.itemId);
            }
          }

          // Insert history log
          await supabase
            .from('purchase_request_history')
            .insert({
              request_id: params.requestId,
              status_from: previousStatus,
              status_to: params.status,
              user_id: reviewerId,
              user_name: reviewerName,
              role: reviewerRole,
              comments: newHistoryEntry.comments
            });
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // 5. Update local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: PurchaseRequest[] = JSON.parse(raw);
          const index = list.findIndex(r => r.id === params.requestId);
          if (index !== -1) {
            list[index] = updatedRequest;
          } else {
            list.unshift(updatedRequest);
          }
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(list));
        }
      } catch {}
    }

    // 6. Notify requester (Warehouse Manager) of decision or clarification request
    try {
      let notifTitle = `Purchase Request Update: ${existing.requestNumber}`;
      let notifMsg = `Your purchase request has been moved to ${params.status} by ${reviewerName}.`;
      let targetUserId: string | null = existing.requesterId;
      let targetLink = `/inventory/purchase-requests?id=${existing.id}`;
      let priority: CustomerSupportPriority = 'Normal';
      let actionText = 'View Purchase Request';
      let dedupKey: string | undefined = undefined;

      // Extract requested product summary (e.g. Cement, Paint)
      const productSummary =
        existing.items && existing.items.length > 0
          ? Array.from(new Set(existing.items.map(it => it.productName).filter(Boolean))).join(', ')
          : 'items';

      if (params.status === 'Approved') {
        // Rule: Trigger only when the request status changes to Approved
        if (existing.status !== 'Approved') {
          notifTitle = 'Purchase Request Approved';
          notifMsg = `Your purchase request for ${productSummary} has been approved. You can view the request details.`;
          priority = 'Normal';
          actionText = 'View Purchase Request';
          targetUserId = existing.requesterId;
          targetLink = `/inventory/purchase-requests?id=${existing.id}`;
          dedupKey = `pr_approved_${existing.id}`;
        } else {
          // No repeated notification when unchanged
          return updatedRequest;
        }
      } else if (params.status === 'Rejected') {
        // Rule: Trigger only when the request status changes to Rejected
        if (existing.status !== 'Rejected') {
          notifTitle = 'Purchase Request Rejected';
          if (params.rejectionReason && params.rejectionReason.trim()) {
            notifMsg = `Your purchase request has been rejected. Reason: ${params.rejectionReason.trim()}.`;
          } else {
            notifMsg = 'Your purchase request has been rejected. Please review the request details.';
          }
          priority = 'High';
          actionText = 'View Purchase Request';
          targetUserId = existing.requesterId;
          targetLink = `/inventory/purchase-requests?id=${existing.id}`;
          dedupKey = `pr_rejected_${existing.id}`;
        } else {
          // No repeated notification when unchanged
          return updatedRequest;
        }
      } else if (params.status === 'Clarification Requested') {
        notifTitle = `Clarification Requested: ${existing.requestNumber}`;
        notifMsg = `${reviewerName} requested clarification: "${params.clarificationNotes}"`;
        targetUserId = existing.requesterId;
        targetLink = `/inventory/purchase-requests?id=${existing.id}`;
        priority = 'High';
        actionText = 'View Purchase Request';
      } else if (params.status === 'Under Review' && (params.comments?.includes('Clarification provided') || user?.role === 'Warehouse Manager')) {
        notifTitle = `Clarification Provided: ${existing.requestNumber}`;
        notifMsg = `Clarification provided by ${reviewerName} for request #${existing.requestNumber}. Ready for review.`;
        targetUserId = null;
        targetLink = `/purchases/requests?id=${existing.id}`;
        priority = 'Normal';
      } else if (params.status === 'Cancelled') {
        const reason = params.cancellationReason || params.rejectionReason || params.comments || 'No reason specified';
        notifTitle = `Purchase Request Cancelled: ${existing.requestNumber}`;
        notifMsg = `Purchase request #${existing.requestNumber} was cancelled by ${reviewerName}. Status: Cancelled. Reason: ${reason}.`;
        if (user?.role === 'Warehouse Manager' || reviewerId === existing.requesterId) {
          targetUserId = null;
          targetLink = `/purchases/requests?id=${existing.id}`;
        } else {
          targetUserId = existing.requesterId;
          targetLink = `/inventory/purchase-requests?id=${existing.id}`;
        }
        priority = 'High';
        actionText = 'View Purchase Request';
      }

      await notificationService.createNotification(
        {
          title: notifTitle,
          message: notifMsg,
          type: 'purchase_request',
          link: targetLink,
          userId: targetUserId,
          warehouseId: existing.warehouseId,
          warehouseName: existing.warehouseName,
          priority,
          actionText,
          dedupKey
        },
        finalCompanyId
      );
    } catch (e) {
      console.warn('Notification dispatch error on status update:', e);
    }

    return updatedRequest;
  },

  /**
   * Cancels a purchase request and dispatches a cancellation notification to the requester
   */
  async cancelPurchaseRequest(
    params: {
      requestId: string;
      cancellationReason: string;
    },
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<PurchaseRequest> {
    return this.updateRequestStatus(
      {
        requestId: params.requestId,
        status: 'Cancelled',
        cancellationReason: params.cancellationReason,
        comments: `Cancelled: ${params.cancellationReason}`
      },
      companyId,
      user
    );
  },

  /**
   * Converts an approved purchase request into a linked Purchase Order
   * Prevents duplicate orders and records status transition to 'Ordered'
   */
  async createPurchaseOrderFromRequest(
    params: {
      requestId: string;
      supplierId: string;
      supplierName: string;
      supplierGstin?: string;
      orderDate?: string;
      expectedDelivery?: string;
      notes?: string;
      items: Array<{
        productId: string;
        productName: string;
        qty: number;
        rate: number;
        taxRate: number;
        unit: string;
      }>;
    },
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<{ purchaseOrderId: string; purchaseOrderNumber: string; request: PurchaseRequest }> {
    // Strict RBAC: Only authorized purchasing roles can create purchase orders
    await assertCallerPermission('purchases', 'create');
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const existing = await this.getPurchaseRequestById(params.requestId, finalCompanyId);
    if (!existing) {
      throw new Error(`Purchase request #${params.requestId} not found.`);
    }

    if (existing.status !== 'Approved' && existing.status !== 'Ordered') {
      throw new Error(`Purchase request must be in "Approved" status before creating a Purchase Order (Current: ${existing.status}).`);
    }

    if (existing.purchaseOrderId) {
      throw new Error(`A Purchase Order (${existing.purchaseOrderNumber}) has already been generated for request #${existing.requestNumber}.`);
    }

    const orderNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const purchaseOrderId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'po-' + Date.now();

    const subtotal = params.items.reduce((sum, it) => sum + (it.qty * it.rate), 0);
    const taxTotal = params.items.reduce((sum, it) => sum + (it.qty * it.rate * (it.taxRate / 100)), 0);
    const grandTotal = subtotal + taxTotal;

    // 1. Insert into purchase_orders if available, or fallback to purchases
    if (!isTableMarkedMissing('purchase_orders')) {
      try {
        const { error: poErr } = await supabase.from('purchase_orders').insert({
          id: purchaseOrderId,
          company_id: finalCompanyId,
          order_number: orderNumber,
          date: params.orderDate || new Date().toISOString().split('T')[0],
          expected_delivery: params.expectedDelivery || null,
          supplier_id: params.supplierId || null,
          supplier_name: params.supplierName,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          status: 'Ordered',
          notes: params.notes || `Generated from Purchase Request ${existing.requestNumber}`
        });

        if (poErr) {
          if (isTableNotFoundError(poErr)) {
            markTableMissing('purchase_orders');
          }
        } else {
          // Insert purchase order line items
          const poItems = params.items.map(it => ({
            order_id: purchaseOrderId,
            product_id: it.productId,
            product_name: it.productName,
            qty: it.qty,
            unit: it.unit,
            rate: it.rate,
            tax_rate: it.taxRate,
            tax_amt: it.qty * it.rate * (it.taxRate / 100),
            total: it.qty * it.rate * (1 + it.taxRate / 100)
          }));
          await supabase.from('purchase_order_items').insert(poItems);
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_orders');
        }
      }
    }

    // Fallback sync to public.purchases table
    try {
      await supabase.from('purchases').insert({
        id: purchaseOrderId,
        company_id: finalCompanyId,
        invoice_number: orderNumber,
        doc_type: 'purchase_order',
        date: params.orderDate || new Date().toISOString().split('T')[0],
        due_date: params.expectedDelivery || params.orderDate || new Date().toISOString().split('T')[0],
        supplier_id: params.supplierId || null,
        supplier_name: params.supplierName,
        supplier_gstin: params.supplierGstin || null,
        subtotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        payment_status: 'Unpaid',
        notes: params.notes || `Generated from Purchase Request ${existing.requestNumber}`
      });
    } catch {}

    // Synchronize supplier delivery status to Active in Supabase
    try {
      if (params.supplierId) {
        await supabase
          .from('suppliers')
          .update({ status: 'Active' })
          .eq('id', params.supplierId);
      } else if (params.supplierName) {
        await supabase
          .from('suppliers')
          .update({ status: 'Active' })
          .ilike('name', params.supplierName);
      }
    } catch {}

    // 2. Link Purchase Order to Purchase Request and transition to 'Ordered'
    const nowIso = new Date().toISOString();
    const newHistoryEntry: PurchaseRequestHistory = {
      id: `${params.requestId}-hist-${(existing.history?.length || 0) + 1}`,
      requestId: params.requestId,
      statusFrom: existing.status,
      statusTo: 'Ordered',
      userId: user?.id || '00000000-0000-0000-0000-000000000000',
      userName: user?.name || 'Purchase Manager',
      role: user?.role || 'Purchase Manager',
      comments: `Converted to Purchase Order ${orderNumber} (Vendor: ${params.supplierName})`,
      createdAt: nowIso
    };

    const updatedRequest: PurchaseRequest = {
      ...existing,
      status: 'Ordered',
      purchaseOrderId,
      purchaseOrderNumber: orderNumber,
      updatedAt: nowIso,
      history: [...(existing.history || []), newHistoryEntry]
    };

    // Update in Supabase if table is available
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        const { error: updErr } = await supabase
          .from('purchase_requests')
          .update({
            status: 'Ordered',
            purchase_order_id: purchaseOrderId,
            purchase_order_number: orderNumber,
            updated_at: nowIso
          })
          .eq('id', params.requestId);

        if (updErr) {
          if (isTableNotFoundError(updErr)) {
            markTableMissing('purchase_requests');
          }
        } else {
          await supabase
            .from('purchase_request_history')
            .insert({
              request_id: params.requestId,
              status_from: existing.status,
              status_to: 'Ordered',
              user_id: user?.id || null,
              user_name: user?.name || 'Purchase Manager',
              role: user?.role || 'Purchase Manager',
              comments: newHistoryEntry.comments
            });
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // Update local cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: PurchaseRequest[] = JSON.parse(raw);
          const index = list.findIndex(r => r.id === params.requestId);
          if (index !== -1) list[index] = updatedRequest;
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(list));
        }
      } catch {}
    }

    // Notify Warehouse Manager
    try {
      await notificationService.createNotification(
        {
          title: `Purchase Order Placed: ${orderNumber}`,
          message: `Goods for request ${existing.requestNumber} have been ordered from ${params.supplierName}. Inward goods expected by ${params.expectedDelivery || 'standard delivery'}.`,
          type: 'purchase_request',
          link: `/inventory/purchase-requests?id=${existing.id}`,
          userId: existing.requesterId,
          warehouseId: existing.warehouseId,
          warehouseName: existing.warehouseName
        },
        finalCompanyId
      );
    } catch (e) {}

    return {
      purchaseOrderId,
      purchaseOrderNumber: orderNumber,
      request: updatedRequest
    };
  },

  /**
   * Records inward goods receipt (GRN) for a purchase request.
   * Increments product and warehouse inventory only for confirmed received quantities.
   * Transitions status to 'Partially Received' or 'Completed'.
   */
  async recordGoodsReceipt(
    params: {
      requestId: string;
      receivedItems: Array<{
        itemId: string;
        productId: string;
        receivedQty: number;
      }>;
      receivingWarehouseId: string;
      invoiceNumber?: string;
    },
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<PurchaseRequest> {
    // Strict RBAC: Only warehouse personnel can receive warehouse deliveries
    await assertCallerPermission('inventory', 'create');
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const existing = await this.getPurchaseRequestById(params.requestId, finalCompanyId);
    if (!existing) {
      throw new Error(`Purchase request #${params.requestId} not found.`);
    }

    if (existing.status !== 'Ordered' && existing.status !== 'Partially Received') {
      throw new Error(`Goods receipt can only be recorded for requests in "Ordered" or "Partially Received" status (Current: ${existing.status}).`);
    }

    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    let allFulfilled = true;
    let anyReceived = false;

    // 1. Calculate updated item received quantities
    const updatedItems = existing.items.map(it => {
      const match = params.receivedItems.find(r => r.itemId === it.id || r.productId === it.productId);
      const incomingQty = match ? Number(match.receivedQty) : 0;
      if (incomingQty > 0) anyReceived = true;

      const newReceivedTotal = Number(it.receivedQty || 0) + incomingQty;
      const targetQty = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;

      if (newReceivedTotal < targetQty) {
        allFulfilled = false;
      }

      return {
        ...it,
        receivedQty: newReceivedTotal
      };
    });

    if (!anyReceived) {
      throw new Error('Please enter at least one positive received quantity to record inward goods.');
    }

    const nextStatus: PurchaseRequestStatus = allFulfilled ? 'Completed' : 'Partially Received';

    // 2. Safely increment stock in products and log stock_transactions (prevents double increments)
    for (const recv of params.receivedItems) {
      if (recv.receivedQty > 0) {
        const item = existing.items.find(i => i.id === recv.itemId || i.productId === recv.productId);
        const prodName = item?.productName || 'Received Product';
        const unit = item?.unit || 'Piece';

        try {
          // Increment stock in public.products
          const { data: prodData } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', recv.productId)
            .single();

          if (prodData) {
            await supabase
              .from('products')
              .update({ current_stock: Number(prodData.current_stock || 0) + recv.receivedQty })
              .eq('id', recv.productId);
          }

          // Insert verified stock movement audit log
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            warehouse_id: params.receivingWarehouseId || existing.warehouseId,
            date: dateStr,
            type: 'Purchase',
            product_id: recv.productId,
            product_name: prodName,
            qty: recv.receivedQty,
            unit,
            reference_type: 'Purchase Request Receipt',
            reference_id: existing.id,
            reference_number: existing.requestNumber
          });
        } catch (e) {
          console.warn('Stock update note during GRN receipt:', e);
        }
      }
    }

    // 3. Prepare updated request object
    const receiptSummary = params.receivedItems
      .filter(r => r.receivedQty > 0)
      .map(r => {
        const it = existing.items.find(i => i.id === r.itemId || i.productId === r.productId);
        return `${it?.productName || 'Product'}: +${r.receivedQty} ${it?.unit || 'Pcs'}`;
      })
      .join(', ');

    const newHistoryEntry: PurchaseRequestHistory = {
      id: `${params.requestId}-hist-${(existing.history?.length || 0) + 1}`,
      requestId: params.requestId,
      statusFrom: existing.status,
      statusTo: nextStatus,
      userId: user?.id || '00000000-0000-0000-0000-000000000000',
      userName: user?.name || 'Warehouse Staff',
      role: user?.role || 'Warehouse Manager',
      comments: `Goods receipt recorded (${receiptSummary}). Status: ${nextStatus}.`,
      createdAt: nowIso
    };

    const updatedRequest: PurchaseRequest = {
      ...existing,
      status: nextStatus,
      updatedAt: nowIso,
      items: updatedItems,
      history: [...(existing.history || []), newHistoryEntry]
    };

    // 4. Update in Supabase if table is available
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        const { error: grnErr } = await supabase
          .from('purchase_requests')
          .update({
            status: nextStatus,
            updated_at: nowIso
          })
          .eq('id', params.requestId);

        if (grnErr) {
          if (isTableNotFoundError(grnErr)) {
            markTableMissing('purchase_requests');
          }
        } else {
          for (const it of updatedItems) {
            await supabase
              .from('purchase_request_items')
              .update({ received_qty: it.receivedQty })
              .eq('id', it.id);
          }

          await supabase
            .from('purchase_request_history')
            .insert({
              request_id: params.requestId,
              status_from: existing.status,
              status_to: nextStatus,
              user_id: user?.id || null,
              user_name: user?.name || 'Warehouse Staff',
              role: user?.role || 'Warehouse Manager',
              comments: newHistoryEntry.comments
            });
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // 5. Update local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: PurchaseRequest[] = JSON.parse(raw);
          const index = list.findIndex(r => r.id === params.requestId);
          if (index !== -1) list[index] = updatedRequest;
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(list));
        }
      } catch {}
    }

    // Synchronize supplier status to Inactive if this was their final delivery obligation
    if (nextStatus === 'Completed') {
      try {
        let suppName: string | null = null;
        if (existing.history) {
          for (const h of existing.history) {
            if (h.comments && h.comments.includes('Vendor:')) {
              const match = h.comments.match(/Vendor:\s*([^)]+)/);
              if (match && match[1]) {
                suppName = match[1].trim();
                break;
              }
            }
          }
        }

        if (suppName) {
          const { data: otherActive } = await supabase
            .from('purchase_requests')
            .select('id, status')
            .eq('company_id', finalCompanyId)
            .neq('id', existing.id)
            .in('status', ['Ordered', 'Partially Received']);

          if (!otherActive || otherActive.length === 0) {
            await supabase
              .from('suppliers')
              .update({ status: 'Inactive' })
              .ilike('name', suppName);
          }
        }
      } catch {}
    }

    // 6. Notify stakeholders of receipt completion or partial delivery
    try {
      await notificationService.createNotification(
        {
          title: `Inward Goods Received: ${existing.requestNumber}`,
          message: `${receiptSummary} confirmed at ${existing.warehouseName}. Overall status: ${nextStatus}.`,
          type: 'purchase_request',
          link: `/inventory/purchase-requests?id=${existing.id}`,
          warehouseId: existing.warehouseId,
          warehouseName: existing.warehouseName
        },
        finalCompanyId
      );
    } catch (e) {}

    return updatedRequest;
  },

  /**
   * Updates an existing purchase request's details (reason, priority, warehouse, items, date)
   */
  async updatePurchaseRequest(
    requestId: string,
    input: Partial<CreatePurchaseRequestInput>,
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<PurchaseRequest> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const existing = await this.getPurchaseRequestById(requestId, finalCompanyId);
    if (!existing) {
      throw new Error(`Purchase request #${requestId} not found.`);
    }

    const updatedRequest: PurchaseRequest = {
      ...existing,
      warehouseId: input.warehouseId || existing.warehouseId,
      warehouseName: input.warehouseName || existing.warehouseName,
      priority: input.priority || existing.priority,
      reason: input.reason !== undefined ? input.reason : existing.reason,
      requestedDeliveryDate: input.requestedDeliveryDate !== undefined ? input.requestedDeliveryDate : existing.requestedDeliveryDate,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      updatedAt: new Date().toISOString(),
      items: input.items
        ? input.items.map((it, idx) => ({
            id: existing.items[idx]?.id || `${requestId}-item-${idx + 1}`,
            requestId,
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            currentStock: Number(it.currentStock || 0),
            warningLimit: it.warningLimit,
            requestedQty: Number(it.requestedQty),
            approvedQty: null,
            receivedQty: 0,
            unit: it.unit || 'Piece',
            estimatedCost: Number(it.estimatedCost || 0),
            createdAt: existing.items[idx]?.createdAt || new Date().toISOString()
          }))
        : existing.items,
      history: [
        ...(existing.history || []),
        {
          id: `${requestId}-hist-${(existing.history?.length || 0) + 1}`,
          requestId,
          statusFrom: existing.status,
          statusTo: existing.status,
          userId: user?.id || '00000000-0000-0000-0000-000000000000',
          userName: user?.name || 'Warehouse Manager',
          role: user?.role || 'Warehouse Manager',
          comments: input.reason ? `Request details updated: ${input.reason}` : 'Purchase request details updated',
          createdAt: new Date().toISOString()
        }
      ]
    };

    // 1. Update in Supabase if table is available
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        const { error: prErr } = await supabase
          .from('purchase_requests')
          .update({
            warehouse_id: updatedRequest.warehouseId,
            warehouse_name: updatedRequest.warehouseName,
            priority: updatedRequest.priority,
            reason: updatedRequest.reason,
            requested_delivery_date: updatedRequest.requestedDeliveryDate || null,
            notes: updatedRequest.notes,
            updated_at: updatedRequest.updatedAt
          })
          .eq('id', requestId);

        if (prErr) {
          if (isTableNotFoundError(prErr)) {
            markTableMissing('purchase_requests');
          }
        } else if (input.items && input.items.length > 0) {
          // Replace line items
          await supabase.from('purchase_request_items').delete().eq('request_id', requestId);
          const itemRows = updatedRequest.items.map(it => ({
            request_id: requestId,
            product_id: it.productId,
            product_name: it.productName,
            sku: it.sku,
            current_stock: it.currentStock,
            warning_limit: it.warningLimit,
            requested_qty: it.requestedQty,
            unit: it.unit,
            estimated_cost: it.estimatedCost
          }));
          await supabase.from('purchase_request_items').insert(itemRows);
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // 2. Update local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: PurchaseRequest[] = JSON.parse(raw);
          const index = list.findIndex(r => r.id === requestId);
          if (index !== -1) {
            list[index] = updatedRequest;
          } else {
            list.unshift(updatedRequest);
          }
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(list));
        }
      } catch {}
    }

    return updatedRequest;
  },

  /**
   * Deletes a purchase request and its line items
   */
  async deletePurchaseRequest(
    requestId: string,
    companyId?: string,
    userRole?: string
  ): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Delete from Supabase if table exists
    if (!isTableMarkedMissing('purchase_requests')) {
      try {
        // Delete child items first to satisfy foreign key constraints
        try {
          await supabase.from('purchase_request_items').delete().eq('request_id', requestId);
        } catch {}

        const { error } = await supabase.from('purchase_requests').delete().eq('id', requestId);
        if (error && isTableNotFoundError(error)) {
          markTableMissing('purchase_requests');
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('purchase_requests');
        }
      }
    }

    // 2. Delete from local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: PurchaseRequest[] = JSON.parse(raw);
          const filtered = list.filter(r => r.id !== requestId);
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(filtered));
        }
      } catch {}
    }

    return true;
  }
};

