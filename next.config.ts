import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sites/Vinext serves the official UED asset directly. This also keeps the
  // exact approved logo bytes instead of routing them through an optimizer.
  images: { unoptimized: true },
};

export default nextConfig;
