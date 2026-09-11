import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos are resized in the browser first; this leaves room for ones that can't be (HEIC outside Safari).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
