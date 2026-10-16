import type { Metadata, Viewport } from "next";
import { studio } from "@studio";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute base for link-preview images (og:image must be a full URL).
  metadataBase: new URL(process.env.APP_URL || `https://${studio.publicDomain}`),
  title: { default: studio.name, template: `%s | ${studio.name}` },
  // Galleries are private. Nothing on this site should ever show up in search.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#FBF8F4", width: "device-width", initialScale: 1 };

const fontUrl = (family: string) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = `https://fonts.googleapis.com/css2?${fontUrl(studio.font)}&${fontUrl(studio.bodyFont)}&display=swap`;
  return (
    <html
      lang="en"
      style={
        {
          "--accent": studio.accentColor,
          "--font-display-family": `'${studio.font}'`,
          "--font-body-family": `'${studio.bodyFont}'`,
        } as React.CSSProperties
      }
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fonts} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
