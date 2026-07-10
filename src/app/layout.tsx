import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamLab · Java Pipeline Visualizer",
  description:
    "A live flow-map that faithfully simulates Java Stream execution semantics: lazy, demand-driven, one element at a time.",
};

export const viewport: Viewport = {
  themeColor: "#05060a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Material Design 3 typography + icons (animation-and-ui-guidelines):
            Roboto / Roboto Mono for chrome, Material Symbols for transport icons.
            `display=swap` avoids FOIT; controls carry aria-labels so meaning never
            depends on the icon glyph if the font is slow or blocked. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Global site-wide fonts loaded once at the root layout (not per-page), so the
            @next/next/no-page-custom-font guidance about _document does not apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&family=Roboto:wght@400;500;600&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
