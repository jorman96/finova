export const DEFAULT_TIME_ZONE = "America/Guayaquil";
export function normalizeTimeZone(value: string | undefined) {
  try { new Intl.DateTimeFormat("en", { timeZone: value || DEFAULT_TIME_ZONE }); return value || DEFAULT_TIME_ZONE; }
  catch { return DEFAULT_TIME_ZONE; }
}
export function businessDate(date = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: normalizeTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function isOverdue(c: { fechaVencimiento: string; totalCuota: number; montoPagado?: number; estado?: string }, today = businessDate()) {
  return c.estado !== "anulada" && c.fechaVencimiento < today && Math.round(c.totalCuota * 100) > Math.round((c.montoPagado || 0) * 100);
}
export function daysOverdue(due: string, today = businessDate()) {
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000));
}
