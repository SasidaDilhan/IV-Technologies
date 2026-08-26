/** @type {import('next').NextConfig} */
const nextConfig = {
  // A production build writes to the same directory the dev server is serving
  // from, which leaves the running dev server with chunks that no longer match.
  // Setting NEXT_DIST_DIR lets a build go somewhere else so both can coexist:
  //   NEXT_DIST_DIR=.next-build npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",

  experimental: {
    // @react-pdf/renderer ships ESM + native-ish deps that must not be bundled
    // into the server chunks; Next loads it from node_modules at runtime.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
