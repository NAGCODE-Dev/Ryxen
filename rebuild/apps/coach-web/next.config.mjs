import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rebuildRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: rebuildRoot,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
