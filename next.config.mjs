/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static, zero-serverless-function SPA (spec §2 "Rejected outright: any backend").
  // `export` emits pure static assets to `out/` — Vercel serves them with 0 functions.
  output: "export",
  reactStrictMode: true,
  // Static export cannot use the Next Image Optimizer (a serverless function).
  images: { unoptimized: true },
};

export default nextConfig;
