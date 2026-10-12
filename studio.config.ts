// The only file a new photographer needs to edit (plus environment variables).
// Every brand string and every limit in the gallery app reads from here.
export const studio = {
  name: "Lilylynne Photography",
  // File in /public. Set to null to show the studio name as a text wordmark.
  logoPath: null as string | null,
  accentColor: "#8E5F63", // dusty rose, matches the marketing site
  // Google Fonts family names. `font` is used for headings, `bodyFont` for everything else.
  font: "Fraunces",
  bodyFont: "Jost",
  publicDomain: "www.lilylynnephotography.com",
  adminContactEmail: "piperlvaughan@gmail.com",

  // Safety caps that keep the whole studio inside Cloudflare R2's free tier
  // (10 GB storage, 1M writes and 10M reads a month). The app refuses to go past them.
  maxTotalBytes: 8 * 1024 ** 3, // all galleries together
  monthlyReadBudget: 6_000_000, // signed read URLs issued per month (counts every thumbnail, preview, download)
  monthlyWriteBudget: 600_000, // upload URLs and list calls per month

  maxActiveGalleries: 30,
  maxBytesPerGallery: 5 * 1024 ** 3, // 5 GB, counts originals + previews + thumbnails + zip
  defaultExpiryDays: 60,

  // Expired galleries keep their files this many days before the cron deletes them.
  purgeGraceDays: 3,
  // The cron logs a reminder this many days before a gallery expires.
  warnDaysBeforeExpiry: 5,

  // Per-file limits for uploads (enforced on the server).
  maxOriginalBytes: 100 * 1024 * 1024,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export type StudioConfig = typeof studio;
