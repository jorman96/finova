"use client";

import { canAccessPage } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, Users, CreditCard, DollarSign, AlertCircle, FileText, Settings, LogOut, Menu, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { Fragment } from "react";
import { useCompany } from "@/hooks/use-company";

const roleLabels = { superadmin: 'Superadministrador', dueño: 'Dueño', admin: 'Administrador', gestor: 'Gestor', cobrador: 'Cobrador', cajero: 'Cajero', consulta: 'Consulta' };
function compactName(fullName: string, names?: string, surnames?: string) {
  if (names?.trim() && surnames?.trim()) return names.trim().split(/\s+/)[0] + ' ' + surnames.trim().split(/\s+/)[0];
  // Legacy profiles contain a single full name; assume the final two words are surnames.
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? parts[0] || 'Usuario' : parts[0] + ' ' + parts[Math.max(1, parts.length - 2)];
}
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, error } = useAuth();
  const company = useCompany();
  const router = useRouter(), pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false), [loggingOut, setLoggingOut] = useState(false), [logoutError, setLogoutError] = useState('');
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);
  if (loading || !user) return <div className="flex h-dvh items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" aria-label="Cargando sesión" /></div>;
  if (!userData || error) return <main className="p-4 space-y-4"><p role="alert">{error || 'No se pudo validar tu perfil.'}</p><Button onClick={() => signOut(auth)}>Volver al inicio de sesión</Button></main>;
  if (!canAccessPage(userData.rol, pathname)) return <main className="p-4">No tienes permiso para acceder a esta sección.</main>;
  const fullName = userData.nombre || user.displayName || 'Usuario';
  const name = compactName(fullName, userData.nombres, userData.apellidos);
  const role = roleLabels[userData.rol];
  async function handleLogout() {
    setLoggingOut(true); setLogoutError('');
    try { await signOut(auth); router.push('/login'); }
    catch { setLogoutError('No se pudo cerrar la sesión. Intenta nuevamente.'); setLoggingOut(false); }
  }
  const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clientes', href: '/clientes', icon: Users }, { name: 'Préstamos', href: '/prestamos', icon: CreditCard }, { name: 'Cobros', href: '/pagos', icon: DollarSign },
  ];
  if (userData.rol !== 'cajero') navItems.push({ name: 'Mora', href: '/mora', icon: AlertCircle });
  navItems.push({ name: 'Gestiones y agenda', href: '/gestion', icon: FileText });
  if (['dueño', 'superadmin', 'admin'].includes(userData.rol)) {
    if (process.env.NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED === 'true') navItems.push({ name: 'Pagos de capital', href: '/capital', icon: Landmark });
    navItems.push({ name: 'Inversionistas', href: '/inversionistas', icon: Landmark }, { name: 'Reportes', href: '/reportes', icon: FileText }, { name: 'Configuración', href: '/configuracion', icon: Settings });
  }
  navItems.push({ name: 'Mi cuenta', href: '/perfil', icon: Users }, { name: 'Seguridad', href: '/seguridad', icon: Settings });
  if (userData.rol === 'superadmin') navItems.push({ name: 'Súper Admin', href: '/master', icon: Users });
  const sidebarContent = <>
    <div className="flex h-16 shrink-0 items-center border-b px-5"><div className="flex items-center gap-2 text-primary"><DollarSign className="size-6" /><span className="text-xl font-bold tracking-tight">Finova</span></div></div>
    <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
      {navItems.map((item, index) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const group = (href: string) => href === '/dashboard' ? 'Resumen' : ['/clientes','/prestamos','/pagos','/mora','/gestion'].includes(href) ? 'Operación' : ['/capital','/inversionistas'].includes(href) ? 'Tesorería' : href === '/reportes' ? 'Control' : 'Administración';
        return <Fragment key={item.href}>{(index === 0 || group(navItems[index - 1].href) !== group(item.href)) && <p className="px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground">{group(item.href)}</p>}<Link href={item.href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><item.icon className="size-4 shrink-0" />{item.name}</Link></Fragment>;
      })}
    </nav>
    <footer className="shrink-0 border-t p-4 text-center text-[10px] text-muted-foreground">Developed by Jorman Castro © {new Date().getFullYear()}</footer>
  </>;
  return <div className="finova-workspace flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card lg:flex">{sidebarContent}</aside>
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-20 flex min-h-16 shrink-0 items-center gap-2 border-b bg-card px-3 pt-[env(safe-area-inset-top)] sm:px-5">
        <Button variant="ghost" size="icon" className="size-11 shrink-0 lg:hidden" aria-label="Abrir menú" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu className="size-5" /></Button>
        <div className="hidden min-w-0 flex-1 text-sm font-medium sm:block"><p className="truncate" title={company?.nombre}>{company?.nombre || "Finova"}</p><p className="text-xs text-muted-foreground">{navItems.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.name || 'Finova'}</p></div>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
          <Link href="/perfil" aria-label={`Mi perfil y cuenta: ${name}, ${role}`} className="min-w-0 max-w-[11rem] rounded-md text-right outline-offset-4 sm:max-w-xs" title={fullName}><p className="truncate text-sm font-semibold" data-testid="header-user-name">{name}</p><p className="truncate text-xs text-muted-foreground" data-testid="header-user-role">{role}</p></Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="size-11 shrink-0" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => setLogoutOpen(true)}><LogOut className="size-5" /></Button>
        </div>
      </header>
      <p className="truncate border-b bg-card px-4 py-1 text-xs text-muted-foreground sm:hidden">{company?.nombre || "Finova"}</p>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 lg:p-8"><div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div></main>
    </div>
    <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}><DialogContent className="top-0 left-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw_-_3rem))] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-r bg-card p-0 sm:max-w-none"><DialogTitle className="sr-only">Menú de navegación</DialogTitle><DialogDescription className="sr-only">Selecciona una sección de Finova.</DialogDescription>{sidebarContent}</DialogContent></Dialog>
    <Dialog open={logoutOpen} onOpenChange={open => { if (!loggingOut) setLogoutOpen(open); }}><DialogContent showCloseButton={!loggingOut}><DialogHeader><DialogTitle>¿Cerrar sesión?</DialogTitle><DialogDescription>Asegúrate de guardar los formularios abiertos antes de salir.</DialogDescription></DialogHeader>{logoutError && <p role="alert" className="text-destructive">{logoutError}</p>}<DialogFooter><Button variant="outline" disabled={loggingOut} onClick={() => setLogoutOpen(false)}>Continuar trabajando</Button><Button disabled={loggingOut} onClick={handleLogout}>{loggingOut && <Loader2 className="mr-2 size-4 animate-spin" />}Cerrar sesión</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
