export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="finova-workspace min-h-dvh min-w-0 bg-muted/40">
      {children}
    </div>
  );
}
