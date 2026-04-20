import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  api: {
    bodyParser: false,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
