/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gurmego/shared", "@gurmego/api-client"],
  // Baseline security headers, mirroring apps/api's @fastify/helmet setup (main.ts) and
  // apps/web's next.config.js. No CSP yet -- see apps/web/next.config.js's comment; same tracked
  // follow-up applies here (this app also renders Supabase-auth'd content).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
