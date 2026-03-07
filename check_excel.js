import * as XLSX from 'xlsx';
try {
  const wb = XLSX.readFile('./employees.xlsx');
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('Employees in Excel file:');
  console.log(JSON.stringify(data, null, 2));
  console.log(`Total: ${data.length}`);
} catch(e) {
  console.error('Error reading file:', e.message);
}
