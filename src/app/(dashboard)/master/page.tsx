"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, getDocs, addDoc, serverTimestamp, doc, updateDoc, getCountFromServer, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2, Users, ShieldAlert, CheckCircle2, UserPlus, CreditCard, Activity, PauseCircle, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function MasterPanelPage() {
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Metrics
  const [metrics, setMetrics] = useState({ clientes: 0, prestamos: 0, empresas: 0 });

  // Create Empresa
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    nombre: "",
    razonSocial: "",
    identificacionFiscal: "",
    direccion: "",
    telefono: "",
    email: "",
    pais: "Ecuador",
    moneda: "USD",
    plan: "basico"
  });
  const [creando, setCreando] = useState(false);

  // Create User Modal
  const [openUserModal, setOpenUserModal] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [newUser, setNewUser] = useState({ nombre: "", email: "", password: "", documento: "", telefono: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  // Details Modal
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [selectedEmpresaDetails, setSelectedEmpresaDetails] = useState<any>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!authLoading && userData?.rol !== "superadmin") {
      router.push("/dashboard");
    }
  }, [userData, authLoading, router]);

  const loadData = async () => {
    try {
      // Cargar Empresas
      const q = query(collection(db, "empresas"));
      const snap = await getDocs(q);
      const empresasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Cargar Dueños
      const qDuenos = query(collection(db, "usuarios"), where("rol", "==", "dueño"));
      const snapDuenos = await getDocs(qDuenos);
      const duenosData = snapDuenos.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const empresasConDueno = empresasData.map(emp => {
        const dueno = duenosData.find(d => d.empresaId === emp.id);
        return { ...emp, dueno };
      });

      setEmpresas(empresasConDueno);

      // Cargar Métricas Globales
      const clientesCount = await getCountFromServer(collection(db, "clientes"));
      const prestamosCount = await getCountFromServer(collection(db, "prestamos"));
      setMetrics({
        empresas: empresasData.length,
        clientes: clientesCount.data().count,
        prestamos: prestamosCount.data().count
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.rol === "superadmin") {
      loadData();
    }
  }, [userData]);

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaEmpresa.nombre || !nuevaEmpresa.identificacionFiscal) return;

    setCreando(true);
    try {
      // Validar duplicados
      const qNombre = query(collection(db, "empresas"), where("nombre", "==", nuevaEmpresa.nombre));
      const snapNombre = await getDocs(qNombre);
      if (!snapNombre.empty) {
        toast.error("Ya existe una empresa con este nombre comercial.");
        setCreando(false);
        return;
      }

      const qRuc = query(collection(db, "empresas"), where("identificacionFiscal", "==", nuevaEmpresa.identificacionFiscal));
      const snapRuc = await getDocs(qRuc);
      if (!snapRuc.empty) {
        toast.error("Ya existe una empresa con esta identificación fiscal.");
        setCreando(false);
        return;
      }

      await addDoc(collection(db, "empresas"), {
        ...nuevaEmpresa,
        estado: "activa",
        createdAt: serverTimestamp()
      });
      toast.success("Empresa (Inquilino) creada exitosamente.");
      setNuevaEmpresa({
        nombre: "", razonSocial: "", identificacionFiscal: "", direccion: "", 
        telefono: "", email: "", pais: "Ecuador", moneda: "USD", plan: "basico"
      });
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear empresa.");
    } finally {
      setCreando(false);
    }
  };

  const handleToggleEstado = async (empresaId: string, currentStatus: string) => {
    const newStatus = currentStatus === "activa" ? "suspendida" : "activa";
    try {
      await updateDoc(doc(db, "empresas", empresaId), { estado: newStatus });
      toast.success(`Empresa ${newStatus === 'activa' ? 'activada' : 'suspendida'}.`);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar el estado.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newUser,
          empresaId: selectedEmpresaId,
          rol: "dueño"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando usuario");

      toast.success("Usuario administrador creado.");
      setOpenUserModal(false);
      setNewUser({ nombre: "", email: "", password: "", documento: "", telefono: "" });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresaDetails) return;
    setSavingDetails(true);
    try {
      // Guardar Empresa
      const { id, dueno, ...empresaData } = selectedEmpresaDetails;
      await updateDoc(doc(db, "empresas", id), empresaData);

      // Guardar Dueño (si existe y fue editado)
      if (dueno?.id) {
        const { id: duenoId, ...duenoData } = dueno;
        await updateDoc(doc(db, "usuarios", duenoId), duenoData);
      }

      toast.success("Detalles actualizados exitosamente.");
      setOpenDetailsModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar los detalles.");
    } finally {
      setSavingDetails(false);
    }
  };

  if (authLoading || userData?.rol !== "superadmin") {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          Centro de Comando (SaaS)
        </h2>
        <p className="text-muted-foreground">Gestiona inquilinos, suspensiones y métricas de Finova.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inquilinos Totales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.empresas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Préstamos Activos (Global)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.prestamos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Globales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.clientes}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Nueva Financiera</CardTitle>
              <CardDescription>Crea un nuevo espacio de trabajo aislado.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEmpresa} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre Comercial</Label>
                  <Input 
                    placeholder="Ej. PrestaFácil S.A." 
                    value={nuevaEmpresa.nombre}
                    onChange={e => setNuevaEmpresa({...nuevaEmpresa, nombre: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razón Social (Opcional)</Label>
                  <Input 
                    placeholder="Ej. Inversiones PrestaFácil S.A." 
                    value={nuevaEmpresa.razonSocial}
                    onChange={e => setNuevaEmpresa({...nuevaEmpresa, razonSocial: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RUC / NIT</Label>
                    <Input 
                      value={nuevaEmpresa.identificacionFiscal}
                      onChange={e => setNuevaEmpresa({...nuevaEmpresa, identificacionFiscal: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Input 
                      value={nuevaEmpresa.pais}
                      onChange={e => setNuevaEmpresa({...nuevaEmpresa, pais: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección Física</Label>
                  <Input 
                    value={nuevaEmpresa.direccion}
                    onChange={e => setNuevaEmpresa({...nuevaEmpresa, direccion: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input 
                      type="tel"
                      value={nuevaEmpresa.telefono}
                      onChange={e => setNuevaEmpresa({...nuevaEmpresa, telefono: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Input 
                      value={nuevaEmpresa.moneda}
                      onChange={e => setNuevaEmpresa({...nuevaEmpresa, moneda: e.target.value})}
                      placeholder="Ej. USD, MXN"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Correo Institucional</Label>
                  <Input 
                    type="email"
                    value={nuevaEmpresa.email}
                    onChange={e => setNuevaEmpresa({...nuevaEmpresa, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan de Suscripción</Label>
                  <Select value={nuevaEmpresa.plan} onValueChange={(val) => setNuevaEmpresa({...nuevaEmpresa, plan: val || "basico"})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={creando} className="w-full">
                  {creando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <span>Registrar Empresa</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Inquilinos Activos</CardTitle>
              <CardDescription>Gestión de las empresas operando en la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : empresas.length === 0 ? (
                <p className="text-muted-foreground text-center">No hay empresas creadas.</p>
              ) : (
                <div className="space-y-4">
                  {empresas.map(emp => (
                    <div key={emp.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-md gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">{emp.nombre}</p>
                          <Badge variant={emp.estado === 'activa' ? 'default' : 'destructive'}>
                            {emp.estado.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="uppercase text-xs">{emp.plan || 'basico'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">ID: {emp.id}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmpresaDetails(emp);
                            setOpenDetailsModal(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" /> Detalles
                        </Button>
                        {!emp.dueno && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedEmpresaId(emp.id);
                              setOpenUserModal(true);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" /> Asignar Dueño
                          </Button>
                        )}
                        <Button 
                          variant={emp.estado === 'activa' ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => handleToggleEstado(emp.id, emp.estado)}
                        >
                          {emp.estado === 'activa' ? (
                            <><PauseCircle className="mr-2 h-4 w-4" /> Suspender</>
                          ) : (
                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Activar</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={openUserModal} onOpenChange={setOpenUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Cuenta de Dueño</DialogTitle>
            <DialogDescription>
              Crea un usuario administrador para esta empresa. Podrá iniciar sesión inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input required value={newUser.nombre} onChange={e => setNewUser({...newUser, nombre: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Documento (DNI/Cédula)</Label>
                <Input required value={newUser.documento} onChange={e => setNewUser({...newUser, documento: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Móvil</Label>
                <Input type="tel" required value={newUser.telefono} onChange={e => setNewUser({...newUser, telefono: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico (Login)</Label>
              <Input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Contraseña Provisional</Label>
              <Input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenUserModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={openDetailsModal} onOpenChange={setOpenDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Inquilino (360°)</DialogTitle>
            <DialogDescription>
              Información legal, comercial y de contacto de la financiera y su dueño. Puedes editar los campos y guardar los cambios.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmpresaDetails && (
            <form onSubmit={handleSaveDetails} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Columna Izquierda: Empresa */}
                <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                  <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Datos de la Empresa
                  </h3>
                  <div className="space-y-2">
                    <Label>Nombre Comercial</Label>
                    <Input 
                      value={selectedEmpresaDetails.nombre} 
                      onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, nombre: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Razón Social</Label>
                    <Input 
                      value={selectedEmpresaDetails.razonSocial || ""} 
                      onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, razonSocial: e.target.value})} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RUC / NIT</Label>
                      <Input 
                        value={selectedEmpresaDetails.identificacionFiscal} 
                        onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, identificacionFiscal: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>País</Label>
                      <Input 
                        value={selectedEmpresaDetails.pais || ""} 
                        onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, pais: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección Física</Label>
                    <Input 
                      value={selectedEmpresaDetails.direccion || ""} 
                      onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, direccion: e.target.value})} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input 
                        type="tel"
                        value={selectedEmpresaDetails.telefono || ""} 
                        onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, telefono: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Moneda</Label>
                      <Input 
                        value={selectedEmpresaDetails.moneda || ""} 
                        onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, moneda: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo Institucional</Label>
                    <Input 
                      type="email"
                      value={selectedEmpresaDetails.email || ""} 
                      onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan de Suscripción</Label>
                    <Select value={selectedEmpresaDetails.plan} onValueChange={(val) => setSelectedEmpresaDetails({...selectedEmpresaDetails, plan: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basico">Básico</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Columna Derecha: Dueño */}
                <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                  <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> Datos del Dueño
                  </h3>
                  
                  {selectedEmpresaDetails.dueno ? (
                    <>
                      <div className="space-y-2">
                        <Label>Nombre Completo</Label>
                        <Input 
                          value={selectedEmpresaDetails.dueno.nombre} 
                          onChange={e => setSelectedEmpresaDetails({
                            ...selectedEmpresaDetails, 
                            dueno: { ...selectedEmpresaDetails.dueno, nombre: e.target.value }
                          })} 
                          required 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Documento</Label>
                          <Input 
                            value={selectedEmpresaDetails.dueno.documento || ""} 
                            onChange={e => setSelectedEmpresaDetails({
                              ...selectedEmpresaDetails, 
                              dueno: { ...selectedEmpresaDetails.dueno, documento: e.target.value }
                            })} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Teléfono</Label>
                          <Input 
                            type="tel"
                            value={selectedEmpresaDetails.dueno.telefono || ""} 
                            onChange={e => setSelectedEmpresaDetails({
                              ...selectedEmpresaDetails, 
                              dueno: { ...selectedEmpresaDetails.dueno, telefono: e.target.value }
                            })} 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Correo Electrónico (Login)</Label>
                        <Input 
                          type="email"
                          value={selectedEmpresaDetails.dueno.email} 
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">El correo de login no se puede cambiar por seguridad.</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-3">
                      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">No hay dueño asignado a esta financiera.</p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setOpenDetailsModal(false);
                          setSelectedEmpresaId(selectedEmpresaDetails.id);
                          setOpenUserModal(true);
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" /> Asignar Dueño Ahora
                      </Button>
                    </div>
                  )}
                </div>

              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenDetailsModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={savingDetails}>
                  {savingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
