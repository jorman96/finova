"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
const sections = ["dashboard", "clientes", "prestamos", "pagos", "mora", "inversionistas", "reportes", "configuracion", "seguridad", "master"];
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [reference] = useState(() => crypto.randomUUID());
  const pathname = usePathname();
  useEffect(() => {
    const section = pathname.split("/")[1];
    void apiPost("/api/security/events", { reference, event: "application_error", section: sections.includes(section) ? section : "other" }).catch(() => {});
  }, [pathname, reference]);
  return <main className="space-y-4 p-8"><h2>No se pudo cargar esta sección</h2><p>Intenta nuevamente. Si el problema continúa, comunica esta referencia al administrador: {reference}.</p><Button onClick={retry}>Reintentar</Button></main>;
}
