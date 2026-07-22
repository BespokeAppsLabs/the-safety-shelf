import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Book covers uploaded to Convex storage (convex/schema.ts's
    // coverStorageId) are served from *.convex.cloud in production and
    // 127.0.0.1 against the local dev backend.
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

export default nextConfig;
