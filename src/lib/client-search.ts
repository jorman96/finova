export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
export function matchesText(text: string, query: string) {
  const normalized = normalizeSearch(text);
  return normalizeSearch(query).split(/\s+/).every(word => normalized.includes(word));
}
export function matchesClient(client: { nombres?: string; apellidos?: string; cedula?: string; telefonoPrincipal?: string; correo?: string }, query: string) {
  return matchesText(`${client.nombres || ""} ${client.apellidos || ""} ${client.cedula || ""} ${client.telefonoPrincipal || ""} ${client.correo || ""}`, query);
}
