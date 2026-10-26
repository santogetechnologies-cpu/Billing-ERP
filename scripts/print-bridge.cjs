/**
 * Universal Billing - Local Direct Print Bridge Service
 * 
 * Standalone, zero-dependency Node.js HTTP bridge for direct silent printing
 * of POS receipts and barcode label stickers to local Windows/Linux/macOS printers.
 *
 * Runs locally on http://127.0.0.1:9191
 */

const http = require('http');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PRINT_BRIDGE_PORT || '9191', 10);
const HOST = '127.0.0.1';
const VERSION = '1.0.0';

// Temporary directory for print spool files
const SPOOL_DIR = path.join(os.tmpdir(), 'universal-billing-print-spool');
if (!fs.existsSync(SPOOL_DIR)) {
  try {
    fs.mkdirSync(SPOOL_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create spool directory:', err);
  }
}

/**
 * Query installed OS printers
 */
function getSystemPrinters() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psCommand = 'Get-Printer | Select-Object Name, PortName, DriverName, Default | ConvertTo-Json -Compress';
      execFile('powershell', ['-NoProfile', '-Command', psCommand], { timeout: 4000 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          // Fallback via wmic or standard defaults
          exec('wmic printer get name /format:csv', { timeout: 3000 }, (wErr, wStdout) => {
            if (wErr || !wStdout) {
              return resolve([
                { name: 'POS-80 (Default Thermal Receipt)', isDefault: true, port: 'USB001' },
                { name: 'TSC Barcode Printer (Label)', isDefault: false, port: 'USB002' },
                { name: 'Microsoft Print to PDF', isDefault: false, port: 'PORTPROMPT:' }
              ]);
            }
            const lines = wStdout.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.toLowerCase().includes('node,name'));
            const printers = lines.map(l => {
              const parts = l.split(',');
              const name = parts[parts.length - 1]?.trim() || l;
              return { name, isDefault: false, port: '' };
            }).filter(p => p.name);
            resolve(printers.length > 0 ? printers : [{ name: 'Default Printer', isDefault: true, port: '' }]);
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const printers = list.map(p => ({
            name: p.Name || '',
            isDefault: Boolean(p.Default),
            port: p.PortName || '',
            driver: p.DriverName || ''
          })).filter(p => p.name);
          resolve(printers);
        } catch {
          resolve([{ name: 'Default Printer', isDefault: true, port: '' }]);
        }
      });
    } else {
      // Unix / macOS via lpstat
      exec('lpstat -a', { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout) {
          return resolve([{ name: 'Generic Receipt Printer', isDefault: true, port: 'cups' }]);
        }
        const printers = stdout.split('\n')
          .map(l => l.split(' ')[0]?.trim())
          .filter(Boolean)
          .map((name, idx) => ({ name, isDefault: idx === 0, port: 'cups' }));
        resolve(printers);
      });
    }
  });
}

/**
 * Send raw or text content to a local printer
 */
