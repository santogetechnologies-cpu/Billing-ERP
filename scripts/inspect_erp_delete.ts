import fs from 'fs';

const txt = fs.readFileSync('src/context/ERPContext.tsx', 'utf-8');
const lines = txt.split('\n');
lines.forEach((line, i) => {
  if (line.includes('deletePurchase') || line.includes('deleteInvoice') || line.includes('purchaseService.delete')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});

