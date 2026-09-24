import type { NextConfig } from "next";
import { devOrigins } from "./src/lib/dev-origins";

// Photo bytes go straight from the browser to storage, so nothing here needs the framework's
// server action body limit raised.
const nextConfig: NextConfig = {
  // So the site can be opened from a phone on the same network and still get its
  // JavaScript, which the globe is entirely made of. See `devOrigins`.
  allowedDevOrigins: devOrigins(),
};

export default nextConfig;