function sendToPrinter(printerName, content, options = {}) {
  return new Promise(async (resolve) => {
    const copies = Math.max(1, parseInt(options.copies || '1', 10));
    const title = options.title || 'Universal Billing Document';
    const filename = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`;
    const filePath = path.join(SPOOL_DIR, filename);

    try {
      fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
    } catch (writeErr) {
      return resolve({
        success: false,
        error: `Failed to write print spool file: ${writeErr.message}`
      });
    }

    // Determine effective target printer
    let effectivePrinter = (printerName || '').trim();
    if (!effectivePrinter || effectivePrinter.toLowerCase() === 'default' || effectivePrinter === 'Windows Default') {
      try {
        const sysPrinters = await getSystemPrinters();
        const def = sysPrinters.find(p => p.isDefault) || sysPrinters.find(p => p.port !== 'PORTPROMPT:') || sysPrinters[0];
        if (def && def.name) {
          effectivePrinter = def.name;
        }
      } catch {}
    }

    if (process.platform === 'win32') {
      // On Windows, use Out-Printer or raw spool command
      let targetPrinterArg = '';
      if (effectivePrinter) {
        targetPrinterArg = `-Name "${effectivePrinter.replace(/"/g, '`"')}"`;
      }

      // Print copies
      let completedCopies = 0;
      let lastError = null;

      const printSingleCopy = (idx) => {
        if (idx >= copies) {
          // Cleanup spool file after small delay
          setTimeout(() => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
          }, 3000);

          if (completedCopies > 0) {
            return resolve({
              success: true,
              copiesPrinted: completedCopies,
              printer: effectivePrinter || 'Windows Default',
              message: `Job printed successfully (${completedCopies} copy/copies to "${effectivePrinter || 'default printer'}").`
            });
          } else {
            return resolve({
              success: false,
              printer: effectivePrinter,
              error: lastError || 'Print command failed on Windows spooler.'
            });
          }
        }

        const psScript = `Get-Content -Raw -Encoding utf8 "${filePath.replace(/"/g, '`"')}" | Out-Printer ${targetPrinterArg}`;
        execFile('powershell', ['-NoProfile', '-Command', psScript], { timeout: 8000 }, (err, stdout, stderr) => {
          if (err) {
            lastError = stderr || err.message;
            console.error(`[Print Bridge Error Copy ${idx + 1}]:`, err.message);
          } else {
            completedCopies++;
          }
          printSingleCopy(idx + 1);
        });
      };

      printSingleCopy(0);
    } else {
      // Linux / macOS via lp
      const lpTarget = printerName ? `-d "${printerName}"` : '';
      const lpCmd = `lp -n ${copies} -t "${title}" ${lpTarget} "${filePath}"`;

      exec(lpCmd, { timeout: 5000 }, (err, stdout, stderr) => {
        setTimeout(() => {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
        }, 3000);

        if (err) {
          return resolve({
            success: false,
            error: stderr || err.message
          });
        }
        resolve({
          success: true,
          copiesPrinted: copies,
          printer: printerName || 'Default',
          message: `Job sent to printer: ${stdout.trim() || 'OK'}`
        });
      });
    }
  });
}

/**
 * Handle incoming HTTP requests
 */
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health / Status Check
  if (pathname === '/health' || pathname === '/status' || pathname === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'online',
      service: 'Universal Billing Local Direct Print Bridge',
      version: VERSION,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. Discover OS Installed Printers
  if (pathname === '/printers' && req.method === 'GET') {
    getSystemPrinters().then(printers => {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        count: printers.length,
        printers
      }));
    }).catch(err => {
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: err.message,
        printers: []
      }));
    });
    return;
  }

  // Helper to read JSON request body
  const readJsonBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });

  // 3. Direct Print Job (/print)
  if (pathname === '/print' && req.method === 'POST') {
    readJsonBody().then(payload => {
      const { printerName, content, rawContent, jobType, copies, title } = payload;
      const textToPrint = content || rawContent;

      if (!textToPrint) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Missing print content (payload.content is required).'
        }));
        return;
      }

      console.log(`[Print Bridge Job] Type: ${jobType || 'text'}, Printer: "${printerName || 'Default'}", Copies: ${copies || 1}`);

      sendToPrinter(printerName, textToPrint, {
        copies: copies || 1,
        title: title || `Universal Billing ${jobType || 'Print'} Job`
      }).then(result => {
        res.writeHead(result.success ? 200 : 500);
        res.end(JSON.stringify(result));
      });
    }).catch(err => {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // 4. Test Print (/test)
  if (pathname === '/test' && req.method === 'POST') {
    readJsonBody().then(payload => {
      const { printerName, testType, paperSize, widthMm, heightMm } = payload;
      const nowStr = new Date().toLocaleString();

      let testContent = '';
      if (testType === 'barcode') {
        const w = widthMm || 50;
        const h = heightMm || 25;
        testContent = [
          '========================================',
          '    UNIVERSAL BILLING - TEST LABEL     ',
          '========================================',
          `Format: Barcode Sticker (${w} x ${h} mm)`,
          `Printer: ${printerName || 'Default'}`,
          `Timestamp: ${nowStr}`,
          '----------------------------------------',
          'Product: Wireless Ergonomic Mouse Pro',
          'SKU:     PRD-WMS-001',
          'Price:   Rs. 899.00  |  MRP: Rs. 1,299.00',
          '----------------------------------------',
          'Barcode: |||||| |||| ||||||| ||||||||||',
          '         8901234567890 (CODE-128)      ',
          '----------------------------------------',
          'STATUS: DIRECT PRINT BRIDGE OPERATIONAL',
          '========================================',
          '\n\n\n'
        ].join('\r\n');
      } else {
        const size = paperSize || '80mm';
        const lineLen = size === '58mm' ? 32 : 48;
        const sep = '='.repeat(lineLen);
        const dash = '-'.repeat(lineLen);

        testContent = [
          sep,
          '           UNIVERSAL BILLING            ',
          '        DIRECT RECEIPT TEST PAGE        ',
          sep,
          `Printer:    ${printerName || 'Default Printer'}`,
          `Paper Size: ${size}`,
          `Date/Time:  ${nowStr}`,
          dash,
          'Item                     Qty     Amount ',
          dash,
          'Test Thermal Print Line    1       0.00 ',
          'Hardware Spooler Test      1       0.00 ',
          dash,
          'TOTAL:                             0.00 ',
          dash,
          'STATUS: DIRECT RECEIPT PRINTING READY!  ',
          'Direct Silent Print Bridge v' + VERSION,
          sep,
          '\n\n\n\x1dV\x41\x00' // Paper cut command
        ].join('\r\n');
      }

      sendToPrinter(printerName, testContent, { copies: 1, title: 'Print Bridge Test Page' }).then(result => {
        res.writeHead(result.success ? 200 : 500);
        res.end(JSON.stringify(result));
      });
    }).catch(err => {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // Not found
  res.writeHead(404);
  res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n============================================================`);
  console.log(`Universal Billing Direct Print Bridge v${VERSION} running!`);
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Spooling jobs to system printers via OS spooler.`);
  console.log(`Press Ctrl+C to stop.`);
  console.log(`============================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use by another instance of print-bridge.`);
  } else {
    console.error('Print bridge server error:', err);
  }
});
