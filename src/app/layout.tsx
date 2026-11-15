import { PwaRegistration } from "@/components/PwaRegistration";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import type { Metadata,Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finova - Sistema de Préstamos",
  description: "Gestión integral de préstamos personales y microcréditos",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#18181b" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
          <PwaRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
