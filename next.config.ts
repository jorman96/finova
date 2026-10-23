import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  turbopack: {},
  env: { NEXT_PUBLIC_FINOVA_ENV: process.env.VERCEL_ENV || process.env.NODE_ENV || "development" },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] },
      { source: "/portal/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  async redirects() {
    return ["/inversionistas/index.html", "/inversionistas/js/:path*", "/inversionistas/css/:path*", "/inversionistas/styles.css"].map(source => ({ source, destination: "/inversionistas", permanent: false }));
  },
};

export default nextConfig;
