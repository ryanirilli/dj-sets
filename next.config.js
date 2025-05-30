const packageJson = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_PRODUCT_NAME: packageJson.build.productName || "YourAppName", // Fallback just in case
    NEXT_PUBLIC_GITHUB_REPO: "ryanirilli/dj-sets", // Add your repo path here
  },
};

module.exports = nextConfig;
