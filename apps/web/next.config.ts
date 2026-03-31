import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@copilot/core', '@copilot/connectors', '@copilot/portal-grip']
};

export default nextConfig;
