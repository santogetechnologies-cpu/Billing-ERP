import { supabase } from '../lib/supabase';
import { CompanyProfile, Warehouse } from '../types';
import { assertCallerPermission } from '../utils/rbac';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../utils/schemaDetector';
import { notificationService } from './notificationService';

export const companyService = {
  // Fetch primary active company for the current session
  async getCompany(companyId?: string): Promise<CompanyProfile | null> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', finalCompanyId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name || '',
      logo: data.logo_url || '',
      businessType: data.business_type || 'Trading',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || 'India',
      pincode: data.pincode || '',
      phone: data.phone || '',
      email: data.email || '',
      website: data.website || '',
      gstin: data.gstin || '',
      pan: data.pan || '',
      taxRegistration: data.tax_registration || '',
      currency: data.currency || 'INR',
      currencySymbol: data.currency_symbol || '₹',
      financialYear: data.financial_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      invoicePrefix: data.invoice_prefix || 'INV-',
      invoiceStartingNumber: Number(data.invoice_starting_number) || 1,
      bankName: data.bank_name || '',
      accountName: data.account_name || data.name || '',
      accountNumber: data.account_number || '',
      ifscCode: data.ifsc_code || '',
      upiId: data.upi_id || '',
      termsAndConditions: data.terms_conditions || 'Goods once sold are subject to standard company warranty and terms.',
      primaryColor: data.primary_color || data.primary_accent || 'blue'
    };
  },

  // Upload company logo to Supabase Storage
  async uploadLogo(file: File, companyId?: string): Promise<string> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const fileExt = file.name.split('.').pop();
    const fileName = `${finalCompanyId}/logo_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.warn('Failed to upload logo:', uploadError.message);
      return '';
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
  },

  // Update company profile
  async updateCompany(updates: Partial<CompanyProfile>, companyId?: string): Promise<boolean> {
    // 0. Strict RBAC Enforcement: Only Admin and Owner can modify company settings
    await assertCallerPermission('settings', 'manage');

    const finalCompanyId = companyId || updates.id || '00000000-0000-0000-0000-000000000001';
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.logo !== undefined) dbPayload.logo_url = updates.logo;
    if (updates.businessType !== undefined) dbPayload.business_type = updates.businessType;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.city !== undefined) dbPayload.city = updates.city;
    if (updates.state !== undefined) dbPayload.state = updates.state;
    if (updates.country !== undefined) dbPayload.country = updates.country;
    if (updates.pincode !== undefined) dbPayload.pincode = updates.pincode;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.website !== undefined) dbPayload.website = updates.website;
    if (updates.gstin !== undefined) dbPayload.gstin = updates.gstin;
    if (updates.pan !== undefined) dbPayload.pan = updates.pan;
    if (updates.taxRegistration !== undefined) dbPayload.tax_registration = updates.taxRegistration;
    if (updates.currency !== undefined) dbPayload.currency = updates.currency;
    if (updates.currencySymbol !== undefined) dbPayload.currency_symbol = updates.currencySymbol;
    if (updates.financialYear !== undefined) dbPayload.financial_year = updates.financialYear;
    if (updates.invoicePrefix !== undefined) dbPayload.invoice_prefix = updates.invoicePrefix;
    if (updates.invoiceStartingNumber !== undefined) dbPayload.invoice_starting_number = updates.invoiceStartingNumber;
    if (updates.bankName !== undefined) dbPayload.bank_name = updates.bankName;
    if (updates.accountName !== undefined) dbPayload.account_name = updates.accountName;
    if (updates.accountNumber !== undefined) dbPayload.account_number = updates.accountNumber;
    if (updates.ifscCode !== undefined) dbPayload.ifsc_code = updates.ifscCode;
    if (updates.upiId !== undefined) dbPayload.upi_id = updates.upiId;
    if (updates.termsAndConditions !== undefined) dbPayload.terms_conditions = updates.termsAndConditions;
    if (updates.primaryColor !== undefined) dbPayload.primary_color = updates.primaryColor;

    const { error } = await supabase
      .from('companies')
      .update(dbPayload)
      .eq('id', finalCompanyId);

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }
    return true;
  },

  // Local/Metadata cache helper for warehouses (company-scoped)
  getLocalWarehouseMeta(companyId: string): Record<string, Partial<Warehouse>> {
    const storage = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage ? (globalThis as any).localStorage : null);
    if (!storage) return {};
    try {
      const raw = storage.getItem(`universal_billing_warehouses_meta_${companyId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  },

  saveLocalWarehouseMeta(id: string, meta: Partial<Warehouse>, companyId: string) {
    const storage = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage ? (globalThis as any).localStorage : null);
    if (!storage) return;
    try {
      const current = this.getLocalWarehouseMeta(companyId);
      current[id] = { ...(current[id] || {}), ...meta };
      storage.setItem(`universal_billing_warehouses_meta_${companyId}`, JSON.stringify(current));
    } catch {}
  },

  // Get warehouses for company
  async getWarehouses(companyId?: string): Promise<Warehouse[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('is_default', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    const localMeta = this.getLocalWarehouseMeta(finalCompanyId);

    // Fetch multi-manager assignments from warehouse_managers if available
    let managerMap: Record<string, string[]> = {};
    if (!isTableMarkedMissing('warehouse_managers')) {
      try {
        const { data: wmRows, error: wmErr } = await supabase
          .from('warehouse_managers')
          .select('warehouse_id, user_id')
          .eq('company_id', finalCompanyId);
        if (wmErr) {
          if (isTableNotFoundError(wmErr)) {
            markTableMissing('warehouse_managers');
          }
        } else if (wmRows && wmRows.length > 0) {
          wmRows.forEach((r: any) => {
            if (!managerMap[r.warehouse_id]) managerMap[r.warehouse_id] = [];
            managerMap[r.warehouse_id].push(r.user_id);
          });
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('warehouse_managers');
        }
      }
    }

    // Also fetch cloud document_settings metadata if available
    let cloudMetaMap: Record<string, any> = {};
    try {
      const { data: docData } = await supabase
        .from('document_settings')
        .select('*')
        .eq('company_id', finalCompanyId)
        .eq('doc_type', 'warehouse_meta');
      if (docData && docData.length > 0) {
        docData.forEach(d => {
          if (d.title) {
            try {
              cloudMetaMap[d.title] = JSON.parse(d.terms_conditions || '{}');
            } catch {}
          }
        });
      }
    } catch {}

    return data.map((w: any) => {
      const meta = { ...(cloudMetaMap[w.id] || {}), ...(localMeta[w.id] || {}) };
      const locType = w.location_type || meta.locationType || meta.type || (w.is_default ? 'Main Warehouse' : 'Branch Warehouse');
      const isActive = w.is_active !== undefined && w.is_active !== null
        ? Boolean(w.is_active)
        : (meta.isActive !== undefined ? Boolean(meta.isActive) : true);

      const assignedManagerId = w.manager_id || meta.managerId || null;
      const explicitManagerIds: string[] = Array.from(new Set([
        ...(managerMap[w.id] || []),
        ...(assignedManagerId ? [assignedManagerId] : []),
        ...(meta.managerIds || [])
      ]));

      return {
        id: w.id,
        name: w.name,
        code: w.code,
        type: locType,
        locationType: locType,
        address: w.address || '',
        contactPerson: w.contact_person || meta.contactPerson || '',
        phone: w.phone || meta.phone || '',
        description: w.description || meta.description || '',
        isActive,
        isDefault: Boolean(w.is_default),
        managerId: assignedManagerId,
        managerName: meta.managerName || w.contact_person || '',
        managerIds: explicitManagerIds,
        createdAt: w.created_at,
        updatedAt: w.updated_at || meta.updatedAt
      };
    });
  },

  // Create a warehouse
  async createWarehouse(
    warehouse: {
      name: string;
      code: string;
      locationType?: string;
      type?: string;
      address?: string;
      contactPerson?: string;
      phone?: string;
      description?: string;
      isActive?: boolean;
      isDefault?: boolean;
      managerId?: string | null;
      managerName?: string;
      managerIds?: string[];
    },
    companyId?: string
  ): Promise<Warehouse> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const locType = (warehouse.locationType || warehouse.type || 'Main Warehouse') as any;
    const isActive = warehouse.isActive !== undefined ? Boolean(warehouse.isActive) : true;
    const isDefault = Boolean(warehouse.isDefault);

    // If default is selected, unset previous default in DB
    if (isDefault) {
      try {
        await supabase.from('warehouses').update({ is_default: false }).eq('company_id', finalCompanyId);
      } catch {}
    }

    // Try full insert with extended columns including manager_id
    let insertedData: any = null;
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({
          company_id: finalCompanyId,
          name: warehouse.name.trim(),
          code: warehouse.code.trim().toUpperCase(),
          address: warehouse.address || '',
          location_type: locType,
          contact_person: warehouse.contactPerson || '',
          phone: warehouse.phone || '',
          description: warehouse.description || '',
          is_active: isActive,
          is_default: isDefault,
          manager_id: warehouse.managerId || null
        })
        .select()
        .single();

      if (!error && data) {
        insertedData = data;
      }
    } catch {}

    // Fallback if extended columns are not yet migrated on DB instance
    if (!insertedData) {
      const { data: fallbackData, error: fbError } = await supabase
        .from('warehouses')
        .insert({
          company_id: finalCompanyId,
          name: warehouse.name.trim(),
          code: warehouse.code.trim().toUpperCase(),
          address: warehouse.address || '',
          is_default: isDefault
        })
        .select()
        .single();

      if (fbError || !fallbackData) {
        throw new Error(`Failed to create warehouse: ${fbError?.message || 'Database error'}`);
      }
      insertedData = fallbackData;
    }

    const assignedManagerIds = Array.from(new Set([
      ...(warehouse.managerIds || []),
      ...(warehouse.managerId ? [warehouse.managerId] : [])
    ]));

    // Sync multi-manager assignments to warehouse_managers table
    if (assignedManagerIds.length > 0 && !isTableMarkedMissing('warehouse_managers')) {
      try {
        for (const mId of assignedManagerIds) {
          const { error: insErr } = await supabase
            .from('warehouse_managers')
            .upsert({
              company_id: finalCompanyId,
              warehouse_id: insertedData.id,
              user_id: mId
            }, { onConflict: 'warehouse_id,user_id' });
          if (insErr && isTableNotFoundError(insErr)) {
            markTableMissing('warehouse_managers');
            break;
          }
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('warehouse_managers');
        }
      }
    }

    // Save extended metadata to local storage and document_settings
    const metaPayload = {
      locationType: locType,
      type: locType,
      contactPerson: warehouse.contactPerson || '',
      phone: warehouse.phone || '',
      description: warehouse.description || '',
      isActive,
      managerId: warehouse.managerId || null,
      managerName: warehouse.managerName || '',
      managerIds: assignedManagerIds,
      updatedAt: new Date().toISOString()
    };
    this.saveLocalWarehouseMeta(insertedData.id, metaPayload, finalCompanyId);

    try {
      await supabase.from('document_settings').insert({
        company_id: finalCompanyId,
        doc_type: 'warehouse_meta',
        title: insertedData.id,
        header_text: warehouse.code.trim().toUpperCase(),
        terms_conditions: JSON.stringify(metaPayload)
      });
    } catch {}

    return {
      id: insertedData.id,
      name: insertedData.name,
      code: insertedData.code,
      type: locType,
      locationType: locType,
      address: insertedData.address || '',
      contactPerson: warehouse.contactPerson || '',
      phone: warehouse.phone || '',
      description: warehouse.description || '',
      isActive,
      isDefault: Boolean(insertedData.is_default),
      managerId: warehouse.managerId || null,
      managerName: warehouse.managerName || '',
      managerIds: assignedManagerIds,
      createdAt: insertedData.created_at
    };
  },

  // Update a warehouse
  async updateWarehouse(
    id: string,
    updates: Partial<Warehouse>,
    companyId?: string
  ): Promise<Warehouse> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    if (updates.isDefault) {
      try {
        await supabase.from('warehouses').update({ is_default: false }).eq('company_id', finalCompanyId);
      } catch {}
    }

    const locType = (updates.locationType || updates.type) as any;
    const dbPayload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbPayload.name = updates.name.trim();
    if (updates.code !== undefined) dbPayload.code = updates.code.trim().toUpperCase();
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.isDefault !== undefined) dbPayload.is_default = updates.isDefault;
    if (updates.managerId !== undefined) dbPayload.manager_id = updates.managerId || null;

    // Try full update
    try {
      const extendedPayload = {
        ...dbPayload,
        ...(locType ? { location_type: locType } : {}),
        ...(updates.contactPerson !== undefined ? { contact_person: updates.contactPerson } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
        ...(updates.managerId !== undefined ? { manager_id: updates.managerId || null } : {})
      };
      await supabase.from('warehouses').update(extendedPayload).eq('id', id);
    } catch {
      // Fallback update
      try {
        await supabase.from('warehouses').update(dbPayload).eq('id', id);
      } catch {}
    }

    // Sync multi-manager assignments if provided
    if ((updates.managerIds !== undefined || updates.managerId !== undefined) && !isTableMarkedMissing('warehouse_managers')) {
      const assignedManagerIds = Array.from(new Set([
        ...(updates.managerIds || []),
        ...(updates.managerId ? [updates.managerId] : [])
      ]));

      try {
        const { error: delErr } = await supabase.from('warehouse_managers').delete().eq('warehouse_id', id);
        if (delErr && isTableNotFoundError(delErr)) {
          markTableMissing('warehouse_managers');
        } else {
          for (const mId of assignedManagerIds) {
            const { error: insErr } = await supabase.from('warehouse_managers').insert({
              company_id: finalCompanyId,
              warehouse_id: id,
              user_id: mId
            });
            if (insErr && isTableNotFoundError(insErr)) {
              markTableMissing('warehouse_managers');
              break;
            }
          }
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('warehouse_managers');
        }
      }

      if (assignedManagerIds.length > 0) {
        try {
          await notificationService.resolveMissingWarehouseManagerAlert(id, finalCompanyId);
        } catch (e) {
          console.warn('Failed to resolve missing warehouse manager alert on update:', e);
        }
      }
    }

    // Update metadata layer
    const metaPayload = {
      ...(locType ? { locationType: locType, type: locType } : {}),
      ...(updates.contactPerson !== undefined ? { contactPerson: updates.contactPerson } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.managerId !== undefined ? { managerId: updates.managerId } : {}),
      ...(updates.managerName !== undefined ? { managerName: updates.managerName } : {}),
      ...(updates.managerIds !== undefined ? { managerIds: updates.managerIds } : {}),
      updatedAt: new Date().toISOString()
    };
    this.saveLocalWarehouseMeta(id, metaPayload, finalCompanyId);

    try {
      await supabase
        .from('document_settings')
        .upsert(
          {
            company_id: finalCompanyId,
            doc_type: 'warehouse_meta',
            title: id,
            header_text: updates.code || id,
            terms_conditions: JSON.stringify(metaPayload)
          },
          { onConflict: 'company_id,doc_type' }
        );
    } catch {}

    const warehouses = await this.getWarehouses(finalCompanyId);
    return warehouses.find(w => w.id === id) || {
      id,
      name: updates.name || '',
      code: updates.code || '',
      address: updates.address || '',
      isActive: updates.isActive ?? true,
      managerId: updates.managerId,
      managerName: updates.managerName,
      managerIds: updates.managerIds
    };
  },

  // Toggle warehouse active status
  async toggleWarehouseStatus(id: string, isActive: boolean, companyId?: string): Promise<void> {
    await this.updateWarehouse(id, { isActive }, companyId);
  },

  // Delete a warehouse (with safe usage validation)
  async deleteWarehouse(id: string, companyId?: string): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // Check if warehouse has stock balances > 0
    const { data: balances } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('warehouse_id', id)
      .gt('quantity', 0);

    if (balances && balances.length > 0) {
      throw new Error('Cannot delete warehouse that contains active stock inventory. Please transfer or adjust stock to zero first.');
    }

    // Check active transfers
    const { data: transfers } = await supabase
      .from('stock_transfers')
      .select('id, status')
      .or(`from_warehouse_id.eq.${id},to_warehouse_id.eq.${id}`)
      .in('status', ['Requested', 'Approved', 'Sent']);

    if (transfers && transfers.length > 0) {
      throw new Error('Cannot delete warehouse with active pending or in-transit stock transfers.');
    }

    // Execute deletion from warehouses
    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) {
      console.warn('Direct delete from warehouses encountered error, archiving instead:', error.message);
      await this.updateWarehouse(id, { isActive: false }, finalCompanyId);
      return true;
    }

    // Clean up local metadata
    try {
      const current = this.getLocalWarehouseMeta(finalCompanyId);
      delete current[id];
      localStorage.setItem(`universal_billing_warehouses_meta_${finalCompanyId}`, JSON.stringify(current));
    } catch {}

    return true;
  }
};
