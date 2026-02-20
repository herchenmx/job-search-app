import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Enable static export for Capacitor
  output: 'export',
  
  // Tell Next.js to put the static files in a folder called 'out'
  distDir: 'out',
  
  // Required for static export with images
  images: {
    unoptimized: true,
  },
  
  // Your existing config
  reactStrictMode: true,
};

// Wrap the config with PWA support
export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);