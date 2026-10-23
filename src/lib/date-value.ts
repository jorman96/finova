export function dateValue(value: unknown): Date | undefined {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") date = value.toDate();
  else if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  else return undefined;
  return Number.isNaN(date.getTime()) ? undefined : date;
}
