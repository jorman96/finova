export function matchesClient(client: { nombres?: string; apellidos?: string; cedula?: string }, query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const text = normalize(`${client.nombres || ""} ${client.apellidos || ""} ${client.cedula || ""}`);
  return normalize(query).trim().split(/\s+/).every(word => text.includes(word));
}
