/** @type {import('next').NextConfig} */
const dotenv = require("dotenv");

dotenv.config();
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com", "randomuser.me"],
  },
  experimental: {
    reactRoot: true,
    suppressHydrationWarning: true,
  },
};

module.exports = nextConfig;
