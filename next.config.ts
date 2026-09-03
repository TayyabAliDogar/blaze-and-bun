import type { NextConfig } from "next";

// HSTS must only be sent over real HTTPS in production — never in local dev
// where the server runs over plain http://localhost (it would force browsers
// to upgrade and break the dev loop).
const IS_PROD = process.env.NODE_ENV === "production";
const FORCE_HTTPS = process.env.FORCE_HTTPS === "true" || process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: never embed the app in a frame.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops MIME-type sniffing attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // Limit leaking resources across origins (defense in depth).
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          // HSTS forces HTTPS in production once the site is served over TLS.
          ...(IS_PROD || FORCE_HTTPS
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          { key: "Link", value: "<https://images.unsplash.com>; rel=preconnect; crossorigin" },
        ],
      },
    ];
  },
};

export default nextConfig;