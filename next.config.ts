import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "photo.yupoo.com",
      },
    ],
  },
};

export default nextConfig;
