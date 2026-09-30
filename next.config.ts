import type { NextConfig } from "next";

// Static export. Set BASE_PATH (e.g. "/halden") when hosting under a sub-path.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH || undefined,
  images: { unoptimized: true },
  // a stray lockfile in the home folder otherwise makes Turbopack guess the wrong root
  turbopack: { root: process.cwd() },
};

export default nextConfig;
