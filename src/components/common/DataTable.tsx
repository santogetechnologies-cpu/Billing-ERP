import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Columns,
  FileSpreadsheet,
  FileText,
  Printer
} from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => any;
  align?: 'left' | 'center' | 'right';
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableRef {
  exportCSV: (selectedOnly?: boolean) => void;
  exportExcel?: (selectedOnly?: boolean) => void;
  exportSelectedCSV?: () => void;
  exportSelectedExcel?: () => void;
  printTable?: () => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  filters?: {
    key: keyof T;
    label: string;
    options: { label: string; value: string }[];
  }[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  bulkActions?: (selectedRows: T[]) => React.ReactNode;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  pageSize?: number;
  title?: string;
  subtitle?: string;
  rightToolbar?: React.ReactNode;
  hideHorizontalScroll?: boolean;
  tableFixed?: boolean;
  minTableWidth?: string;
  actionsWidth?: string;
  selectable?: boolean;
  enablePagination?: boolean;
  infiniteScroll?: boolean;
  batchSize?: number;
  initialSearchTerm?: string;
  tableRef?: React.MutableRefObject<DataTableRef | null | undefined>;
  hideExport?: boolean;
  onPrint?: () => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  searchKeys = [],
  filters = [],
  onRowClick,
  actions,
  bulkActions,
  defaultSortKey,
  defaultSortDir = 'desc',
  pageSize: initialPageSize = 10,
  title,
  subtitle,
  rightToolbar,
  hideHorizontalScroll = false,
  tableFixed = false,
  minTableWidth,
  actionsWidth,
  selectable = true,
  enablePagination = true,
  infiniteScroll = false,
  batchSize = 50,
  initialSearchTerm = '',
  tableRef,
  hideExport = false,
  onPrint
}: DataTableProps<T>) {
  const effectiveActionsWidth = actionsWidth || '116px';
  const effectiveDefaultCol = defaultSortKey || columns.find(c => c.key === 'name' || c.key === 'productName')?.key || columns[0]?.key;
  const effectiveDefaultDir = defaultSortDir !== undefined
    ? defaultSortDir
    : (effectiveDefaultCol === 'name' || effectiveDefaultCol === 'productName' ? 'asc' : 'desc');

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const [sortKey, setSortKey] = useState<string | undefined>(effectiveDefaultCol);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(effectiveDefaultDir);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  // All matching records are displayed continuously on one page
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(c => c.key))
  );

  const columnKeysJoined = useMemo(() => columns.map(c => c.key).join(','), [columns]);
  useEffect(() => {
    setVisibleColumns(new Set(columns.map(c => c.key)));
  }, [columnKeysJoined]);

  // Filtered & Searched Data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Search filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matches = searchKeys.length > 0
          ? searchKeys.some(k => String(item[k] ?? '').toLowerCase().includes(query))
          : Object.values(item).some(val => String(val ?? '').toLowerCase().includes(query));
        if (!matches) return false;
      }

      // 2. Custom dropdown filters
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val && val !== 'ALL') {
          if (String(item[key]) !== val) return false;
        }
      }

      return true;
    });
  }, [data, searchTerm, searchKeys, activeFilters]);

  // Sorted Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const colDef = columns.find(c => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      const aVal = colDef?.sortValue ? colDef.sortValue(a) : a[sortKey];
      const bVal = colDef?.sortValue ? colDef.sortValue(b) : b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        const strA = String(aVal ?? '').trim();
        const strB = String(bVal ?? '').trim();
        comparison = strA.localeCompare(strB, undefined, { sensitivity: 'base', numeric: true }) || strA.localeCompare(strB, undefined, { numeric: true });
      }
      const primaryRes = sortDir === 'asc' ? comparison : -comparison;
      if (primaryRes !== 0) return primaryRes;

      // Deterministic tie-breaker: SKU first (for products), then ID
      const aSku = String(a.sku ?? a.code ?? '').trim();
      const bSku = String(b.sku ?? b.code ?? '').trim();
      if (aSku && bSku && aSku !== bSku) {
        return aSku.localeCompare(bSku, undefined, { sensitivity: 'base', numeric: true });
      }

      const aId = String(a.id ?? a.barcode ?? '');
      const bId = String(b.id ?? b.barcode ?? '');
      return aId.localeCompare(bId);
    });
  }, [filteredData, sortKey, sortDir, columns]);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close popup menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showColMenu || showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [showColMenu, showExportMenu]);

  // Clean Print Handler: Closes dropdown menus first, allows React to re-render, then opens print dialog
  const handlePrintTable = () => {
    setShowExportMenu(false);
    setShowColMenu(false);
    setTimeout(() => {
      if (onPrint) {
        onPrint();
      } else {
        window.print();
      }
    }, 150);
  };

  const isActionCol = (key: string, header?: string) => {
    const k = (key || '').toLowerCase();
    const h = (header || '').toLowerCase();
    return k === 'actions' || k === 'action' || h === 'actions' || h === 'action';
  };

  // Displayed Data: Display all matching records continuously on one single page
  const displayedData = sortedData;

  // Row selection helpers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(displayedData.map(r => r.id || JSON.stringify(r)));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRowsList = useMemo(() => {
    return data.filter(r => selectedIds.has(r.id || JSON.stringify(r)));
  }, [data, selectedIds]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Export as CSV
  const exportCSV = (selectedOnly: boolean = false) => {
    const isSelectedOnly = typeof selectedOnly === 'boolean' ? selectedOnly : false;
    const activeCols = columns.filter(c => visibleColumns.has(c.key));
    const headers = activeCols.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const targetData = isSelectedOnly
      ? data.filter(r => selectedIds.has(r.id || JSON.stringify(r)))
      : sortedData;
    const rows = targetData.map(row => {
      return activeCols
        .map(c => {
          const val = row[c.key];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Export as real XLSX Excel
  const exportExcel = (selectedOnly: boolean = false) => {
    const isSelectedOnly = typeof selectedOnly === 'boolean' ? selectedOnly : false;
    const targetData = isSelectedOnly
      ? data.filter(r => selectedIds.has(r.id || JSON.stringify(r)))
      : sortedData;

    if (targetData.length === 0) {
      alert('Please select at least one record to export.');
      return;
    }

    const activeCols = columns.filter(c => visibleColumns.has(c.key));
    const formattedData = targetData.map(row => {
      const obj: Record<string, any> = {};
      activeCols.forEach(c => {
        let val = row[c.key];
        if (val === undefined || val === null) {
          if (c.key === 'status') val = row.billPaymentStatus || row.status || '';
          else if (c.key === 'partyName') val = row.partyName || row.supplierName || '';
          else val = '';
        }
        obj[c.header] = val;
      });
      return obj;
    });

    exportToExcel(formattedData, `${title || 'export'}_${new Date().toISOString().split('T')[0]}`);
    setShowExportMenu(false);
  };

  useEffect(() => {
    if (tableRef) {
      tableRef.current = {
        exportCSV: (selectedOnly?: boolean) => exportCSV(Boolean(selectedOnly)),
        exportExcel: (selectedOnly?: boolean) => exportExcel(Boolean(selectedOnly)),
        exportSelectedCSV: () => exportCSV(true),
        exportSelectedExcel: () => exportExcel(true),
        printTable: () => handlePrintTable()
      };
    }
  });

  return (
    <div className="glass-panel overflow-hidden hover:border-slate-300/80 print:overflow-visible print:border-none print:shadow-none print:bg-white print:w-full">
      {/* Table Header & Controls Bar */}
      <div className={`p-4 border-b border-slate-100 space-y-3 ${!(title || subtitle) ? 'print:hidden no-print' : 'print:p-3 print:border-b-2 print:border-slate-300'}`}>
        {(title || rightToolbar) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {title && <h2 className="text-base font-semibold text-slate-900 print:text-lg print:font-bold">{title}</h2>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 print:text-slate-600">{subtitle}</p>}
            </div>
            {rightToolbar && <div className="flex items-center gap-2 print:hidden no-print">{rightToolbar}</div>}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden no-print">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters & Toolbar Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {filters.map(filter => (
              <div key={String(filter.key)} className="relative">
                <select
                  value={activeFilters[String(filter.key)] || 'ALL'}
                  onChange={e => {
                    setActiveFilters(prev => ({
                      ...prev,
                      [String(filter.key)]: e.target.value
                    }));
                  }}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">All {filter.label}</option>
                  {filter.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {/* Column Selector Toggle */}
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setShowColMenu(!showColMenu)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Toggle Columns"
              >
                <Columns className="w-3.5 h-3.5 text-slate-500" />
                <span>Columns</span>
              </button>

              {showColMenu && (
                <div className="absolute right-0 mt-1 w-48 glass-dropdown rounded-lg p-2 text-xs space-y-1 z-30 print:hidden no-print">
                  <div className="font-semibold text-slate-800 pb-1 border-b border-slate-100">
                    Visible Columns
                  </div>
                  {columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-slate-50 rounded">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => {
                          setVisibleColumns(prev => {
                            const next = new Set(prev);
                            if (next.has(col.key) && next.size > 1) next.delete(col.key);
                            else next.add(col.key);
                            return next;
                          });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-slate-700">{col.header}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Export Menu */}
            {!hideExport && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-40 glass-dropdown rounded-lg py-1 text-xs z-30 print:hidden no-print">
                    <button
                      onClick={() => exportCSV(false)}
                      className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => exportExcel(false)}
                      className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintTable}
                      className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>Print Table</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectable && selectedIds.size > 0 && (
          <div className="bg-blue-50/80 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-blue-900 animate-fadeIn print:hidden no-print">
            <span className="font-semibold">
              {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} selected
            </span>
            <div className="flex items-center gap-2">
              {bulkActions ? (
                bulkActions(selectedRowsList)
              ) : (
                <button
                  type="button"
                  onClick={() => exportExcel(true)}
                  className="px-2.5 py-1 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 font-medium cursor-pointer"
                >
                  Export Selected
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-blue-700 hover:text-blue-900 underline text-xs ml-2"
              >
                Deselect all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className={`min-h-[300px] w-full print:min-h-0 print:overflow-visible print:w-full print:border-none ${hideHorizontalScroll ? 'overflow-x-hidden no-scrollbar' : 'overflow-x-auto scrollbar-thin'}`}>
        <table
          style={minTableWidth ? { minWidth: minTableWidth } : undefined}
          className={`w-full min-w-full text-left text-xs text-slate-600 border-collapse print:w-full print:min-w-0 print:max-w-full print:table-auto print:text-slate-900 ${hideHorizontalScroll || tableFixed ? 'table-fixed' : ''}`}
        >
          <thead className="bg-slate-50/90 text-slate-700 border-b border-slate-200/90 uppercase font-semibold text-[11px] tracking-wider sticky top-0 z-10 backdrop-blur-xs print:static print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-300">
            <tr>
              {selectable && (
                <th
                  style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }}
                  className="w-11 min-w-[44px] max-w-[44px] px-2 py-3 text-center align-middle print:hidden no-print"
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedData.length > 0 &&
                        displayedData.every(r => selectedIds.has(r.id || JSON.stringify(r)))
                      }
                      onChange={handleSelectAll}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer align-middle"
                    />
                  </div>
                </th>
              )}
              {columns
                .filter(c => visibleColumns.has(c.key))
                .map(col => {
                  const isAction = isActionCol(col.key, col.header);
                  return (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && toggleSort(col.key)}
                      className={`${isAction ? 'print:hidden no-print' : ''} ${hideHorizontalScroll ? 'px-2.5 py-3' : 'px-2.5 sm:px-3 py-3'} font-semibold text-[11px] tracking-normal uppercase text-slate-600 select-none print:text-slate-900 print:py-2 print:px-2 print:border-b print:border-slate-300 print:min-w-0 ${
                        col.sortable !== false ? 'cursor-pointer hover:bg-slate-100/80 transition-colors' : ''
                      } ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.headerClassName || ''}`}
                      style={{
                        width: col.width,
                        minWidth: col.minWidth || (col.width && !col.width.includes('%') ? col.width : undefined),
                        maxWidth: col.maxWidth
                      }}
                    >
                      <div
                        className={`flex items-center gap-1 w-full flex-nowrap print:flex-wrap ${
                          col.align === 'right'
                            ? 'justify-end text-right'
                            : col.align === 'center'
                            ? 'justify-center text-center'
                            : 'justify-start text-left'
                        }`}
                      >
                        <span className="whitespace-nowrap leading-tight print:whitespace-normal">{col.header}</span>
                        {col.sortable !== false && (
                          <span className="text-slate-400 shrink-0 print:hidden no-print">
                            {sortKey === col.key ? (
                              sortDir === 'asc' ? (
                                <ChevronUp className="w-3 h-3 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-blue-600" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              {actions && (
                <th
                  style={{
                    width: effectiveActionsWidth,
                    minWidth: effectiveActionsWidth.endsWith('%') ? '100px' : effectiveActionsWidth
                  }}
                  className={`${hideHorizontalScroll ? 'px-2.5 py-3' : 'px-2.5 sm:px-3 py-3'} text-right align-middle font-semibold text-[11px] tracking-normal uppercase text-slate-600 whitespace-nowrap print:hidden no-print`}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal print:divide-slate-200">
            {displayedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.filter(c => visibleColumns.has(c.key)).length + (actions ? 1 : 0) + (selectable ? 1 : 0)}
                  className="py-12 text-center text-slate-400 print:text-slate-600"
                >
                  <p className="text-sm font-medium text-slate-600">No records found</p>
                  <p className="text-xs text-slate-400 mt-1 print:hidden no-print">Try adjusting your search query or filters</p>
                </td>
              </tr>
            ) : (
              displayedData.map((row, idx) => {
                const rowId = row.id || JSON.stringify(row);
                const isSelected = selectedIds.has(rowId);
                return (
                  <tr
                    key={rowId || idx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`glass-table-row transition-colors print:bg-white ${
                      isSelected ? 'bg-blue-50/50 print:bg-white' : 'hover:bg-slate-50/70'
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td
                        style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }}
                        className="w-11 min-w-[44px] max-w-[44px] px-2 py-2.5 text-center align-middle print:hidden no-print"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => handleSelectRow(rowId, e as any)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer align-middle"
                          />
                        </div>
                      </td>
                    )}
                    {columns
                      .filter(c => visibleColumns.has(c.key))
                      .map(col => {
                        const isAction = isActionCol(col.key, col.header);
                        return (
                          <td
                            key={col.key}
                            style={{
                              width: col.width,
                              minWidth: col.minWidth || (col.width && !col.width.includes('%') ? col.width : undefined),
                              maxWidth: col.maxWidth
                            }}
                            className={`${isAction ? 'print:hidden no-print' : ''} ${hideHorizontalScroll ? 'px-2.5 py-2.5' : 'px-2.5 sm:px-3 py-2.5'} text-xs text-slate-700 align-middle print:text-slate-900 print:py-2 print:px-2 print:border-b print:border-slate-200 print:min-w-0 ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            } ${col.className || ''}`}
                          >
                            {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                          </td>
                        );
                      })}
                    {actions && (
                      <td
                        style={{
                          width: effectiveActionsWidth,
                          minWidth: effectiveActionsWidth.endsWith('%') ? '100px' : effectiveActionsWidth
                        }}
                        className={`${hideHorizontalScroll ? 'px-2.5 py-2.5' : 'px-2.5 sm:px-3 py-2.5'} text-right font-medium align-middle whitespace-nowrap print:hidden no-print`}
                        onClick={e => e.stopPropagation()}
                      >
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Rows Indicator (if rows are selected) */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 print:hidden no-print">
          <span className="font-medium text-slate-700">
            {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
