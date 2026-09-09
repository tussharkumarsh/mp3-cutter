import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["busboy"],
  output: "standalone",
};

export default nextConfig;
