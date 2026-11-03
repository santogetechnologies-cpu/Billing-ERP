import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Tag,
  Check,
  Trash2,
  MoreVertical,
  Edit2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Modal } from '../common/Modal';

export const ProductCategoriesTab: React.FC = () => {
  const {
    products,
    updateProduct,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory
  } = useERP();

  const [newCatName, setNewCatName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active three-dot menu card name
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Edit Modal State
  const [categoryToEdit, setCategoryToEdit] = useState<{
    name: string;
    isDefault: boolean;
    desc?: string;
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Modal State
  const [categoryToDelete, setCategoryToDelete] = useState<{
    name: string;
    isDefault: boolean;
    count: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Persistent category descriptions & details
  const [categoryDescriptions, setCategoryDescriptions] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('universal_billing_category_details');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group products by category count
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const defaultCategories = [
    { name: 'General', desc: 'Standard retail products' },
    { name: 'Pharmacy', desc: 'Medicines, strips, tablets, syrups' },
    { name: 'Groceries', desc: 'Loose grains, packaged food, vegetables' },
    { name: 'Clothing', desc: 'Apparel, textiles, footwear' },
    { name: 'Electronics', desc: 'Phones, appliances, computers' },
    { name: 'Hardware', desc: 'Pipes, nails, tools, tiles, plywood' },
    { name: 'Automotive', desc: 'Vehicles, spare parts, tires, batteries' },
    { name: 'Services', desc: 'Installation, repair, consultations' }
  ];

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAdding(true);
    try {
      await addCustomCategory(newCatName.trim());
      setNewCatName('');
      setToastMessage(`Category "${newCatName.trim()}" created successfully.`);
    } catch (err: any) {
      console.error(err);
      setToastMessage(err?.message || 'Failed to create category.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenEdit = (category: { name: string; isDefault: boolean; desc?: string }) => {
    setActiveMenu(null);
    setCategoryToEdit(category);
    setEditName(category.name);
    setEditDesc(categoryDescriptions[category.name] || category.desc || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit) return;

    const trimmedNewName = editName.trim();
    if (!trimmedNewName) {
      setEditError('Category name cannot be empty.');
      return;
    }

    const oldName = categoryToEdit.name;
    const isNameChanged = trimmedNewName.toLowerCase() !== oldName.toLowerCase();

    // Check duplicate if name changed
    if (isNameChanged) {
      const allExisting = [
        ...defaultCategories.map(c => c.name.toLowerCase()),
        ...(customCategories || []).map(c => c.toLowerCase())
      ];
      if (allExisting.includes(trimmedNewName.toLowerCase())) {
        setEditError(`Category "${trimmedNewName}" already exists.`);
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      if (isNameChanged) {
        if (categoryToEdit.isDefault) {
          // If default category was renamed, add as custom category and reassign all products
          await addCustomCategory(trimmedNewName);
          const matchingProds = products.filter(p => p.category.toLowerCase() === oldName.toLowerCase());
          for (const p of matchingProds) {
            await updateProduct(p.id, { category: trimmedNewName });
          }
        } else {
          // Update custom category
          if (updateCustomCategory) {
            await updateCustomCategory(oldName, trimmedNewName);
          }
        }
      }

      // Save description / details in persistent store
      setCategoryDescriptions(prev => {
        const next = { ...prev, [trimmedNewName]: editDesc.trim() };
        if (isNameChanged && oldName !== trimmedNewName) {
          delete next[oldName];
        }
        try {
          localStorage.setItem('universal_billing_category_details', JSON.stringify(next));
        } catch {}
        return next;
      });

      setToastMessage(`Category "${trimmedNewName}" updated successfully.`);
      setCategoryToEdit(null);
    } catch (err: any) {
      console.error(err);
      setEditError(err?.message || 'Failed to update category.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenDelete = (category: { name: string; isDefault: boolean; count: number }) => {
    setActiveMenu(null);
    setCategoryToDelete(category);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      if (deleteCustomCategory) {
        await deleteCustomCategory(categoryToDelete.name);
      }
      setCategoryDescriptions(prev => {
        const next = { ...prev };
        delete next[categoryToDelete.name];
        try {
          localStorage.setItem('universal_billing_category_details', JSON.stringify(next));
        } catch {}
        return next;
      });
      setToastMessage(`Category "${categoryToDelete.name}" deleted successfully.`);
      setCategoryToDelete(null);
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Failed to delete category: ${err?.message || 'Error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderCardMenu = (cat: { name: string; isDefault: boolean; desc?: string }, count: number) => {
    const isMenuOpen = activeMenu === cat.name;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(isMenuOpen ? null : cat.name);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="More options"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-30 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleOpenEdit(cat)}
              className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Category</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenDelete({ ...cat, count })}
              className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-700/60"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Delete Category</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Creation Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Product Categories</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organize products across departments and configure default tax & unit rules.
          </p>
        </div>

        <form onSubmit={handleCreateCategory} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="New category name..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
          />
          <button
            type="submit"
            disabled={isAdding || !newCatName.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {defaultCategories.map(cat => {
          const count = categoryCounts[cat.name] || 0;
          const displayDesc = categoryDescriptions[cat.name] || cat.desc;
          return (
            <div
              key={cat.name}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                    {renderCardMenu({ name: cat.name, isDefault: true, desc: cat.desc }, count)}
                  </div>
                </div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mt-2.5">{cat.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{displayDesc}</p>
              </div>
            </div>
          );
        })}

        {customCategories?.map(catName => {
          const count = categoryCounts[catName] || 0;
          const displayDesc = categoryDescriptions[catName] || 'Custom category';
          return (
            <div
              key={catName}
              className="p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                    {renderCardMenu({ name: catName, isDefault: false }, count)}
                  </div>
                </div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mt-2.5">{catName}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{displayDesc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Category Modal */}
      <Modal
        isOpen={Boolean(categoryToEdit)}
        onClose={() => {
          setCategoryToEdit(null);
          setEditError(null);
        }}
        title="Edit Category"
        subtitle={`Update category name and department details`}
        size="sm"
      >
        {categoryToEdit && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => {
                  setEditName(e.target.value);
                  setEditError(null);
                }}
                disabled={isSavingEdit}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter category name..."
              />
              {categoryToEdit.isDefault && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Default system category. Updating the name will also reassign existing products to the new name.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description & Department Details
              </label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                disabled={isSavingEdit}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Category description, storage rules, or notes..."
              />
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCategoryToEdit(null);
                  setEditError(null);
                }}
                disabled={isSavingEdit}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || !editName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete / Prevention Modal */}
      <Modal
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        title={
          categoryToDelete?.isDefault
            ? 'Default Category'
            : categoryToDelete && categoryToDelete.count > 0
            ? 'Cannot Delete Category'
            : 'Delete Category'
        }
        size="sm"
      >
        {categoryToDelete && (
          <div className="space-y-4">
            {categoryToDelete.isDefault ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">System Category Cannot Be Deleted</p>
                    <p>
                      <strong>"{categoryToDelete.name}"</strong> is a core default system category. Deletion is only allowed for custom-created categories.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : categoryToDelete.count > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">Products Assigned to this Category</p>
                    <p>
                      There {categoryToDelete.count === 1 ? 'is' : 'are'}{' '}
                      <strong>{categoryToDelete.count} product{categoryToDelete.count === 1 ? '' : 's'}</strong>{' '}
                      assigned to <strong>"{categoryToDelete.name}"</strong>.
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                      Please reassign these products to another category before deleting. Associated products are never deleted automatically to protect your inventory data.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Are you sure you want to delete the custom category{' '}
                  <strong className="text-slate-900 dark:text-white">"{categoryToDelete.name}"</strong>?
                  This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? 'Deleting...' : 'Delete Category'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
