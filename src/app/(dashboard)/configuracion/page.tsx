"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Save, Loader2, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const { user, userData } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [empresaData, setEmpresaData] = useState({
    nombre: "Finova Capital",
    moneda: "USD",
    tasaMoraDefecto: "5",
    logoUrl: ""
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Cargar datos reales de la empresa si existen
  useEffect(() => {
    if (userData?.empresaId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        getDoc(doc(db, "empresas", userData.empresaId)).then((snap) => {
          if (snap.exists()) {
            setEmpresaData(prev => ({ ...prev, ...snap.data() }));
          }
        });
      });
    }
  }, [userData?.empresaId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.empresaId) return;
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
        moneda: empresaData.moneda,
        tasaMoraDefecto: empresaData.tasaMoraDefecto,
        logoUrl: newLogoUrl,
        estado: 'activa' // Por si acaso se está creando por primera vez
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Administra tu perfil, preferencias del sistema y datos de tu empresa.</p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="sistema">Sistema</TabsTrigger>
        </TabsList>
        
        <TabsContent value="perfil" className="space-y-4 pt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Perfil del Usuario</CardTitle>
              <CardDescription>Información de la cuenta de acceso actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={userData?.nombre || "Usuario"} disabled />
              </div>
              <div className="space-y-2">
                <Label>Correo Electrónico</Label>
                <Input value={user?.email || "Usuario no identificado"} disabled />
              </div>
              <div className="space-y-2">
                <Label>Rol Actual</Label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 uppercase">
                    {userData?.rol || "desconocido"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <Button variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
              </Button>
            </CardFooter>
          </Card>
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
                
                {userData?.empresaId && (
                  <div className="pt-4 mt-4 border-t space-y-3">
                    <Label className="text-primary font-bold">Portal Público para Clientes</Label>
                    <p className="text-xs text-muted-foreground">Comparte este enlace con tus clientes para que puedan consultar sus saldos y fechas de pago ingresando solo su cédula.</p>
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
                    disabled={userData?.rol !== 'dueño' && userData?.rol !== 'superadmin'}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente para la pestaña de Equipo
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function EquipoTab() {
  const { userData } = useAuth();
  const [miembros, setMiembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Nuevo Miembro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", password: "", rol: "cajero" });
  const [creando, setCreando] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...nuevo,
          empresaId: userData?.empresaId,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando usuario");

      toast.success(`Usuario ${nuevo.rol} creado.`);
      setIsModalOpen(false);
      setNuevo({ nombre: "", email: "", password: "", rol: "cajero" });
      loadMiembros();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreando(false);
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
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={<Button />}>
            <UserPlus className="mr-2 h-4 w-4" /> Nuevo Miembro
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Empleado</DialogTitle>
              <DialogDescription>
                El usuario podrá iniciar sesión inmediatamente con el correo y contraseña que le asignes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Empleado</Label>
                <Input required value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Correo Electrónico (Login)</Label>
                <Input type="email" required value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña</Label>
                <Input type="password" required value={nuevo.password} onChange={e => setNuevo({...nuevo, password: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Rol del Sistema</Label>
                <Select value={nuevo.rol} onValueChange={val => setNuevo({...nuevo, rol: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cajero">Cajero (Solo registra cobros)</SelectItem>
                    <SelectItem value="cobrador">Cobrador (Solo ve la Mora)</SelectItem>
                    <SelectItem value="admin">Administrador (Acceso total local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creando}>
                  {creando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Cuenta
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
