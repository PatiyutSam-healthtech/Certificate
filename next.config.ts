import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages ship native workers/wasm that must be loaded via Node's
  // own `require` resolution rather than bundled, or their worker/wasm
  // assets fail to resolve at runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
