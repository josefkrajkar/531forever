/** @type {import('next').NextConfig} */
const nextConfig = {
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
