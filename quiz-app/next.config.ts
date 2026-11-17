import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Applied to every response. The CSP only sets directives that can't break
// inline scripts, Google Sign-In, KaTeX or Sandpack: it blocks clickjacking,
// <base> hijacking, plugins and cross-site form posts.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/**": ["./data/timetable/**/*"],
    "/**": ["./data/timetable/**/*"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/timetable/terms/:file*",
          destination: "/api/timetable/terms/blocked",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "your-org-slug",
  project: "your-project-slug",
});
