import type { MetadataRoute } from "next";
import navigation from "./data/internalLinks.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = "https://vipsui.vercel.app";
  return [
    { url: `${origin}/` },
    { url: `${origin}/shop` },
    ...Object.keys(navigation.products).map((slug) => ({
      url: `${origin}/product/${slug}`,
    })),
  ];
}
