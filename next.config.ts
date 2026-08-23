import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js kendi worker/eval kurgusuyla geliyor; bundle'a girerse bozuluyor.
  // Sunucu tarafında Node tarafından doğrudan yüklensin.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
