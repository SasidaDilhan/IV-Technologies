/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer ships ESM + native-ish deps that must not be bundled
    // into the server chunks; Next loads it from node_modules at runtime.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
