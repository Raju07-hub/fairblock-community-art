/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // jangan fail build kalau ada lint error
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
