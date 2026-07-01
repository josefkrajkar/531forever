/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["u6t5c8dyncxpkzyj6cqzieel.macaly.dev"],
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  logging: {
    browserToTerminal: true,
  },
  reactStrictMode: true,
  images: { unoptimized: true },
  devIndicators: false,
};

module.exports = nextConfig;
