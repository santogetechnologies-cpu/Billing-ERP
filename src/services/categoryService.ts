import { supabase } from '../lib/supabase';
import { assertCallerPermission } from '../utils/rbac';
import { getAppStorage } from '../utils/storageUtils';

export interface ProductCategoryRecord {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  description?: string;
  createdAt?: string;
}

/**
 * Standard 12 Base Product Categories in prescribed display order
 */
export const BASE_PRODUCT_CATEGORIES: string[] = [
  'Building Materials',
  'Grains & Foodstuff',
  'Metals & Structural',
  'Electrical Supplies',
  'Apparel & Uniforms',
  'IT & Hardware',
  'Paints & Chemicals',
  'Household & Consumer',
  'Tools & Machinery',
  'Packaging Supplies',
  'Safety & PPE',
  'General Merchandise'
];

/**
 * Checks if a given category name is one of the built-in system categories (case-insensitive)
 */
export function isBaseCategory(name: string): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  if (normalized === 'general' || normalized === 'general merchandise') return true;
  return BASE_PRODUCT_CATEGORIES.some(b => b.toLowerCase() === normalized);
}

const STORAGE_KEY = (companyId: string) => `universal_billing_custom_categories_${companyId}`;

export const categoryService = {
  /**
   * Retrieves all custom categories permanently stored in the database for the company.
   * Merges with existing product categories and local persistent storage.
   */
  async getCustomCategories(companyId?: string): Promise<string[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const seen = new Set<string>();
    const customList: string[] = [];

    const addUnique = (cat: string) => {
      const trimmed = cat ? cat.trim() : '';
      if (!trimmed) return;
      if (isBaseCategory(trimmed)) return;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        customList.push(trimmed);
      }
    };

    // 1. Fetch from database product_categories table
    try {
      const { data: dbData, error } = await supabase
        .from('product_categories')
        .select('name')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(dbData)) {
        for (const item of dbData) {
          if (item?.name) addUnique(item.name);
        }
      }
    } catch (err) {
      console.warn('Could not query product_categories from Supabase:', err);
    }

    // 2. Fetch distinct custom categories already present on existing products
    try {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('category')
        .eq('company_id', finalCompanyId);

      if (!prodErr && Array.isArray(prodData)) {
        for (const p of prodData) {
          if (p?.category) addUnique(p.category);
        }
      }
    } catch (err) {
      console.warn('Could not query products for custom categories:', err);
    }

    // 3. Merge with local persistent storage fallback
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string') addUnique(item);
            }
          }
        }
      } catch {}
    }

    // Persist updated merged set in storage
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(customList));
      } catch {}
    }

    return customList;
  },

  /**
   * Permanently saves a new custom category into the database.
   * Validates non-empty and case-insensitive uniqueness.
   */
  async createCategory(name: string, companyId?: string): Promise<string> {
    // 0. Strict RBAC Enforcement: caller must have products:create permission
    await assertCallerPermission('products', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const trimmed = (name || '').trim();

    if (!trimmed) {
      throw new Error('Category name cannot be empty.');
    }

    if (isBaseCategory(trimmed)) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }

    // Check existing custom categories
    const existing = await this.getCustomCategories(finalCompanyId);
    if (existing.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }

    // Generate code from category name
    const code = trimmed
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase() || 'CAT';

    // 1. Insert into Supabase product_categories table
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .insert({
          company_id: finalCompanyId,
          name: trimmed,
          code: code,
          description: 'Custom product category'
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.warn('Warning inserting custom category into Supabase:', error.message);
      }
    } catch (dbErr) {
      console.warn('Database error while saving custom category:', dbErr);
    }

    // 2. Persist in local storage for offline resiliency & immediate availability
    const storage = getAppStorage();
    if (storage) {
      try {
        const updated = [...existing.filter(c => c.toLowerCase() !== trimmed.toLowerCase()), trimmed];
        storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated));
      } catch {}
    }

    return trimmed;
  }
};
