import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { productService } from './productService';
import { getAppStorage } from '../utils/storageUtils';

export interface ParsedVariableBarcode {
  isVariable: boolean;
  product: Product | null;
  parsedQuantity: number;
  unit: string;
  rawBarcode: string;
  variableType?: 'weight' | 'length' | 'quantity';
}

export const barcodeService = {
  // Lookup product directly or in barcode registry
  async lookupProductByBarcode(barcode: string): Promise<Product | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    try {
      // 1. Direct search in products table
      const { data: directProduct } = await supabase
        .from('products')
        .select('*')
        .or(`barcode.eq.${trimmed},sku.eq.${trimmed},code.eq.${trimmed}`)
        .maybeSingle();

      if (directProduct) {
        const all = await productService.getProducts();
        return all.find(p => p.id === directProduct.id) || null;
      }

      // 2. Search in product_barcodes table
      let barcodeRow: any = null;
      try {
        const { data } = await supabase
          .from('product_barcodes')
          .select('product_id')
          .or(`barcode_value.eq.${trimmed},barcode.eq.${trimmed}`)
          .maybeSingle();
        barcodeRow = data;
      } catch {
        try {
          const { data } = await supabase
            .from('product_barcodes')
            .select('product_id')
            .eq('barcode_value', trimmed)
            .maybeSingle();
          barcodeRow = data;
        } catch {}
      }

      if (barcodeRow?.product_id) {
        const all = await productService.getProducts();
        return all.find(p => p.id === barcodeRow.product_id) || null;
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
    }

    return null;
  },

  // Prompt #8: Variable Barcode Parsing (Weight, Length, Quantity)
  // e.g. EAN-13 prefix 20..29:
  // 20 = Weight (Kg with 3 decimal places: e.g. 20 00105 12750 C => Product 105, 12.75 Kg)
  // 21 = Length (Meters with 2 or 3 decimal places: e.g. 21 00105 05500 C => Product 105, 5.50 M)
  // 22 = Quantity (Units / Pieces: e.g. 22 00105 00024 C => Product 105, 24 Units)
  // Also supports barcode patterns like "SKU*12.75" or "BARCODE@12.75"
  async parseVariableBarcode(input: string, products: Product[]): Promise<ParsedVariableBarcode> {
    const trimmed = input.trim();

    // 1. Delimiter pattern (e.g. "RICE*12.75" or "ELE-00001@5.2")
    if (trimmed.includes('*') || trimmed.includes('@')) {
      const delimiter = trimmed.includes('*') ? '*' : '@';
      const [codePart, qtyPart] = trimmed.split(delimiter);
      const qty = parseFloat(qtyPart);
      if (!isNaN(qty) && qty > 0) {
        const prod = products.find(
          p => p.barcode === codePart || p.sku.toLowerCase() === codePart.toLowerCase() || p.code?.toLowerCase() === codePart.toLowerCase()
        );
        if (prod) {
          return {
            isVariable: true,
            product: prod,
            parsedQuantity: qty,
            unit: prod.primaryUnit,
            rawBarcode: trimmed,
            variableType: prod.primaryUnit.toLowerCase().includes('kg') ? 'weight' : 'quantity'
          };
        }
      }
    }

    // 2. GS1 / In-Store EAN-13 Variable Barcode (12 or 13 digits starting with 20-29)
    const isEAN13Variable = /^[2][0-9]{11,12}$/.test(trimmed);
    if (isEAN13Variable) {
      const prefix = trimmed.slice(0, 2);
      const itemCode = trimmed.slice(2, 7); // 5 digits item code
      const valueRaw = trimmed.slice(7, 12); // 5 digits value

      let variableType: 'weight' | 'length' | 'quantity' = 'weight';
      let parsedQty = parseFloat(valueRaw) / 1000; // default 3 decimal places (e.g. 12750 -> 12.750)

      if (prefix === '21') {
        variableType = 'length';
        parsedQty = parseFloat(valueRaw) / 100; // 2 decimal places in meters
      } else if (prefix === '22') {
        variableType = 'quantity';
        parsedQty = parseInt(valueRaw, 10);
      }

      // Try matching product by itemCode, code, sku suffix or barcode
      const prod = products.find(p => {
        const pCodeDigits = (p.code || p.sku || '').replace(/\D/g, '');
        return (
          pCodeDigits.endsWith(itemCode) ||
          p.barcode.includes(itemCode) ||
          p.sku.toLowerCase().includes(itemCode.toLowerCase())
        );
      });

      if (prod) {
        return {
          isVariable: true,
          product: prod,
          parsedQuantity: parsedQty > 0 ? parsedQty : 1,
          unit: prod.primaryUnit,
          rawBarcode: trimmed,
          variableType
        };
      }
    }

    // Standard non-variable barcode lookup
    const directMatch = products.find(
      p => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase() || p.code?.toLowerCase() === trimmed.toLowerCase()
    );

    return {
      isVariable: false,
      product: directMatch || null,
      parsedQuantity: 1,
      unit: directMatch?.primaryUnit || 'Pcs',
      rawBarcode: trimmed
    };
  },

  // Standard EAN-13 generation with check digit
  generateEAN13(sku: string): string {
    const seed = Math.abs(sku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 100000000));
    const prefix = '890'; // GS1 India prefix
    const body = String(seed).padStart(9, '0').slice(-9);
    const code12 = prefix + body;

    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code12[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return code12 + checkDigit;
  },

  // Variable weight barcode generation helper
  generateVariableWeightEAN13(itemCodeNum: number, weightKg: number): string {
    const prefix = '20';
    const itemCode = String(itemCodeNum).padStart(5, '0').slice(-5);
    const weightRaw = String(Math.round(weightKg * 1000)).padStart(5, '0').slice(-5);
    const code12 = prefix + itemCode + weightRaw;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code12[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return code12 + checkDigit;
  },

  async registerBarcode(productId: string, barcode: string, type = 'EAN-13'): Promise<boolean> {
    const { error } = await supabase
      .from('product_barcodes')
      .insert({
        product_id: productId,
        barcode,
        barcode_value: barcode,
        barcode_type: type,
        is_primary: true
      });

    if (error) {
      console.warn('Failed to register barcode:', error.message);
      return false;
    }
    return true;
  },

  // Generates unique standards-compliant barcodes across Code 128, EAN-13, EAN-8, UPC and QR Code
  generateUniqueBarcodeForType(
    type: 'Code 128' | 'EAN-13' | 'EAN-8' | 'UPC' | 'QR Code',
    sku: string,
    existingBarcodes: Set<string>
  ): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let candidate = '';
      if (type === 'EAN-13') {
        const randomPart = Math.floor(100000000 + Math.random() * 900000000);
        const code12 = '890' + String(randomPart);
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          const digit = parseInt(code12[i], 10);
          sum += i % 2 === 0 ? digit : digit * 3;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        candidate = code12 + checkDigit;
      } else if (type === 'EAN-8') {
        const code7 = String(Math.floor(1000000 + Math.random() * 9000000));
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          const digit = parseInt(code7[i], 10);
          sum += i % 2 === 0 ? digit * 3 : digit;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        candidate = code7 + checkDigit;
      } else if (type === 'UPC') {
        const code11 = String(Math.floor(10000000000 + Math.random() * 90000000000));
        let sum = 0;
        for (let i = 0; i < 11; i++) {
          const digit = parseInt(code11[i], 10);
          sum += i % 2 === 0 ? digit * 3 : digit;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        candidate = code11 + checkDigit;
      } else if (type === 'QR Code') {
        const cleanSku = (sku || 'PROD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        candidate = `UB-QR-${cleanSku}-${rand}`;
      } else {
        // Code 128
        const cleanSku = (sku || 'UB').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        const randNum = Math.floor(100000 + Math.random() * 900000);
        candidate = `${cleanSku ? cleanSku + '-' : 'UB-'}${randNum}`;
      }

      if (!existingBarcodes.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
    return `UB-${Date.now()}`;
  },

  // Validates barcode uniqueness against both products master and secondary product_barcodes table
  async checkBarcodeUniqueness(
    barcode: string,
    excludeProductId?: string,
    companyId?: string
  ): Promise<{ isUnique: boolean; conflictingProduct?: { id: string; name: string; sku: string; barcode: string } | null; message?: string }> {
    const trimmed = barcode.trim();
    if (!trimmed) return { isUnique: false, message: 'Barcode number cannot be empty.' };

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Check in catalog products
    let products: Product[] = [];
    try {
      products = await productService.getProducts(undefined, finalCompanyId);
    } catch {}

    const conflictProd = products.find(
      p => p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase() && p.id !== excludeProductId
    );

    if (conflictProd) {
      return {
        isUnique: false,
        conflictingProduct: {
          id: conflictProd.id,
          name: conflictProd.name,
          sku: conflictProd.sku,
          barcode: conflictProd.barcode
        },
        message: `Barcode "${trimmed}" is already assigned to "${conflictProd.name}" (SKU: ${conflictProd.sku}).`
      };
    }

    // 2. Check in product_barcodes table
    try {
      const { data } = await supabase
        .from('product_barcodes')
        .select('product_id, barcode, barcode_value')
        .or(`barcode.eq.${trimmed},barcode_value.eq.${trimmed}`)
        .neq('product_id', excludeProductId || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (data?.product_id) {
        const match = products.find(p => p.id === data.product_id);
        return {
          isUnique: false,
          conflictingProduct: match ? {
            id: match.id,
            name: match.name,
            sku: match.sku,
            barcode: match.barcode
          } : {
            id: data.product_id,
            name: 'Another registered product',
            sku: '—',
            barcode: trimmed
          },
          message: `Barcode "${trimmed}" is already registered to another product in the database.`
        };
      }
    } catch {}

    return { isUnique: true };
  },

  // Retrieves all registered barcodes (default and secondary) for a specific product
  async getProductBarcodes(productId: string): Promise<{ barcode: string; type: string; isPrimary: boolean }[]> {
    const result: { barcode: string; type: string; isPrimary: boolean }[] = [];
    try {
      const { data } = await supabase
        .from('product_barcodes')
        .select('barcode, barcode_value, barcode_type, is_primary')
        .eq('product_id', productId);

      if (data && data.length > 0) {
        data.forEach((r: any) => {
          const val = r.barcode || r.barcode_value;
          if (val && !result.some(x => x.barcode === val)) {
            result.push({
              barcode: val,
              type: r.barcode_type || 'Code 128',
              isPrimary: Boolean(r.is_primary)
            });
          }
        });
      }
    } catch {}

    // Check local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem('universal_billing_secondary_barcodes');
        if (raw) {
          const list: { productId: string; barcode: string; type: string; isPrimary: boolean }[] = JSON.parse(raw);
          list.filter(x => x.productId === productId).forEach(x => {
            if (!result.some(r => r.barcode === x.barcode)) {
              result.push(x);
            }
          });
        }
      } catch {}
    }

    return result;
  },

  // Saves a new barcode association to a product (replace default vs add secondary)
  async saveBarcodeForProduct(
    productId: string,
    barcode: string,
    type = 'Code 128',
    replaceDefault = true,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = barcode.trim();
    if (!trimmed) return { success: false, error: 'Barcode cannot be empty.' };

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    try {
      if (replaceDefault) {
        // 1. Update product master record
        await productService.updateProduct(productId, { barcode: trimmed }, finalCompanyId);

        // 2. Update product_barcodes table
        try {
          await supabase
            .from('product_barcodes')
            .update({ is_primary: false })
            .eq('product_id', productId);

          await supabase
            .from('product_barcodes')
            .upsert({
              product_id: productId,
              barcode: trimmed,
              barcode_value: trimmed,
              barcode_type: type,
              is_primary: true
            });
        } catch {}
      } else {
        // Add as secondary barcode
        try {
          await supabase
            .from('product_barcodes')
            .insert({
              product_id: productId,
              barcode: trimmed,
              barcode_value: trimmed,
              barcode_type: type,
              is_primary: false
            });
        } catch {}
      }

      // 3. Update local storage secondary barcodes cache
      const storage = getAppStorage();
      if (storage) {
        try {
          const raw = storage.getItem('universal_billing_secondary_barcodes');
          const list: { productId: string; barcode: string; type: string; isPrimary: boolean }[] = raw ? JSON.parse(raw) : [];
          if (replaceDefault) {
            list.forEach(item => {
              if (item.productId === productId) item.isPrimary = false;
            });
          }
          list.push({ productId, barcode: trimmed, type, isPrimary: replaceDefault });
          storage.setItem('universal_billing_secondary_barcodes', JSON.stringify(list));
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database error saving barcode' };
    }
  }
};
