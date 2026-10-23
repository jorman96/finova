import type { Workbook } from "exceljs";
export function appendRows(workbook: Workbook, name: string, rows: Record<string, string | number | undefined>[]) {
  const sheet = workbook.addWorksheet(name);
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  sheet.columns = keys.map(key => ({ header: key, key, width: 24 }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
export async function downloadWorkbook(workbook: Workbook, name: string) {
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(data).buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
