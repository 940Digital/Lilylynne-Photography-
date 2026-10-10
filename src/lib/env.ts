// Everything the server reads from process.env. See .env.example.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get sessionSecret() { return required("SESSION_SECRET"); },
  get adminEmail() { return required("ADMIN_EMAIL"); },
  get adminPasswordHash() { return required("ADMIN_PASSWORD_HASH"); },
  get cronSecret() { return process.env.CRON_SECRET ?? ""; },
  get appUrl() { return (process.env.APP_URL ?? "").replace(/\/$/, ""); },
  r2: {
    get accountId() { return required("R2_ACCOUNT_ID"); },
    get accessKeyId() { return required("R2_ACCESS_KEY_ID"); },
    get secretAccessKey() { return required("R2_SECRET_ACCESS_KEY"); },
    get bucket() { return required("R2_BUCKET_NAME"); },
    // Override only for local development against scripts/mock-s3.mjs.
    get endpoint() { return process.env.R2_ENDPOINT ?? `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`; },
  },
};
