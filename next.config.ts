import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font & logo dibaca dengan fs saat membuat PDF/Word penawaran.
  outputFileTracingIncludes: {
    "/modules/sales/**/*": ["./assets/fonts/**/*", "./assets/brand/**/*"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
