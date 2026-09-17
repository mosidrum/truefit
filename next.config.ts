import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
  // own file on disk; bundling it into the server chunk breaks that lookup.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
