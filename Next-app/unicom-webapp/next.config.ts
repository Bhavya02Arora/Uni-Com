// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   output: 'export',
//   /* config options here */
// };

// export default nextConfig;

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // 👈 disables Next.js image optimization
  },
};

module.exports = nextConfig;