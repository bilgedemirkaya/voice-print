import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the tracing root to this project — there is an unrelated package-lock.json
  // in the home directory that Next would otherwise infer as the workspace root.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
