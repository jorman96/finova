"use client";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [openScoreDialog, setOpenScoreDialog] = useState(false);
  const [newScore, setNewScore] = useState(50);
  const router = useRouter();

  const handleUpdateScore = async () => {
    try {
      await updateDoc(doc(db, "clientes", id), { score: newScore });
      toast.success("Score actualizado correctamente");
      setOpenScoreDialog(false);
    } catch (error) {
      toast.error("Error al actualizar el score");
    }
  };

  useEffect(() => {
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
      setLoading(false);
    });

    const qPrestamos = query(collection(db, "prestamos"), where("clienteId", "==", id));
    const unsubscribePrestamos = onSnapshot(qPrestamos, (snap) => {
      setPrestamos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeCliente();
      unsubscribePrestamos();
    };
  }, [id, router]);

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
  if (!cliente) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{cliente.nombres} {cliente.apellidos}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-sm">CI: {cliente.cedula}</span>
              <Badge variant={cliente.estado === 'moroso' ? 'destructive' : cliente.estado === 'activo' ? 'default' : 'secondary'}>
                {cliente.estado?.toUpperCase() || 'NUEVO'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Editar Perfil</Button>
          <Button><CreditCard className="mr-2 h-4 w-4" /> Nuevo Préstamo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  ${prestamos.reduce((acc, p) => acc + ((p.montoTotal || 0) - (p.saldoRestante || 0)), 0).toFixed(2)}
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
              <CardTitle className="text-center">Score Crediticio</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 pt-2">
              <ScoreGauge score={cliente.score || 50} />
              
              <Dialog open={openScoreDialog} onOpenChange={setOpenScoreDialog}>
                <DialogTrigger render={<Button variant="outline" size="sm" className="w-full mt-2">Ajustar Score Manual</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajustar Score Crediticio</DialogTitle>
                    <DialogDescription>
                      Modifica manualmente el puntaje de este cliente (0-100). Útil si tienes información externa.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                      <Input 
                        type="number" 
                        min="0" max="100" 
                        value={newScore} 
                        onChange={(e) => setNewScore(Number(e.target.value))}
                        className="text-center text-2xl font-bold h-14"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenScoreDialog(false)}>Cancelar</Button>
                    <Button onClick={handleUpdateScore}>Guardar Score</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
        <div className="md:col-span-3">
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
