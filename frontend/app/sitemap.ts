import type { MetadataRoute } from "next";

const publicPaths = ["", "/services", "/why-sathos", "/how-it-works", "/security", "/pricing", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({ url: `https://sathos.in${path}` }));
}
