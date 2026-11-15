"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet,SheetContent,SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { canAccessPage } from "@/lib/permissions";
import { signOut } from "firebase/auth";
import { AlertCircle,CreditCard,DollarSign,FileText,Landmark,LayoutDashboard,Loader2,LogOut,Menu,Settings,Users } from "lucide-react";
import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { useEffect,useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const setMobileMenuOpen = (open: boolean) => setMobileMenuPath(open ? pathname : null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (error || !userData) return <div className="p-8 space-y-4"><p role="alert">{error || "Perfil no disponible"}</p><Button onClick={handleLogout}>Cerrar sesión</Button></div>;
  if (!canAccessPage(userData.rol, pathname)) return <div className="p-8"><p>No tienes permisos para esta página.</p><Link href="/dashboard">Volver al inicio</Link></div>;

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Préstamos", href: "/prestamos", icon: CreditCard },
    { name: "Pagos", href: "/pagos", icon: DollarSign },
  ];

  if (userData?.rol !== 'cajero') {
    navItems.push({ name: "Mora", href: "/mora", icon: AlertCircle });
  }

  if (userData?.rol === 'dueño' || userData?.rol === 'superadmin' || userData?.rol === 'admin') {
    navItems.push(
      { name: "Inversionistas", href: "/inversionistas", icon: Landmark },
      { name: "Reportes", href: "/reportes", icon: FileText },
      { name: "Configuración", href: "/configuracion", icon: Settings },
      { name: "Tesorería", href: "/tesoreria", icon: Landmark }
    );
  }

  if (userData?.rol === 'superadmin') {
    navItems.push({ name: "Súper Admin", href: "/master", icon: Users });
  }

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-4 border-b">
        <div className="flex items-center gap-2 text-primary">
          <DollarSign className="h-6 w-6 font-bold" />
          <span className="text-xl font-bold tracking-tight">Finova</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.name} href={item.href}>
              <span className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
                <item.icon className="h-4 w-4" />
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t space-y-4">
        <div className="px-3">
          <p className="text-sm font-medium truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{userData.rol}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-foreground mb-0" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">Developed by Jorman Castro © {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar Desktop */}
      <aside className="w-52 border-r bg-card hidden md:flex flex-col shadow-sm transition-all duration-300">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-card shadow-sm z-10">
          <div className="md:hidden flex items-center gap-3 text-primary">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetContent side="left" className="w-64 flex flex-col p-0">
                <SheetTitle className="sr-only">Navegación principal</SheetTitle>
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <DollarSign className="h-6 w-6" />
            <span className="text-xl font-bold">Finova</span>
          </div>
          <div className="hidden md:flex flex-1"></div>
          <div className="flex items-center gap-4 ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
