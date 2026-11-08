import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  User,
  Phone,
  FileText,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Search,
  Loader2,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { customerReturnService } from '../../services/customerReturnService';
import { CustomerReturnCondition, CustomerReturnStatus } from '../../types';

interface AddCustomerReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

const RETURN_PROBLEMS = [
  'Damaged Product',
  'Broken Product',
  'Defective Product',
  'Wrong Product Delivered',
  'Missing Parts',
  'Quality Issue',
  'Expired Product',
  'Other'
];

export const AddCustomerReturnModal: React.FC<AddCustomerReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { customers, products, salesInvoices, addCustomerReturn, company } = useERP();

  // Search / Lookup state for customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Form Fields - Section A: Customer Details
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState('');

  // Form Fields - Section B: Product Details
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [productPurchaseDate, setProductPurchaseDate] = useState('');
  const [purchasedQty, setPurchasedQty] = useState<number>(1);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [productUnit, setProductUnit] = useState<string>('Piece');
  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Form Fields - Section C: Return Complaint Details
  const [returnProblem, setReturnProblem] = useState<string>(RETURN_PROBLEMS[0]);
  const [complaintDescription, setComplaintDescription] = useState('');

  // Form Fields - Section D: Attach Product Photos
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Reset or initialize on modal open
  useEffect(() => {
    if (isOpen) {
      setCustomerSearch('');
      setShowCustomerDropdown(false);
      setErrorMessage('');
      setSuccessMessage('');
      setPhotos([]);

      // If customer exists, select first customer by default if available
      if (customers.length > 0) {
        const firstCust = customers[0];
        handleSelectCustomer(firstCust);
      } else {
        setSelectedCustomerId('');
        setCustomerName('Arun');
        setCustomerPhone('9876543210');
        setSelectedInvoiceId('inv-direct');
        setSelectedInvoiceNumber('INV-2026-101');
        setProductPurchaseDate('2026-11-01');
        if (products.length > 0) {
          const firstProd = products[0];
          setSelectedProductId(firstProd.id);
          setProductName(firstProd.name);
          setPurchasedQty(5);
          setReturnQty(2);
          setProductUnit(firstProd.primaryUnit || 'Piece');
          setUnitPrice(firstProd.salePrice || 50);
        }
      }
    }
  }, [isOpen, customers, products]);

  // Filtered customers for search lookup
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [customers, customerSearch]);

  // Available invoices for selected customer
  const customerInvoices = useMemo(() => {
    if (!selectedCustomerId && !customerName) return [];
    return salesInvoices.filter(
      inv => (selectedCustomerId && inv.customerId === selectedCustomerId) ||
             (customerName && inv.customerName.toLowerCase() === customerName.toLowerCase())
    );
  }, [salesInvoices, selectedCustomerId, customerName]);

  // Selected original invoice object
  const activeInvoice = useMemo(() => {
    return salesInvoices.find(inv => inv.id === selectedInvoiceId || inv.invoiceNumber === selectedInvoiceNumber);
  }, [salesInvoices, selectedInvoiceId, selectedInvoiceNumber]);

  // Products available on the selected invoice (or fallback to product catalog if no invoice items)
  const availableInvoiceProducts = useMemo(() => {
    if (activeInvoice && activeInvoice.items && activeInvoice.items.length > 0) {
      return activeInvoice.items.map(it => {
        const prod = products.find(p => p.id === it.productId);
        return {
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          unit: it.unit || prod?.primaryUnit || 'Piece',
          unitPrice: (it as any).unitPrice || it.rate || prod?.salePrice || 0
        };
      });
    }

    // If no invoice items, allow selection from products catalog
    return products.map(p => ({
      productId: p.id,
      productName: p.name,
      qty: 10,
      unit: p.primaryUnit || 'Piece',
      unitPrice: p.salePrice || 50
    }));
  }, [activeInvoice, products]);

  // Handle selecting an existing customer
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);

    // Filter customer invoices
    const matchingInvoices = salesInvoices.filter(
      inv => inv.customerId === customer.id || inv.customerName.toLowerCase() === customer.name.toLowerCase()
    );

    if (matchingInvoices.length > 0) {
      const inv = matchingInvoices[0];
      setSelectedInvoiceId(inv.id);
      setSelectedInvoiceNumber(inv.invoiceNumber);
      setProductPurchaseDate(inv.date || inv.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);

      if (inv.items && inv.items.length > 0) {
        const item = inv.items[0];
        const prod = products.find(p => p.id === item.productId);
        setSelectedProductId(item.productId);
        setProductName(item.productName);
        setPurchasedQty(item.qty || 1);
        setReturnQty(Math.min(1, item.qty || 1));
        setProductUnit(item.unit || prod?.primaryUnit || 'Piece');
        setUnitPrice((item as any).unitPrice || item.rate || prod?.salePrice || 0);
      }
    } else {
      setSelectedInvoiceId(`INV-GEN-${Date.now().toString().slice(-4)}`);
      setSelectedInvoiceNumber(`INV-2026-${Date.now().toString().slice(-4)}`);
      setProductPurchaseDate(new Date().toISOString().split('T')[0]);
      if (products.length > 0) {
        const p = products[0];
        setSelectedProductId(p.id);
        setProductName(p.name);
        setPurchasedQty(5);
        setReturnQty(1);
        setProductUnit(p.primaryUnit || 'Piece');
        setUnitPrice(p.salePrice || 50);
      }
    }
  };

  // Handle selecting an invoice
  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const inv = salesInvoices.find(i => i.id === invoiceId);
    if (inv) {
      setSelectedInvoiceNumber(inv.invoiceNumber);
      setProductPurchaseDate(inv.date || inv.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);

      if (inv.items && inv.items.length > 0) {
        const item = inv.items[0];
        const prod = products.find(p => p.id === item.productId);
        setSelectedProductId(item.productId);
        setProductName(item.productName);
        setPurchasedQty(item.qty || 1);
        setReturnQty(Math.min(1, item.qty || 1));
        setProductUnit(item.unit || prod?.primaryUnit || 'Piece');
        setUnitPrice((item as any).unitPrice || item.rate || prod?.salePrice || 0);
      }
    }
  };

  // Handle selecting a product from invoice items
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const item = availableInvoiceProducts.find(i => i.productId === productId);
    if (item) {
      setProductName(item.productName);
      setPurchasedQty(item.qty);
      setReturnQty(Math.min(1, item.qty));
      setProductUnit(item.unit);
      setUnitPrice(item.unitPrice);
    }
  };

  // Handle photo file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isValidExt = /\.(jpe?g|png|webp)$/i.test(file.name);
      return isImage || isValidExt;
    });

    if (validFiles.length < files.length) {
      setErrorMessage('Some files were ignored. Only JPG, JPEG, PNG, and WEBP images are supported.');
    }

    const newPreviews: PhotoPreview[] = validFiles.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }));

    setPhotos(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle removing a photo preview
  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  // Form submission
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Please enter or select a customer name.');
      return;
    }

    if (!selectedProductId || !productName.trim()) {
      setErrorMessage('Please select a product associated with the invoice.');
      return;
    }

    const numReturnQty = Number(returnQty);
    if (isNaN(numReturnQty) || numReturnQty <= 0) {
      setErrorMessage('Return quantity must be greater than 0.');
      return;
    }

    if (numReturnQty > purchasedQty) {
      setErrorMessage(`Return quantity (${numReturnQty}) cannot exceed purchased quantity (${purchasedQty}).`);
      return;
    }

    if (!complaintDescription.trim()) {
      setErrorMessage('Please enter the customer complaint description.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload photos to Supabase Storage (with graceful base64 fallback)
      const uploadedPhotoUrls: string[] = [];
      for (const item of photos) {
        try {
          const url = await customerReturnService.uploadReturnPhoto(item.file, company.id);
          if (url) {
            uploadedPhotoUrls.push(url);
          }
        } catch (uploadErr) {
          console.warn('Photo upload note:', uploadErr);
        }
      }

      // Map return problem to condition
      let condition: CustomerReturnCondition = 'Damaged';
      const probLower = returnProblem.toLowerCase();
      if (probLower.includes('defective')) condition = 'Defective';
      else if (probLower.includes('expired')) condition = 'Expired';
      else if (probLower.includes('wrong') || probLower.includes('quality')) condition = 'Damaged';

      const finalReturnDate = new Date().toISOString().split('T')[0];
      const finalPurchaseDate = productPurchaseDate || finalReturnDate;
      const finalInvoiceNumber = selectedInvoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      const finalInvoiceId = selectedInvoiceId || `inv-${Date.now()}`;

      // Submit return complaint with initial status 'Pending' and NO inventory modification
      const savedReturn = await addCustomerReturn({
        originalInvoiceId: finalInvoiceId,
        originalInvoiceNumber: finalInvoiceNumber,
        returnDate: finalReturnDate,
        purchaseDate: finalPurchaseDate,
        customerId: selectedCustomerId || `cust-${Date.now()}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        productId: selectedProductId,
        productName: productName.trim(),
        soldQty: purchasedQty,
        returnedQty: numReturnQty,
        unit: productUnit || 'Piece',
        unitPrice: unitPrice || 50,
        refundAmount: (unitPrice || 50) * numReturnQty,
        reason: returnProblem,
        returnProblem: returnProblem,
        complaintDescription: complaintDescription.trim(),
        photos: uploadedPhotoUrls,
        condition,
        returnStatus: 'Pending' as CustomerReturnStatus,
        directRestock: false // Inventory stock is strictly preserved; updated only after approval & physical intake
      });

      setSuccessMessage(`Customer return submitted successfully! Reference Number: ${savedReturn.returnNumber}`);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit customer return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Customer Return
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register customer return complaint with product details and photo attachments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmitReturn} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION A: Customer Details */}
          {/* ========================================================================= */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Section A: Customer Details</span>
            </div>

            {/* Customer Lookup Search */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Lookup Customer by Name or Phone
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type customer name or phone to search..."
                  value={customerSearch}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setCustomerName(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Customer Autocomplete Dropdown */}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">{cust.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{cust.phone || 'No phone'}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Customer Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Customer Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Original Invoice / Bill Number */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Original Invoice / Bill Number <span className="text-rose-500">*</span>
                </label>
                {customerInvoices.length > 0 ? (
                  <select
                    value={selectedInvoiceId}
                    onChange={e => handleSelectInvoice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    {customerInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} ({inv.date || 'No Date'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedInvoiceNumber}
                    onChange={e => {
                      setSelectedInvoiceNumber(e.target.value);
                      setSelectedInvoiceId(e.target.value);
                    }}
                    placeholder="e.g. INV-2026-101"
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION B: Product Details */}
          {/* ========================================================================= */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
              <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Section B: Product Details (From Original Invoice)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={e => handleSelectProduct(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {availableInvoiceProducts.map(item => (
                    <option key={item.productId} value={item.productId}>
                      {item.productName} (Sold: {item.qty} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product ID (Read-only / auto) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Product ID
                </label>
                <input
                  type="text"
                  value={selectedProductId}
                  readOnly
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 font-mono select-all cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Product Purchase Date */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={productPurchaseDate}
                  onChange={e => setProductPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Original Invoice # (Display) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Invoice #
                </label>
                <input
                  type="text"
                  value={selectedInvoiceNumber}
                  readOnly
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 font-mono cursor-not-allowed"
                />
              </div>

              {/* Purchased Quantity */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Purchased Qty
                </label>
                <input
                  type="number"
                  value={purchasedQty}
                  readOnly
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 font-bold font-mono cursor-not-allowed"
                />
              </div>

              {/* Return Quantity */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Return Qty <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={purchasedQty}
                  value={returnQty}
                  onChange={e => setReturnQty(Math.max(1, Math.min(purchasedQty, Number(e.target.value) || 1)))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Product Unit */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={productUnit}
                  readOnly
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION C: Return Complaint Details */}
          {/* ========================================================================= */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Section C: Return Complaint Details</span>
            </div>

            {/* Return Problem Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Return Problem <span className="text-rose-500">*</span>
              </label>
              <select
                value={returnProblem}
                onChange={e => setReturnProblem(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                {RETURN_PROBLEMS.map(prob => (
                  <option key={prob} value={prob}>
                    {prob}
                  </option>
                ))}
              </select>
            </div>

            {/* Complaint Description (Large Text Area) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Complaint Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={complaintDescription}
                onChange={e => setComplaintDescription(e.target.value)}
                placeholder="The product was damaged when the customer received it. The outer packaging was also broken."
                required
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Provide comprehensive details describing customer complaint, defect condition, or mismatch.
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION D: Attach Product Photos */}
          {/* ========================================================================= */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
                <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Section D: Attach Product Photos</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'} attached
              </span>
            </div>

            {/* Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-5 text-center cursor-pointer bg-white/60 dark:bg-slate-800/60 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                Click or drag & drop to upload product photos
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Supports JPG, JPEG, PNG, WEBP (multiple photos allowed)
              </p>
            </div>

            {/* Photos Preview Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {photos.map(p => (
                  <div
                    key={p.id}
                    className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs"
                  >
                    <div className="aspect-square w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                      <img
                        src={p.previewUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate" title={p.name}>
                        {p.name}
                      </p>
                      <span className="text-[9px] text-slate-400">
                        {(p.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    {/* Remove Photo Button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(p.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Return...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Return</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
