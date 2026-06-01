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
import { Building2, Loader2, Users, ShieldAlert, CheckCircle2, UserPlus, CreditCard, Activity, PauseCircle, Eye, Search, PlusCircle, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b']; // emerald, blue, red, amber

export default function MasterPanelPage() {
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Metrics
  const [metrics, setMetrics] = useState({ 
    clientes: 0, 
    prestamos: 0, 
    empresas: 0,
    capitalTotal: 0
  });

  // Chart Data
  const [chartData, setChartData] = useState({
    estados: [] as any[],
    crecimientoInquilinos: [] as any[]
  });

  // Modals state
  const [openCreateEmpresa, setOpenCreateEmpresa] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [openDetailsModal, setOpenDetailsModal] = useState(false);

  // Forms state
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    nombre: "", razonSocial: "", identificacionFiscal: "", direccion: "", 
    telefono: "", email: "", pais: "Ecuador", moneda: "USD", plan: "basico"
  });
  const [creando, setCreando] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [newUser, setNewUser] = useState({ nombre: "", email: "", password: "", documento: "", telefono: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  const [selectedEmpresaDetails, setSelectedEmpresaDetails] = useState<any>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!authLoading && userData?.rol !== "superadmin") {
      router.push("/dashboard");
    }
  }, [userData, authLoading, router]);

  const loadData = async () => {
    try {
      // 1. Cargar Empresas
      const q = query(collection(db, "empresas"));
      const snap = await getDocs(q);
      const empresasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Cargar Dueños
      const qDuenos = query(collection(db, "usuarios"), where("rol", "==", "dueño"));
      const snapDuenos = await getDocs(qDuenos);
      const duenosData = snapDuenos.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const empresasConDueno = empresasData.map(emp => {
        const dueno = duenosData.find(d => d.empresaId === emp.id);
        return { ...emp, dueno };
      });
      
      setEmpresas(empresasConDueno);

      // 3. Cargar Préstamos Globales para métricas
      const qPrestamos = query(collection(db, "prestamos"));
      const snapPrestamos = await getDocs(qPrestamos);
      let totalCapital = 0;
      let activos = 0;
      let completados = 0;
      let mora = 0;

      snapPrestamos.forEach(doc => {
        const p = doc.data();
        totalCapital += (p.monto || 0);
        if (p.estado === "completado") completados++;
        else if (p.estado === "mora") mora++;
        else activos++;
      });

      // 4. Cargar conteo de clientes global
      const clientesCount = await getCountFromServer(collection(db, "clientes"));

      setMetrics({
        empresas: empresasData.length,
        clientes: clientesCount.data().count,
        prestamos: snapPrestamos.size,
        capitalTotal: totalCapital
      });

      // Data for Charts
      setChartData({
        estados: [
          { name: "Activos", value: activos },
          { name: "Completados", value: completados },
          { name: "En Mora", value: mora },
        ],
        crecimientoInquilinos: buildTenantGrowthChart(empresasData)
      });

    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos globales.");
    } finally {
      setLoading(false);
    }
  };

  const buildTenantGrowthChart = (empresas: any[]) => {
    const currentYear = new Date().getFullYear();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const growth = months.map(m => ({ mes: m, nuevas: 0 }));
    
    empresas.forEach(emp => {
      if (emp.createdAt) {
        const d = emp.createdAt.toDate ? emp.createdAt.toDate() : new Date(emp.createdAt);
        if (d.getFullYear() === currentYear) {
          growth[d.getMonth()].nuevas++;
        }
      }
    });
    return growth;
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
      const qNombre = query(collection(db, "empresas"), where("nombre", "==", nuevaEmpresa.nombre));
      const snapNombre = await getDocs(qNombre);
      if (!snapNombre.empty) {
        toast.error("Ya existe una empresa con este nombre comercial.");
        setCreando(false);
        return;
      }

      await addDoc(collection(db, "empresas"), {
        ...nuevaEmpresa,
        estado: "activa",
        createdAt: serverTimestamp()
      });
      
      toast.success("Empresa (Inquilino) creada exitosamente.");
      setOpenCreateEmpresa(false);
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...newUser, empresaId: selectedEmpresaId, rol: "dueño" })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando usuario");

      toast.success("Usuario administrador creado.");
      setOpenUserModal(false);
      setNewUser({ nombre: "", email: "", password: "", documento: "", telefono: "" });
      loadData();
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
      const { id, dueno, ...empresaData } = selectedEmpresaDetails;
      await updateDoc(doc(db, "empresas", id), empresaData);

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

  const filteredEmpresas = empresas.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Centro de Comando SaaS
          </h2>
          <p className="text-muted-foreground">Analíticas globales y gestión de inquilinos de Finova.</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="dashboard">
            <Activity className="h-4 w-4 mr-2" />
            Visión Global
          </TabsTrigger>
          <TabsTrigger value="inquilinos">
            <Building2 className="h-4 w-4 mr-2" />
            Gestión de Inquilinos
          </TabsTrigger>
        </TabsList>
        
        {/* TAB 1: DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volumen Transaccional</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  ${metrics.capitalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Capital global colocado</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inquilinos Activos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.empresas}</div>
                <p className="text-xs text-muted-foreground mt-1">Financieras registradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Préstamos Globales</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.prestamos}</div>
                <p className="text-xs text-muted-foreground mt-1">Créditos en sistema</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Totales</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.clientes}</div>
                <p className="text-xs text-muted-foreground mt-1">Prestatarios registrados</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento de Financieras (Este Año)</CardTitle>
                <CardDescription>Nuevos inquilinos registrados por mes.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {loading ? <Loader2 className="mx-auto mt-20 animate-spin" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.crecimientoInquilinos}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="mes" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="nuevas" fill="#3b82f6" radius={[4,4,0,0]} name="Nuevas Financieras" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado Global de Cartera</CardTitle>
                <CardDescription>Distribución de préstamos de todas las financieras.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin" /> : chartData.estados.reduce((a, b) => a + b.value, 0) === 0 ? (
                  <p className="text-muted-foreground">No hay préstamos registrados aún.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.estados}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.estados.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [value, "Préstamos"]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
              {/* Leyenda manual centrada */}
              <div className="flex justify-center gap-4 pb-4">
                {chartData.estados.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: INQUILINOS */}
        <TabsContent value="inquilinos" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Directorio de Inquilinos</CardTitle>
                <CardDescription>Gestión de las empresas operando en la plataforma.</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar empresa..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Dialog open={openCreateEmpresa} onOpenChange={setOpenCreateEmpresa}>
                  <Button onClick={() => setOpenCreateEmpresa(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Inquilino
                  </Button>
                  <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Registrar Nueva Financiera</DialogTitle>
                      <DialogDescription>Crea un nuevo espacio de trabajo aislado en el sistema.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateEmpresa} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nombre Comercial</Label>
                        <Input placeholder="Ej. PrestaFácil S.A." value={nuevaEmpresa.nombre} onChange={e => setNuevaEmpresa({...nuevaEmpresa, nombre: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Razón Social (Opcional)</Label>
                        <Input placeholder="Ej. Inversiones PrestaFácil S.A." value={nuevaEmpresa.razonSocial} onChange={e => setNuevaEmpresa({...nuevaEmpresa, razonSocial: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>RUC / NIT</Label>
                          <Input value={nuevaEmpresa.identificacionFiscal} onChange={e => setNuevaEmpresa({...nuevaEmpresa, identificacionFiscal: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>País</Label>
                          <Input value={nuevaEmpresa.pais} onChange={e => setNuevaEmpresa({...nuevaEmpresa, pais: e.target.value})} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Dirección Física</Label>
                        <Input value={nuevaEmpresa.direccion} onChange={e => setNuevaEmpresa({...nuevaEmpresa, direccion: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Teléfono</Label>
                          <Input type="tel" value={nuevaEmpresa.telefono} onChange={e => setNuevaEmpresa({...nuevaEmpresa, telefono: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Moneda</Label>
                          <Input value={nuevaEmpresa.moneda} onChange={e => setNuevaEmpresa({...nuevaEmpresa, moneda: e.target.value})} placeholder="Ej. USD, MXN" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Correo Institucional</Label>
                        <Input type="email" value={nuevaEmpresa.email} onChange={e => setNuevaEmpresa({...nuevaEmpresa, email: e.target.value})} />
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
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpenCreateEmpresa(false)}>Cancelar</Button>
                        <Button type="submit" disabled={creando}>
                          {creando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Registrar Empresa
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              ) : filteredEmpresas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No se encontraron empresas.</p>
              ) : (
                <div className="space-y-4">
                  {filteredEmpresas.map(emp => (
                    <div key={emp.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-md gap-4 hover:bg-muted/30 transition-colors">
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
                        <Button variant="secondary" size="sm" onClick={() => { setSelectedEmpresaDetails(emp); setOpenDetailsModal(true); }}>
                          <Eye className="mr-2 h-4 w-4" /> Detalles
                        </Button>
                        {!emp.dueno && (
                          <Button variant="outline" size="sm" onClick={() => { setSelectedEmpresaId(emp.id); setOpenUserModal(true); }}>
                            <UserPlus className="mr-2 h-4 w-4" /> Dueño
                          </Button>
                        )}
                        <Button variant={emp.estado === 'activa' ? 'destructive' : 'default'} size="sm" onClick={() => handleToggleEstado(emp.id, emp.estado)}>
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
        </TabsContent>
      </Tabs>

      {/* MODAL: ASIGNAR DUEÑO */}
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

      {/* MODAL: DETALLES DE EMPRESA */}
      <Dialog open={openDetailsModal} onOpenChange={setOpenDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Inquilino (360°)</DialogTitle>
            <DialogDescription>
              Información legal, comercial y de contacto de la financiera y su dueño.
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
                    <Input value={selectedEmpresaDetails.nombre} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, nombre: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Razón Social</Label>
                    <Input value={selectedEmpresaDetails.razonSocial || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, razonSocial: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RUC / NIT</Label>
                      <Input value={selectedEmpresaDetails.identificacionFiscal} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, identificacionFiscal: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>País</Label>
                      <Input value={selectedEmpresaDetails.pais || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, pais: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección Física</Label>
                    <Input value={selectedEmpresaDetails.direccion || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, direccion: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input type="tel" value={selectedEmpresaDetails.telefono || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, telefono: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Moneda</Label>
                      <Input value={selectedEmpresaDetails.moneda || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, moneda: e.target.value})} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo Institucional</Label>
                    <Input type="email" value={selectedEmpresaDetails.email || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, email: e.target.value})} />
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
                        <Input value={selectedEmpresaDetails.dueno.nombre} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, dueno: { ...selectedEmpresaDetails.dueno, nombre: e.target.value }})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Documento</Label>
                          <Input value={selectedEmpresaDetails.dueno.documento || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, dueno: { ...selectedEmpresaDetails.dueno, documento: e.target.value }})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Teléfono</Label>
                          <Input type="tel" value={selectedEmpresaDetails.dueno.telefono || ""} onChange={e => setSelectedEmpresaDetails({...selectedEmpresaDetails, dueno: { ...selectedEmpresaDetails.dueno, telefono: e.target.value }})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Correo Electrónico (Login)</Label>
                        <Input type="email" value={selectedEmpresaDetails.dueno.email} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">El correo de login no se puede cambiar por seguridad.</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-3">
                      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">No hay dueño asignado a esta financiera.</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setOpenDetailsModal(false);
                        setSelectedEmpresaId(selectedEmpresaDetails.id);
                        setOpenUserModal(true);
                      }}>
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
