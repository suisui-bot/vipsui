import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "photo.yupoo.com",
      },
      {
        protocol: "https",
        hostname: "xcimg.szwego.com",
      },
    ],
  },
};

export default nextConfig;
