import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font & logo dibaca dengan fs saat membuat PDF/Word penawaran.
  outputFileTracingIncludes: {
    "/modules/sales/**/*": ["./assets/fonts/**/*", "./assets/brand/**/*"],
    "/modules/logistics/**/*": ["./assets/fonts/**/*", "./assets/brand/**/*"],
  },
  // Kontrak pindah dari Sales & Marketing ke Contract & Shipping (link lama di notifikasi tetap jalan).
  async redirects() {
    return [
      { source: "/modules/sales/contracts", destination: "/modules/contract-shipping/contracts", permanent: true },
      { source: "/modules/sales/contracts/:path*", destination: "/modules/contract-shipping/contracts/:path*", permanent: true },
    ];
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
