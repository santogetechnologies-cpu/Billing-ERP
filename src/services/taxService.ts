import { supabase } from '../lib/supabase';

export interface TaxSlab {
  id: string;
  name: string;
  rate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  isDefault: boolean;
  cgst?: number;
  sgst?: number;
  igst?: number;
  type?: string;
  description?: string;
  activeProducts?: number;
}

export interface HsnTaxMapping {
  hsnCode: string;
  description: string;
  taxRate: number;
  category: string;
}

export const taxService = {
  async getTaxSlabs(): Promise<TaxSlab[]> {
    try {
      const { data, error } = await supabase
        .from('taxes')
        .select('*')
        .order('rate');

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        rate: Number(d.rate),
        cgstRate: Number(d.cgst_rate || d.rate / 2),
        sgstRate: Number(d.sgst_rate || d.rate / 2),
        igstRate: Number(d.igst_rate || d.rate),
        cessRate: Number(d.cess_rate || 0),
        isDefault: d.is_default || false,
        cgst: Number(d.cgst_rate || d.rate / 2),
        sgst: Number(d.sgst_rate || d.rate / 2),
        igst: Number(d.igst_rate || d.rate),
        type: 'Standard GST',
        description: d.description || `${d.name} Tax Slab`,
        activeProducts: 0
      }));
    } catch (err) {
      console.error('Failed to get tax slabs:', err);
      return [];
    }
  },

  async createTaxSlab(tax: {
    name: string;
    rate: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cessRate?: number;
    isDefault?: boolean;
    cgst?: number;
    sgst?: number;
    igst?: number;
    type?: string;
    description?: string;
    activeProducts?: number;
  }, companyId?: string): Promise<TaxSlab> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const cgstVal = tax.cgst ?? tax.cgstRate ?? tax.rate / 2;
    const sgstVal = tax.sgst ?? tax.sgstRate ?? tax.rate / 2;
    const igstVal = tax.igst ?? tax.igstRate ?? tax.rate;

    const { data, error } = await supabase
      .from('taxes')
      .insert({
        company_id: finalCompanyId,
        name: tax.name,
        rate: tax.rate,
        cgst_rate: cgstVal,
        sgst_rate: sgstVal,
        igst_rate: igstVal,
        cess_rate: tax.cessRate ?? 0,
        is_default: tax.isDefault ?? false
      })
      .select()
      .single();

    if (error || !data) {
      return {
        id: 'tax-' + Date.now(),
        name: tax.name,
        rate: tax.rate,
        cgstRate: cgstVal,
        sgstRate: sgstVal,
        igstRate: igstVal,
        cessRate: tax.cessRate ?? 0,
        isDefault: tax.isDefault ?? false,
        cgst: cgstVal,
        sgst: sgstVal,
        igst: igstVal,
        type: tax.type || 'Custom',
        description: tax.description || `${tax.name} Tax Slab`,
        activeProducts: tax.activeProducts || 0
      };
    }

    return {
      id: data.id,
      name: data.name,
      rate: Number(data.rate),
      cgstRate: Number(data.cgst_rate),
      sgstRate: Number(data.sgst_rate),
      igstRate: Number(data.igst_rate),
      cessRate: Number(data.cess_rate || 0),
      isDefault: data.is_default,
      cgst: Number(data.cgst_rate),
      sgst: Number(data.sgst_rate),
      igst: Number(data.igst_rate),
      type: tax.type || 'Custom',
      description: tax.description || `${data.name} Tax Slab`,
      activeProducts: 0
    };
  },

  async lookupHsn(hsnCode: string): Promise<HsnTaxMapping | null> {
    const { data, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('hsn_sac', hsnCode)
      .maybeSingle();

    if (error || !data) return null;

    return {
      hsnCode: data.hsn_sac,
      description: data.description || '',
      taxRate: Number(data.rate),
      category: data.category || 'Goods'
    };
  },

  calculateGST(taxableAmount: number, rate: number, isInterState: boolean) {
    const totalTax = (taxableAmount * rate) / 100;
    if (isInterState) {
      return {
        cgst: 0,
        sgst: 0,
        igst: totalTax,
        totalTax
      };
    } else {
      const half = totalTax / 2;
      return {
        cgst: half,
        sgst: half,
        igst: 0,
        totalTax
      };
    }
  }
};
