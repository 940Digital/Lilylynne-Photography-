import type { NextConfig } from "next";

// The marketing site is plain static HTML in /public. These rewrites keep its clean URLs.
// The gallery app lives under /admin, /g and /api and is not linked from the marketing site.
const noindex = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/gallery", destination: "/gallery.html" },
        { source: "/contact", destination: "/contact.html" },
      ],
    };
  },
  // The old static host served clean URLs and redirected the .html forms. Keep that behaviour.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/gallery.html", destination: "/gallery", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
    ];
  },
  async headers() {
    return ["/admin/:path*", "/g/:path*", "/api/:path*"].map((source) => ({ source, headers: noindex }));
  },
};

export default config;
