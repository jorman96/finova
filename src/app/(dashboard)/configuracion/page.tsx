"use client";

import { ProfileForm } from '@/components/configuracion/ProfileForm';
import Link from 'next/link';
import { UserAccessDialog } from "@/components/configuracion/UserAccessDialog";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Loader2, Moon, Sun, Monitor, Plus, Trash2, RotateCcw, AlertTriangle, ShieldCheck, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useTheme } from "next-themes";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { InyeccionCapital, MovimientoBitacoraCapital } from "@/types";
import { ResetValoresDialog } from "@/components/configuracion/ResetValoresDialog";
import { LoadError } from '@/components/ListPagination';
import { apiPost } from '@/lib/api-client';

export default function ConfiguracionPage() {
  const { user, userData } = useAuth();
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [controlledCapital, setControlledCapital] = useState(false);
  const [capitalReady, setCapitalReady] = useState(process.env.NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED !== 'true');
  const [loadedEmpresaId, setLoadedEmpresaId] = useState(''), [empresaError, setEmpresaError] = useState('');
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED !== 'true') return;
    let active = true;
    apiPost<{ enabled: boolean }>('/api/capital/summary', {}).then(v => { if (active) { setControlledCapital(v.enabled); setCapitalReady(true); } }).catch(() => { if (active) setEmpresaError('No se pudo comprobar el control de capital. Reintenta antes de modificar la configuración.'); });
    return () => { active = false; };
  }, [userData?.empresaId]);
  const [empresaData, setEmpresaData] = useState({
    nombre: "Finova Capital",
    moneda: "USD",
    tasaMoraDefecto: "5",
    logoUrl: "",
    capitalInicial: 0,
    cuentasBancarias: [] as { id: string, banco: string, numero: string, tipo: string, titular: string }[],
    inyeccionesCapital: [] as InyeccionCapital[],
    bitacoraCapital: [] as MovimientoBitacoraCapital[]
  });
  const [nuevaInyeccion, setNuevaInyeccion] = useState({ monto: 0, observaciones: "" });
  const [isInyeccionModalOpen, setIsInyeccionModalOpen] = useState(false);
  const [vistaCapitalTab, setVistaCapitalTab] = useState<'inyecciones' | 'bitacora'>('inyecciones');
  const [inyeccionARevertir, setInyeccionARevertir] = useState<InyeccionCapital | null>(null);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [motivoReversion, setMotivoReversion] = useState("");
  const [isReverting, setIsReverting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [nuevoBanco, setNuevoBanco] = useState({ banco: "", numero: "", tipo: "ahorros", titular: "" });

  const handleAddBanco = () => {
    if (controlledCapital) { toast.info('Las cuentas de origen están protegidas mientras opera Pagos de capital. Su modificación requiere conciliación.'); return; }
    if (!nuevoBanco.banco || !nuevoBanco.numero) return;
    const newBanco = {
      id: Date.now().toString(),
      ...nuevoBanco
    };
    setEmpresaData(prev => ({ ...prev, cuentasBancarias: [...(prev.cuentasBancarias || []), newBanco] }));
    setNuevoBanco({ banco: "", numero: "", tipo: "ahorros", titular: "" });
  };

  const handleInyectarCapital = async () => {
    if (controlledCapital) { toast.info('Registra el aporte recibido desde Pagos de capital para conservar su comprobante y auditoría.'); return; }
    if (!nuevaInyeccion.monto || nuevaInyeccion.monto <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    const inyeccionId = Date.now().toString();
    const inyeccion: InyeccionCapital = {
      id: inyeccionId,
      monto: nuevaInyeccion.monto,
      fecha: new Date().toISOString(),
      observaciones: nuevaInyeccion.observaciones.trim() || "Aporte de capital",
      registradoPor: userData?.nombre || "Dueño"
    };

    const movimientoBitacora: MovimientoBitacoraCapital = {
      id: inyeccionId,
      tipo: 'inyeccion',
      monto: nuevaInyeccion.monto,
      fecha: inyeccion.fecha,
      motivo: inyeccion.observaciones,
      registradoPor: userData?.nombre || "Dueño",
      usuarioEmail: user?.email || "",
      usuarioRol: userData?.rol || "dueño",
      inyeccionIdRef: inyeccionId
    };

    // Save locally first to show in UI
    const updatedInyecciones = [...(empresaData.inyeccionesCapital || []), inyeccion];
    const updatedBitacora = [movimientoBitacora, ...(empresaData.bitacoraCapital || [])];

    setEmpresaData(prev => ({
      ...prev,
      inyeccionesCapital: updatedInyecciones,
      bitacoraCapital: updatedBitacora
    }));

    // Save to Firestore immediately
    try {
      if (userData?.empresaId) {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "empresas", userData.empresaId), {
          inyeccionesCapital: updatedInyecciones,
          bitacoraCapital: updatedBitacora
        }, { merge: true });
        toast.success("Capital inyectado y registrado en la bitácora");
      }
    } catch (e: any) {
      toast.error("Error al guardar inyección: " + e.message);
    }

    setNuevaInyeccion({ monto: 0, observaciones: "" });
    setIsInyeccionModalOpen(false);
  };

  const handleConfirmarReversion = async () => {
    if (controlledCapital) { toast.info('Los aportes están protegidos. Registra su devolución desde Pagos de capital; los aportes históricos requieren conciliación.'); return; }
    if (!inyeccionARevertir || !userData?.empresaId) return;
    setIsReverting(true);

    try {
      const updatedInyecciones = (empresaData.inyeccionesCapital || []).filter(iny => iny.id !== inyeccionARevertir.id);

      const motivoFinal = motivoReversion.trim() || `Reversión/Anulación de inyección de $${inyeccionARevertir.monto.toFixed(2)} (${inyeccionARevertir.observaciones})`;

      const movimientoBitacora: MovimientoBitacoraCapital = {
        id: Date.now().toString(),
        tipo: 'reversion',
        monto: -inyeccionARevertir.monto,
        fecha: new Date().toISOString(),
        motivo: `${motivoFinal} (Inyección original del ${new Date(inyeccionARevertir.fecha).toLocaleDateString()}: "${inyeccionARevertir.observaciones}")`,
        registradoPor: userData?.nombre || "Dueño",
        usuarioEmail: user?.email || "",
        usuarioRol: userData?.rol || "dueño",
        inyeccionIdRef: inyeccionARevertir.id
      };

      const updatedBitacora = [movimientoBitacora, ...(empresaData.bitacoraCapital || [])];

      setEmpresaData(prev => ({
        ...prev,
        inyeccionesCapital: updatedInyecciones,
        bitacoraCapital: updatedBitacora
      }));

      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "empresas", userData.empresaId), {
        inyeccionesCapital: updatedInyecciones,
        bitacoraCapital: updatedBitacora
      }, { merge: true });

      toast.success("Inyección revertida exitosamente y asentada en la bitácora");
      setIsRevertModalOpen(false);
      setInyeccionARevertir(null);
      setMotivoReversion("");
    } catch (e: any) {
      console.error("Error al revertir inyección:", e);
      toast.error("Error al revertir la inyección: " + e.message);
    } finally {
      setIsReverting(false);
    }
  };

  const handleRemoveBanco = (id: string) => {
    if (controlledCapital) { toast.info('No se puede retirar una cuenta de origen mientras los fondos están bajo control. Requiere conciliación.'); return; }
    setEmpresaData(prev => ({ ...prev, cuentasBancarias: (prev.cuentasBancarias || []).filter(c => c.id !== id) }));
  };

  // Never save placeholder defaults while the existing company is still loading.
  useEffect(() => {
    const empresaId = userData?.empresaId;
    if (!empresaId) return;
    let current = true;
    import('firebase/firestore').then(async ({ doc, getDoc }) => {
      const snap = await getDoc(doc(db, 'empresas', empresaId));
      if (!snap.exists()) throw new Error('No se encuentra la financiera.');
      if (current) { setEmpresaData(previous => ({ ...previous, ...snap.data() })); setLoadedEmpresaId(empresaId); }
    }).catch(() => { if (current) setEmpresaError('No se pudo cargar la configuración. No se guardarán datos por defecto.'); });
    return () => { current = false; };
  }, [userData?.empresaId]);

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.empresaId || loadedEmpresaId !== userData.empresaId || !capitalReady) return;
    setLoading(true);

    try {
      const { doc, setDoc } = await import("firebase/firestore");
      let newLogoUrl = empresaData.logoUrl;

      // Si seleccionó un nuevo logo, subirlo a Storage
      if (logoFile) {
        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("@/lib/firebase");
        const logoRef = ref(storage, `empresas/${userData.empresaId}/logo_${Date.now()}.png`);
        const snapshot = await uploadBytes(logoRef, logoFile);
        newLogoUrl = await getDownloadURL(snapshot.ref);
      }

      await setDoc(doc(db, "empresas", userData.empresaId), {
        nombre: empresaData.nombre,
        ...(!controlledCapital ? { moneda: empresaData.moneda, capitalInicial: parseFloat(empresaData.capitalInicial.toString()) || 0, cuentasBancarias: empresaData.cuentasBancarias || [] } : {}),
        tasaMoraDefecto: empresaData.tasaMoraDefecto,
        logoUrl: newLogoUrl
      }, { merge: true });

      setEmpresaData(prev => ({ ...prev, logoUrl: newLogoUrl }));
      setLogoFile(null);
      toast.success("Configuración de empresa guardada");
    } catch (error: any) {
      console.error(error);
      toast.error("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (empresaError) return <LoadError message={empresaError} />;
  if (loadedEmpresaId !== userData?.empresaId || !capitalReady) return <p role="status">Consultando configuración de la financiera…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Administra tu perfil, preferencias del sistema y datos de tu empresa.</p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 max-w-[600px]">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="bancos">Cajas y Bancos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="sistema">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4 pt-4">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4 pt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Datos de la Institución</CardTitle>
              <CardDescription>Esta información aparecerá en los recibos y reportes que generes.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveEmpresa}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logotipo de la Financiera</Label>
                  <div className="flex items-center gap-4">
                    {empresaData.logoUrl && (
                      <img src={empresaData.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded border" />
                    )}
                    <Input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={e => setLogoFile(e.target.files?.[0] || null)}
                      disabled={userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'}
                      className="cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Este logo aparecerá en los comprobantes y contratos (PNG/JPG).</p>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de la Financiera</Label>
                  <Input
                    value={empresaData.nombre}
                    onChange={e => setEmpresaData({...empresaData, nombre: e.target.value})}
                    disabled={userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capital Inicial (Inversión Inicial)</Label>
                  <Input
                    type="number"
                    value={empresaData.capitalInicial}
                    onChange={e => setEmpresaData({...empresaData, capitalInicial: parseFloat(e.target.value) || 0})}
                    disabled={controlledCapital || (userData?.rol !== 'dueño' && userData?.rol !== 'superadmin')}
                  />
                  <p className="text-xs text-muted-foreground">{controlledCapital ? 'El capital y sus fuentes están protegidos. Gestiona nuevos aportes y devoluciones desde Pagos de capital.' : 'Monto total con el que iniciaste el negocio originalmente.'}</p>
                </div>

                {userData?.empresaId && (
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <Label className="text-base font-bold">Gestión de Capital e Inyecciones</Label>
                        <p className="text-xs text-muted-foreground">Registra aportes, revierte errores y consulta la bitácora de auditoría.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {controlledCapital && <Link className="rounded-lg border px-3 py-2 text-sm underline" href="/capital">Gestionar aportes en Pagos de capital</Link>}
                        <Button size="sm" variant="outline" disabled={controlledCapital || userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'} onClick={() => setIsInyeccionModalOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" /> Inyectar Capital
                        </Button>
                      </div>

                      <Dialog open={isInyeccionModalOpen} onOpenChange={setIsInyeccionModalOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Registrar Inyección de Capital</DialogTitle>
                            <DialogDescription>Añade nuevos fondos a la caja de la empresa. Este movimiento quedará registrado en la bitácora de auditoría.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Monto a Inyectar ($)</Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={nuevaInyeccion.monto || ""}
                                onChange={e => setNuevaInyeccion({...nuevaInyeccion, monto: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Origen / Observaciones</Label>
                              <Input
                                placeholder="Ej. Ahorros personales, Préstamo bancario..."
                                value={nuevaInyeccion.observaciones}
                                onChange={e => setNuevaInyeccion({...nuevaInyeccion, observaciones: e.target.value})}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInyeccionModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleInyectarCapital}>Registrar e Inyectar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Modal de Reversión / Anulación */}
                      <Dialog open={isRevertModalOpen} onOpenChange={setIsRevertModalOpen}>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-5 w-5" />
                              <DialogTitle>Revertir Inyección de Capital</DialogTitle>
                            </div>
                            <DialogDescription>
                              Esta acción anulará el aporte de capital seleccionado y descontará el monto del balance general en el Dashboard.
                            </DialogDescription>
                          </DialogHeader>
                          {inyeccionARevertir && (
                            <div className="space-y-4 py-3">
                              <div className="bg-muted/50 p-3 rounded-lg border text-sm space-y-1">
                                <div className="flex justify-between font-medium">
                                  <span>Monto a revertir:</span>
                                  <span className="text-destructive font-bold">-${inyeccionARevertir.monto.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Fecha original:</span>
                                  <span>{new Date(inyeccionARevertir.fecha).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Origen original:</span>
                                  <span>{inyeccionARevertir.observaciones}</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="motivo-reversion">Motivo de la Reversión (Auditoría) *</Label>
                                <Input
                                  id="motivo-reversion"
                                  placeholder="Ej. Error al digitar monto por el administrador"
                                  value={motivoReversion}
                                  onChange={e => setMotivoReversion(e.target.value)}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  Este motivo quedará asentado de forma permanente en la bitácora de movimientos para futuras auditorías.
                                </p>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRevertModalOpen(false)}>Cancelar</Button>
                            <Button
                              variant="destructive"
                              disabled={isReverting}
                              onClick={handleConfirmarReversion}
                            >
                              {isReverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                              Confirmar Reversión
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Selector de Pestañas: Inyecciones Activas vs Bitácora de Auditoría */}
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={vistaCapitalTab === 'inyecciones' ? 'default' : 'ghost'}
                        onClick={() => setVistaCapitalTab('inyecciones')}
                        className="text-xs h-8"
                      >
                        Inyecciones Activas ({empresaData.inyeccionesCapital?.length || 0})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={vistaCapitalTab === 'bitacora' ? 'default' : 'ghost'}
                        onClick={() => setVistaCapitalTab('bitacora')}
                        className="text-xs h-8 flex items-center gap-1"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Bitácora de Auditoría ({empresaData.bitacoraCapital?.length || 0})
                      </Button>
                    </div>

                    {vistaCapitalTab === 'inyecciones' ? (
                      empresaData.inyeccionesCapital && empresaData.inyeccionesCapital.length > 0 ? (
                        <div className="border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted">
                              <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Origen / Observación</TableHead>
                                <TableHead>Registrado Por</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {empresaData.inyeccionesCapital.map((iny) => (
                                <TableRow key={iny.id}>
                                  <TableCell className="py-2">{new Date(iny.fecha).toLocaleDateString()}</TableCell>
                                  <TableCell className="py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                    +${iny.monto.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-muted-foreground">{iny.observaciones}</TableCell>
                                  <TableCell className="py-2 text-xs text-muted-foreground">{iny.registradoPor || 'Dueño'}</TableCell>
                                  <TableCell className="py-2 text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'}
                                      title="Revertir o anular esta inyección"
                                      onClick={() => {
                                        setInyeccionARevertir(iny);
                                        setMotivoReversion("");
                                        setIsRevertModalOpen(true);
                                      }}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revertir
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded text-center">
                          No hay inyecciones de capital activas actualmente.
                        </p>
                      )
                    ) : (
                      /* Vista de Bitácora de Auditoría */
                      empresaData.bitacoraCapital && empresaData.bitacoraCapital.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Registro histórico e inmutable de todos los movimientos de capital (ingresos y reversiones) con fines de auditoría y control contable.
                          </p>
                          <div className="border rounded-md overflow-hidden">
                            <Table>
                              <TableHeader className="bg-muted">
                                <TableRow>
                                  <TableHead>Fecha y Hora</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Monto</TableHead>
                                  <TableHead>Motivo / Justificación</TableHead>
                                  <TableHead>Responsable</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {empresaData.bitacoraCapital.map((mov) => (
                                  <TableRow key={mov.id}>
                                    <TableCell className="py-2 text-xs">
                                      {new Date(mov.fecha).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Badge
                                        variant={mov.tipo === 'inyeccion' ? 'default' : 'destructive'}
                                        className={mov.tipo === 'inyeccion' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                                      >
                                        {mov.tipo === 'inyeccion' ? '+ INYECCIÓN' : '- REVERSIÓN'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className={`py-2 font-bold ${mov.monto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                      {mov.monto >= 0 ? `+$${mov.monto.toFixed(2)}` : `-$${Math.abs(mov.monto).toFixed(2)}`}
                                    </TableCell>
                                    <TableCell className="py-2 text-xs max-w-[240px] truncate" title={mov.motivo}>
                                      {mov.motivo}
                                    </TableCell>
                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">{mov.registradoPor}</span>
                                      {mov.usuarioRol && <span className="block text-[10px] capitalize text-muted-foreground">({mov.usuarioRol})</span>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded text-center">
                          No hay registros en la bitácora de auditoría aún. Todos los nuevos movimientos quedarán asentados aquí automáticamente.
                        </p>
                      )
                    )}
                  </div>
                )}

                {userData?.empresaId && (
                  <div className="pt-4 mt-4 border-t space-y-3">
                    <Label className="text-primary font-bold">Portal Público para Clientes</Label>
                    <p className="text-xs text-muted-foreground">Comparte este enlace con tus clientes para que puedan consultar sus saldos y fechas de pago con su cédula y un código enviado al correo registrado.</p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${userData.empresaId}`}
                        className="bg-muted text-muted-foreground"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/portal/${userData.empresaId}`);
                          toast.success("Enlace copiado al portapapeles");
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Moneda por Defecto</Label>
                  <Input
                    value={empresaData.moneda}
                    onChange={e => setEmpresaData({...empresaData, moneda: e.target.value})}
                    placeholder="USD, EUR, MXN..."
                    disabled={controlledCapital || userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'}
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t p-6">
                <Button type="submit" disabled={loading || (userData?.rol !== 'dueño' && userData?.rol !== 'superadmin')}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="bancos" className="space-y-4 pt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Cajas y Cuentas Bancarias</CardTitle>
              <CardDescription>Registra las cuentas donde recibes el dinero de los clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                <h4 className="font-medium text-sm">Agregar Nueva Cuenta</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco / Entidad</Label>
                    <Input placeholder="Ej. Banco Pichincha" value={nuevoBanco.banco} onChange={e => setNuevoBanco({...nuevoBanco, banco: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Cuenta</Label>
                    <Select value={nuevoBanco.tipo} onValueChange={v => setNuevoBanco({...nuevoBanco, tipo: v || "ahorros"})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ahorros">Ahorros</SelectItem>
                        <SelectItem value="corriente">Corriente</SelectItem>
                        <SelectItem value="caja_chica">Caja Chica (Efectivo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Número / Identificador</Label>
                    <Input placeholder="Ej. 22001234" value={nuevoBanco.numero} onChange={e => setNuevoBanco({...nuevoBanco, numero: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Titular</Label>
                    <Input placeholder="Ej. Juan Pérez" value={nuevoBanco.titular} onChange={e => setNuevoBanco({...nuevoBanco, titular: e.target.value})} />
                  </div>
                  <div className="flex items-end col-span-2">
                    <Button type="button" onClick={handleAddBanco} className="w-full"><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mt-6">
                <h4 className="font-medium text-sm border-b pb-2">Cuentas Registradas</h4>
                {(!empresaData.cuentasBancarias || empresaData.cuentasBancarias.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic">No hay cuentas bancarias registradas.</p>
                ) : (
                  <div className="space-y-3">
                    {empresaData.cuentasBancarias.map((cuenta) => (
                      <div key={cuenta.id} className="flex items-center justify-between p-3 border rounded bg-background">
                        <div>
                          <p className="font-medium">{cuenta.banco} <span className="text-muted-foreground text-xs uppercase ml-2">({cuenta.tipo})</span></p>
                          <p className="text-sm font-mono text-muted-foreground">{cuenta.numero} {cuenta.titular && `- ${cuenta.titular}`}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveBanco(cuenta.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t p-6">
              <Button type="button" onClick={handleSaveEmpresa} disabled={loading || (userData?.rol !== 'dueño' && userData?.rol !== 'superadmin')}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="equipo" className="space-y-4 pt-4">
          <EquipoTab />
        </TabsContent>

        <TabsContent value="sistema" className="space-y-4 pt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Preferencias Visuales</CardTitle>
              <CardDescription>Personaliza la apariencia de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Tema de la Interfaz</Label>
                  <p className="text-sm text-muted-foreground">Elige cómo quieres que se vea Finova.</p>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="flex-1"
                  >
                    <Sun className="mr-2 h-4 w-4" /> Claro
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="flex-1"
                  >
                    <Moon className="mr-2 h-4 w-4" /> Oscuro
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className="flex-1"
                  >
                    <Monitor className="mr-2 h-4 w-4" /> Sistema
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conservación del historial: Reinicio de Valores Financieros */}
          {(userData?.rol === 'dueño' || userData?.rol === 'superadmin') && (
            <Card className="max-w-2xl border-destructive/40 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle className="text-base font-bold text-destructive">
                    Conservación del historial y respaldos
                  </CardTitle>
                </div>
                <CardDescription>
                  Conserva el historial financiero y descarga los registros de tu empresa. Los saldos y los usuarios existentes no se reinician.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResetValoresDialog />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente para la pestaña de Equipo
function EquipoTab() {
  const { userData } = useAuth();
  const [miembros, setMiembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo Miembro
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (userData?.empresaId) {
      loadMiembros();
    }
  }, [userData?.empresaId]);

  const loadMiembros = async () => {
    try {
      const q = query(collection(db, "usuarios"), where("empresaId", "==", userData?.empresaId));
      const snap = await getDocs(q);
      setMiembros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (userData?.rol !== 'dueño' && userData?.rol !== 'superadmin') {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No tienes permisos para ver el equipo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Equipo de Trabajo</CardTitle>
          <CardDescription>Crea cuentas para tus cajeros y cobradores.</CardDescription>
        </div>
        <Button onClick={() => setIsModalOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Nuevo miembro</Button>
        <UserAccessDialog open={isModalOpen} onOpenChange={setIsModalOpen}
          empresaId={userData?.empresaId || ""} empresaNombre="Tu financiera"
          allowedRoles={["cajero", "cobrador", "admin"]}
          onCreated={() => { toast.success("Cuenta de acceso creada correctamente."); void loadMiembros(); }} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {miembros.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs">{m.rol}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Activo</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
