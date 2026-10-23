import * as XLSX from 'xlsx';

export const exportToExcel = (data: Record<string, any>[], fileName: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, finalFileName);
};

export const exportToCSV = (data: Record<string, any>[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const finalFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  link.setAttribute('download', finalFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
