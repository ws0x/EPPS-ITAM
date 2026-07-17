import type { NextConfig } from "next";

// Permissive-but-real CSP: allows what this app actually needs (self-hosted
// assets/fonts, Supabase auth/API calls) without breaking Next.js's own
// inline hydration scripts/styles, which a strict nonce-based CSP would
// require middleware changes to support - out of scope here since this
// couldn't be verified against a running browser in this environment.
// Tightening this further (nonces, dropping 'unsafe-inline') is a real
// follow-up, not a "done" item.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // CSP only in production - next dev's webpack HMR/React Refresh needs
  // 'unsafe-eval' and other allowances that would just add dev-time noise
  // here, and dev-server security isn't the concern this is addressing.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // No "preload" directive - that's a request to join the browser HSTS
  // preload list, effectively permanent once picked up. Not something to
  // opt into on the app's behalf without the domain owner deciding that.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
