import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
test('Excel export round-trips amounts and preserves user text as text', async () => {
  const wb=new ExcelJS.Workbook(), sheet=wb.addWorksheet('Cobros');
  sheet.columns=[{header:'Monto',key:'monto'},{header:'Cliente',key:'cliente'}];
  sheet.addRows([{monto:123.45,cliente:'Cliente Prueba'},{monto:5,cliente:'=HYPERLINK("https://example.test")'}]);
  const buffer=await wb.xlsx.writeBuffer();
  const read=new ExcelJS.Workbook();await read.xlsx.load(buffer);
  assert.equal(read.getWorksheet('Cobros').getCell('A2').value,123.45);
  assert.equal(read.getWorksheet('Cobros').getCell('B3').type,ExcelJS.ValueType.String);
});
test('the report dynamic import uses the CommonJS default export', async () => {
  const loaded = await import('exceljs');
  assert.equal(typeof loaded.default.Workbook, 'function');
  const book = new loaded.default.Workbook();
  assert.ok(book.addWorksheet('Resumen'));
});
