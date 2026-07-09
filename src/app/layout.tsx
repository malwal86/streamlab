import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamLab — Java Pipeline Visualizer",
  description:
    "A 3D 'neural conduit' that faithfully simulates Java Stream execution semantics — lazy, demand-driven, one element at a time.",
};

export const viewport: Viewport = {
  themeColor: "#05060a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
