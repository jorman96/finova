"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function PortalLogout({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return <button disabled={loading} className="text-sm underline" onClick={async () => {
    setLoading(true);
    try { const res = await fetch("/api/portal/logout", { method: "POST" }); if (res.ok) { router.replace(`/portal/${empresaId}`); router.refresh(); } }
    finally { setLoading(false); }
  }}>{loading ? "Cerrando sesión…" : "Salir"}</button>;
}
