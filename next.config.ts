import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
  // own file on disk; bundling it into the server chunk breaks that lookup.
  // @react-pdf/renderer pulls in @react-pdf/hyphenate, whose package.json
  // "exports" field omits the locale subpaths (e.g. "./en-us") it requires
  // internally — bundling breaks that resolution the same way.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@react-pdf/renderer"],
  // Skill markdown is read at runtime via fs (lib/loadSkill.ts); include it
  // in the serverless trace so Vercel/standalone deploys still ship the files.
  outputFileTracingIncludes: {
    "/api/**/*": ["./skills/**/*"],
  },
};

export default nextConfig;
