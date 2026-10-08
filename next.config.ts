/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/sharp/**/*',
      './node_modules/@img/**/*',
    ],
  },
};

module.exports = nextConfig;
