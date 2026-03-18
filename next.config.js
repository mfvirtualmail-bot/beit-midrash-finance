/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Ensure @sparticuz/chromium binary is bundled in serverless functions
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
  },
}
module.exports = nextConfig
