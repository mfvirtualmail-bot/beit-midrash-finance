/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // @react-pdf/renderer loads NotoSansHebrew TTF from disk at runtime.
    // Vercel's file-trace strips anything not reachable via static import,
    // so explicitly include the fonts/ directory and the bundled logo for
    // every route that renders a PDF. (Next 14 keeps this under
    // `experimental`; in Next 15 it moves to the top level.)
    outputFileTracingIncludes: {
      '/api/statements/pdf': ['./fonts/**/*', './public/logo.png'],
      '/api/members/collection-pdf': ['./fonts/**/*', './public/logo.png'],
      '/api/email/send-statement': ['./fonts/**/*', './public/logo.png'],
    },
  },
}
module.exports = nextConfig
