import React, { useState, useEffect, useId } from 'react';
import {
  Printer,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  FileText,
  ScanBarcode,
  Save,
  HelpCircle,
  ExternalLink,
  Laptop,
  Check,
  X,
  Play,
  Copy
} from 'lucide-react';
import {
  directPrintService,
  PrinterConfig,
  ReceiptPaperSize
} from '../../services/directPrintService';

interface PrinterSettingsSectionProps {
  onSaved?: () => void;
}

const PRESET_LABEL_SIZES = [
  { name: '50 x 25 mm (Standard Retail Tag)', width: 50, height: 25 },
  { name: '38 x 25 mm (Jewelry / Small Item)', width: 38, height: 25 },
  { name: '50 x 30 mm (Shelf Edge / MRP Label)', width: 50, height: 30 },
  { name: '75 x 50 mm (Box / Carton Sticker)', width: 75, height: 50 },
  { name: '100 x 50 mm (Warehouse Bin Tag)', width: 100, height: 50 }
];

export const PrinterSettingsSection: React.FC<PrinterSettingsSectionProps> = ({ onSaved }) => {
  const [config, setConfig] = useState<PrinterConfig>(() => directPrintService.getConfig());
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean; port?: string }[]>([]);
  const [bridgeStatus, setBridgeStatus] = useState<{ online: boolean; version?: string; error?: string }>({
    online: false
  });
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [testingBill, setTestingBill] = useState(false);
  const [testingBarcode, setTestingBarcode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Load printer list and check bridge status
  const checkStatusAndPrinters = async () => {
    setCheckingBridge(true);
    try {
      const status = await directPrintService.checkBridgeStatus(config.bridgeUrl);
      setBridgeStatus(status);
      if (status.online) {
        const found = await directPrintService.getInstalledPrinters();
        setPrinters(found);
      } else {
        setPrinters([]);
      }
    } finally {
      setCheckingBridge(false);
    }
  };

  useEffect(() => {
    checkStatusAndPrinters();
  }, []);

  const handleSave = () => {
    const saved = directPrintService.saveConfig(config);
    setConfig(saved);
    setFeedback({
      type: 'success',
      message: 'Printer hardware preferences saved successfully.'
    });
    setTimeout(() => setFeedback(null), 3500);
    if (onSaved) onSaved();
  };

  const handleTestBill = async () => {
    setTestingBill(true);
    setFeedback(null);
    try {
      const res = await directPrintService.testPrintBill(config.billPrinterName, config.billPaperSize);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Test receipt successfully spooled to printer!'
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || res.error || 'Failed to send test bill to printer.'
        });
      }
    } finally {
      setTestingBill(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleTestBarcode = async () => {
    setTestingBarcode(true);
    setFeedback(null);
    try {
      const res = await directPrintService.testPrintBarcode(
        config.barcodePrinterName,
        config.barcodeLabelWidthMm,
        config.barcodeLabelHeightMm
      );
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Test barcode sticker successfully spooled to label printer!'
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || res.error || 'Failed to send test barcode to label printer.'
        });
      }
    } finally {
      setTestingBarcode(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const copyCommand = () => {
    navigator.clipboard?.writeText('npm run print-bridge');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6 text-xs text-slate-700">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold text-xs">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Card 1: Bridge Connection & Direct Print Status */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Direct Silent Printing & Hardware Service
              </h2>
              <p className="text-xs text-slate-500">
                Send POS receipt bills and barcode stickers directly to physical printers without browser preview dialogs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkStatusAndPrinters}
              disabled={checkingBridge}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Ping print service"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingBridge ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSetupModal(true)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Setup Guide</span>
            </button>
          </div>
        </div>

        {/* Status Indicator Bar */}
        <div className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                bridgeStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  {bridgeStatus.online
                    ? `Print Bridge Online (v${bridgeStatus.version || '1.0.0'})`
                    : 'Print Bridge Offline'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    bridgeStatus.online
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {bridgeStatus.online ? 'Connected' : 'Browser Fallback Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {bridgeStatus.online
                  ? `Listening on ${config.bridgeUrl}. ${printers.length} local printer(s) discovered.`
                  : 'Start the local bridge (npm run print-bridge) to enable silent direct printing. Currently falling back to browser print dialog.'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300">
            <input
              type="checkbox"
              id="toggle-direct-print"
              checked={config.directPrintEnabled}
              onChange={e => setConfig({ ...config, directPrintEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="font-bold text-slate-900 text-xs select-none">
              Enable Direct Silent Printing
            </span>
          </label>
        </div>
      </div>

      {/* Grid: Bill Printer & Barcode Label Printer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 2: Bill / Receipt Printer */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Bill & Receipt Printer
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">58mm / 80mm / A4</span>
            </div>

            {/* Printer Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Receipt Printer Hardware
              </label>
              {printers.length > 0 ? (
                <select
                  value={config.billPrinterName}
                  onChange={e => setConfig({ ...config, billPrinterName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="">— Windows Default System Printer —</option>
                  {printers.map((p, idx) => (
                    <option key={idx} value={p.name}>
                      {p.name} {p.isDefault ? '(Default)' : ''} {p.port ? `[${p.port}]` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. POS-80, EPSON TM-T82, Thermal-Receipt"
                  value={config.billPrinterName}
                  onChange={e => setConfig({ ...config, billPrinterName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Select your USB, Bluetooth, or LAN receipt printer. Leave blank for default.
              </p>
            </div>

            {/* Paper Size */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Receipt Paper Width
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['58mm', '80mm', 'A4'] as ReceiptPaperSize[]).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setConfig({ ...config, billPaperSize: size })}
                    className={`py-2 px-2 rounded-lg border font-semibold text-center transition-all cursor-pointer ${
                      config.billPaperSize === size
                        ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {size === '58mm' ? '58 mm (2" Roll)' : size === '80mm' ? '80 mm (3" POS)' : 'A4 Full Sheet'}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Print on Save */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={config.autoPrintOnSave}
                onChange={e => setConfig({ ...config, autoPrintOnSave: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="font-medium text-slate-700">
                Automatically send bill to receipt printer immediately after saving invoice
              </span>
            </label>
          </div>

          {/* Test Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Verify receipt paper feed & alignment:
            </span>
            <button
              type="button"
              id="btn-test-bill-print"
              disabled={testingBill || !bridgeStatus.online}
              onClick={handleTestBill}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{testingBill ? 'Spooled...' : 'Print Test Bill'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Barcode Label Sticker Printer */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScanBarcode className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Barcode Label Printer
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">TSC / Zebra / Thermal</span>
            </div>

            {/* Label Printer Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Label Printer Hardware
              </label>
              {printers.length > 0 ? (
                <select
                  value={config.barcodePrinterName}
                  onChange={e => setConfig({ ...config, barcodePrinterName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="">— Windows Default System Printer —</option>
                  {printers.map((p, idx) => (
                    <option key={idx} value={p.name}>
                      {p.name} {p.isDefault ? '(Default)' : ''} {p.port ? `[${p.port}]` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. TSC TE244, Zebra ZD220, Xprinter XP-365B"
                  value={config.barcodePrinterName}
                  onChange={e => setConfig({ ...config, barcodePrinterName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Select your thermal sticker/label printer. Leave blank for default.
              </p>
            </div>

            {/* Label Dimension Presets */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Label Sticker Dimension (Width x Height)
              </label>
              <select
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom') return;
                  const [w, h] = val.split('x').map(n => parseInt(n, 10));
                  setConfig({ ...config, barcodeLabelWidthMm: w, barcodeLabelHeightMm: h });
                }}
                value={`${config.barcodeLabelWidthMm}x${config.barcodeLabelHeightMm}`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium mb-2"
              >
                {PRESET_LABEL_SIZES.map((preset, idx) => (
                  <option key={idx} value={`${preset.width}x${preset.height}`}>
                    {preset.name}
                  </option>
                ))}
                <option value="custom">Custom Dimensions (Enter below)</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Width (mm)</label>
                  <input
                    type="number"
                    min="15"
                    max="150"
                    value={config.barcodeLabelWidthMm}
                    onChange={e => setConfig({ ...config, barcodeLabelWidthMm: parseInt(e.target.value, 10) || 50 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Height (mm)</label>
                  <input
                    type="number"
                    min="10"
                    max="150"
                    value={config.barcodeLabelHeightMm}
                    onChange={e => setConfig({ ...config, barcodeLabelHeightMm: parseInt(e.target.value, 10) || 25 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Default copies count */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Copy Count per Product
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.defaultCopies}
                onChange={e => setConfig({ ...config, defaultCopies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          {/* Test Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Verify barcode clarity & scan readiness:
            </span>
            <button
              type="button"
              id="btn-test-barcode-print"
              disabled={testingBarcode || !bridgeStatus.online}
              onClick={handleTestBarcode}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>{testingBarcode ? 'Spooled...' : 'Print Test Label'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Advanced Options & Save Action */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
          Reliability & Fallback Behavior
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={config.fallbackToBrowserPrint}
              onChange={e => setConfig({ ...config, fallbackToBrowserPrint: e.target.checked })}
              className="mt-0.5 rounded text-blue-600"
            />
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                Automatic Browser Print Fallback
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                If the local print bridge is closed or the physical printer is offline, automatically open the standard browser print dialog so counter billing is never interrupted.
              </p>
            </div>
          </label>

          <div className="p-3 rounded-lg border border-slate-200 space-y-1.5">
            <label className="block font-bold text-slate-900 text-xs">
              Bridge Server Endpoint URL
            </label>
            <input
              type="text"
              value={config.bridgeUrl}
              onChange={e => setConfig({ ...config, bridgeUrl: e.target.value })}
              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md font-mono"
              placeholder="http://127.0.0.1:9191"
            />
            <p className="text-[10px] text-slate-400">
              Default is http://127.0.0.1:9191. Change only if running bridge on another port or workstation.
            </p>
          </div>
        </div>

        {/* Global Save Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            id="btn-save-printer-config"
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Printer Configuration</span>
          </button>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Local Print Bridge Setup Guide
                </h3>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Standard web browsers do not allow web pages to access physical USB/LPT printers silently without opening the browser's print dialog. The <strong>Universal Billing Print Bridge</strong> is a lightweight local service that runs on your counter computer to communicate directly with your thermal receipt and barcode printers.
              </p>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 1: Start the Local Bridge
                </h4>
                <p className="text-slate-500">Run this command in terminal or command prompt inside the project folder:</p>
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] flex items-center justify-between gap-2">
                  <span>npm run print-bridge</span>
                  <button
                    onClick={copyCommand}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    title="Copy command"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Or on Windows, double-click: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">scripts\start-print-bridge.bat</code>
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 2: Refresh Connection
                </h4>
                <p className="text-slate-500">
                  Once the bridge is running, click the <strong>Refresh Status</strong> button on this page. The status will turn green to confirm your receipt and barcode printers are discovered.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 3: Test Printing
                </h4>
                <p className="text-slate-500">
                  Click <strong>Print Test Bill</strong> or <strong>Print Test Label</strong> to verify your physical printer feeds and cuts properly.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
