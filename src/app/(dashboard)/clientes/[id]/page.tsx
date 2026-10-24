"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, use } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion, query, collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Cliente } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, CreditCard, UploadCloud, Loader2, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadFileToStorage } from "@/lib/storage";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScoreGauge } from "@/components/clientes/ScoreGauge";
import { EditarClienteDialog } from '@/components/clientes/EditarClienteDialog';
import { NuevoPrestamoDialog } from '@/components/prestamos/NuevoPrestamoDialog';
import { managers } from '@/lib/permissions';
import { apiPost } from '@/lib/api-client';
import { LoadError } from '@/components/ListPagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { userData } = useAuth();
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [openScoreDialog, setOpenScoreDialog] = useState(false);
  const [newScore, setNewScore] = useState(50);
  const [scoreReason, setScoreReason] = useState(''), [scoreBusy, setScoreBusy] = useState(false), [loadError, setLoadError] = useState('');
  const router = useRouter();

  const handleUpdateScore = async () => {
    if (!Number.isInteger(newScore) || newScore < 0 || newScore > 100 || scoreReason.trim().length < 10) { toast.error('Indica un valor entero entre 0 y 100 y un motivo de al menos 10 caracteres.'); return; }
    setScoreBusy(true);
    try {
      await apiPost('/api/clientes/score', { clienteId: id, score: newScore, motivo: scoreReason });
      toast.success("Score actualizado correctamente");
      setOpenScoreDialog(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el indicador.'); }
    finally { setScoreBusy(false); }
  };

  useEffect(() => {
    if (!userData?.empresaId) return;
    const docRef = doc(db, "clientes", id);
    const unsubscribeCliente = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCliente({ id: docSnap.id, ...docSnap.data() } as Cliente);
      } else {
        router.push("/clientes");
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoadError('No se pudo cargar el expediente del cliente.');
      setLoading(false);
    });

    const qPrestamos = query(collection(db, "prestamos"), where("empresaId", "==", userData.empresaId), where("clienteId", "==", id));
    const unsubscribePrestamos = onSnapshot(qPrestamos, (snap) => {
      setPrestamos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setLoadError('No se pudo cargar el historial de créditos. El resumen puede estar incompleto.'));

    return () => {
      unsubscribeCliente();
      unsubscribePrestamos();
    };
  }, [id, router, userData?.empresaId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `clientes/${id}/documentos/${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFileToStorage(file, path, (progress) => {
        setUploadProgress(progress);
      });

      // Update Firestore with the new document URL
      const docRef = doc(db, "clientes", id);
      await updateDoc(docRef, {
        documentos: arrayUnion({
          nombre: file.name,
          url: downloadUrl
        })
      });

      toast.success("Documento subido correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al subir el documento");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = ''; // Reset input
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando perfil del cliente...</div>;
  if (!cliente) return loadError ? <LoadError message={loadError} /> : null;

  return (
    <div className="space-y-6">
      {loadError && <LoadError message={loadError} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="break-words text-3xl font-bold tracking-tight">{cliente.nombres} {cliente.apellidos}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-sm">CI: {cliente.cedula}</span>
              <Badge variant={cliente.estado === 'moroso' ? 'destructive' : cliente.estado === 'activo' ? 'default' : 'secondary'}>
                {cliente.estado?.toUpperCase() || 'NUEVO'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {userData && ['superadmin','dueño','admin','cajero'].includes(userData.rol) && <EditarClienteDialog cliente={cliente} standalone />}
          {userData && managers.includes(userData.rol) && <NuevoPrestamoDialog initialClienteId={cliente.id} />}
          {userData?.rol !== 'consulta' && <Link className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={'/gestion?cliente=' + cliente.id}>Crear gestión</Link>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,1fr)_3fr] gap-6">
        {/* Resumen Financiero Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Prestado</p>
                <p className="text-2xl font-bold">${prestamos.reduce((acc, p) => acc + (p.monto || 0), 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pagado</p>
                <p className="text-2xl font-bold text-green-600">
                  ${prestamos.reduce((acc, p) => acc + ((p.totalPagar ?? p.montoTotal ?? 0) - (p.saldoRestante || 0)), 0).toFixed(2)}
                </p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                <p className="text-3xl font-bold text-primary">
                  ${prestamos.reduce((acc, p) => acc + (p.saldoRestante || 0), 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-center">Indicador interno de pago</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 pt-2">
              {cliente.score == null ? <p className="text-muted-foreground">Sin evaluar</p> : <ScoreGauge score={cliente.score} />}
              <p className="text-xs text-center text-muted-foreground">Valoración interna de 0 a 100. No corresponde a un buró de crédito.</p>
              {cliente.scoreRevision && <div className="w-full rounded-lg bg-muted p-3 text-xs"><p>Última revisión: {cliente.scoreRevision.usuarioNombre} · {new Date(cliente.scoreRevision.fecha).toLocaleDateString('es-EC')}</p><p className="mt-1">{cliente.scoreRevision.motivo}</p></div>}

              {userData && managers.includes(userData.rol) && <Dialog open={openScoreDialog} onOpenChange={open => { if (!scoreBusy) { if (open) { setNewScore(cliente.score ?? 50); setScoreReason(''); } setOpenScoreDialog(open); } }}>
                <DialogTrigger render={<Button variant="outline" size="sm" className="w-full mt-2">Revisar indicador</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revisar indicador interno</DialogTitle>
                    <DialogDescription>
                      Registra una valoración de 0 a 100 y su fundamento. La revisión quedará en la auditoría de la financiera.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        aria-label="Indicador de 0 a 100"
                        min="0" max="100"
                        value={newScore}
                        onChange={(e) => setNewScore(Number(e.target.value))}
                        className="text-center text-2xl font-bold h-14"
                      />
                    </div>
                    <label className="block space-y-2 text-sm">Motivo de la revisión<Input value={scoreReason} maxLength={500} onChange={e => setScoreReason(e.target.value)} placeholder="Explica el fundamento de esta valoración" /></label>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" disabled={scoreBusy} onClick={() => setOpenScoreDialog(false)}>Cancelar</Button>
                    <Button disabled={scoreBusy || scoreReason.trim().length < 10} onClick={handleUpdateScore}>{scoreBusy ? 'Guardando…' : 'Guardar revisión'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Teléfono</p>
                <p className="font-medium">{cliente.telefonoPrincipal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Correo</p>
                <p className="font-medium">{cliente.correo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dirección</p>
                <p className="font-medium">{cliente.direccion}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="min-w-0">
          <Tabs defaultValue="prestamos" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
              <TabsTrigger value="perfil">Perfil Completo</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="prestamos" className="mt-6 space-y-4">
              {prestamos.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Historial de Préstamos</CardTitle>
                    <CardDescription>Visualiza los préstamos activos y pasados de este cliente.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                      No hay préstamos registrados para este cliente.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {prestamos.map(p => (
                    <Card key={p.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>Préstamo ${p.monto.toFixed(2)}</CardTitle>
                            <CardDescription>Otorgado el {new Date(p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt).toLocaleDateString()}</CardDescription>
                          </div>
                          <Badge variant={p.estado === 'moroso' ? 'destructive' : p.estado === 'completado' ? 'secondary' : 'default'}>
                            {p.estado.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between text-sm">
                          <div>
                            <p className="text-muted-foreground">Saldo Restante</p>
                            <p className="font-bold text-primary">${p.saldoRestante.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Frecuencia</p>
                            <p className="font-medium capitalize">{p.frecuenciaPago}</p>
                          </div>
                        </div>
                        <div className="mt-4 text-right">
                           <Link href={`/prestamos/${p.id}`}>
                            <Button variant="outline" size="sm">Ver Detalles</Button>
                           </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="perfil" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Datos Laborales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Empresa</p><p className="font-medium">{cliente.empresa || '-'}</p></div>
                  <div><p className="text-muted-foreground">Cargo</p><p className="font-medium">{cliente.cargo || '-'}</p></div>
                  <div><p className="text-muted-foreground">Ingresos Mensuales</p><p className="font-medium">${cliente.ingresosMensuales || 0}</p></div>
                  <div><p className="text-muted-foreground">Antigüedad</p><p className="font-medium">{cliente.antiguedadLaboral || '-'}</p></div>
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Referencias Personales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Ref 1: {cliente.referencia1 || '-'}</p><p className="font-medium">{cliente.telefonoRef1 || '-'}</p></div>
                  <div><p className="text-muted-foreground">Ref 2: {cliente.referencia2 || '-'}</p><p className="font-medium">{cliente.telefonoRef2 || '-'}</p></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documentos" className="mt-6">
               <Card>
                <CardHeader>
                  <CardTitle>Documentos Adjuntos</CardTitle>
                  <CardDescription>Gestión de cédula, comprobantes de domicilio y otros documentos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-lg bg-muted/20">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <UploadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Subir nuevo documento</h4>
                      <p className="text-sm text-muted-foreground">Selecciona un archivo PDF, JPG o PNG.</p>
                      {uploading && (
                        <div className="mt-2 w-full bg-secondary rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="max-w-[200px]"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                  </div>

                  {cliente.documentos && cliente.documentos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cliente.documentos.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-md shadow-sm">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                            <p className="text-sm font-medium truncate">{doc.nombre}</p>
                          </div>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/10">
                      No hay documentos adjuntos.
                    </div>
                  )}

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
