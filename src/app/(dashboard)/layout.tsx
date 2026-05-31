"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2, LayoutDashboard, Users, CreditCard, DollarSign, AlertCircle, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
      { name: "Reportes", href: "/reportes", icon: FileText },
      { name: "Configuración", href: "/configuracion", icon: Settings }
    );
  }

  if (userData?.rol === 'superadmin') {
    navItems.push({ name: "Súper Admin", href: "/master", icon: Users });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-52 border-r bg-card hidden md:flex flex-col shadow-sm transition-all duration-300">
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
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card shadow-sm z-10">
          <div className="md:hidden flex items-center gap-2 text-primary">
            <DollarSign className="h-6 w-6" />
            <span className="text-xl font-bold">Finova</span>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-6 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
