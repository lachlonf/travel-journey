import type { NextConfig } from "next";

// Photo bytes go straight from the browser to storage, so nothing here needs the framework's
// server action body limit raised.
const nextConfig: NextConfig = {};

export default nextConfig;
