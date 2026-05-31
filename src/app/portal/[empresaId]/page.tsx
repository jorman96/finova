import { adminDb } from "@/lib/firebase-admin";
import { PortalLoginForm } from "./PortalLoginForm";
import { notFound } from "next/navigation";

export default async function PortalPage({ params }: { params: Promise<{ empresaId: string }> }) {
  const resolvedParams = await params;
  const { empresaId } = resolvedParams;

  const empresaSnap = await adminDb.collection("empresas").doc(empresaId).get();

  if (!empresaSnap.exists) {
    notFound();
  }

  const empresaData = empresaSnap.data() as any;

  if (empresaData.estado !== 'activa') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">Portal Suspendido</h1>
          <p className="text-muted-foreground">Esta institución no se encuentra activa en el momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden border">
        <div className="p-8 text-center bg-muted/30 border-b">
          {empresaData.logoUrl ? (
            <img src={empresaData.logoUrl} alt={empresaData.nombre} className="h-20 object-contain mx-auto mb-4" />
          ) : (
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-primary">{empresaData.nombre.charAt(0)}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold">{empresaData.nombre}</h1>
          <p className="text-muted-foreground mt-2">Portal de Autogestión</p>
        </div>
        
        <div className="p-8">
          <PortalLoginForm empresaId={empresaId} />
        </div>
      </div>
    </div>
  );
}
