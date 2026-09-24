/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gurmego/shared", "@gurmego/api-client"],
  // Baseline security headers, mirroring apps/api's @fastify/helmet setup (main.ts). No
  // Content-Security-Policy here yet -- this page loads Leaflet map tiles and Supabase auth from
  // external origins, and a CSP needs to be authored against those allow-lists and verified in a
  // real browser (not just a build pass) before it's safe to ship; tracked as a separate follow-up.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
