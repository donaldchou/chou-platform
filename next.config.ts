import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev indicator away from the sidebar's bottom-left buttons.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
