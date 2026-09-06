/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gurmego/shared", "@gurmego/api-client"],
};
module.exports = nextConfig;
