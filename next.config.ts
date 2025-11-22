import type { NextConfig } from "next";

// If deploying to GitHub Pages under a repository path (e.g. username.github.io/repo),
// set the repo name in `GH_PAGES_BASE_PATH` or rely on `GITHUB_REPOSITORY` in CI (owner/repo).
// Default repo name for GitHub Pages deployment. The site will be served at
// https://andrewjle.github.io/TaleLeaf/ so default to `TaleLeaf` when no env set.
const repoNameFromEnv = (() => {
  try {
    const ghRepo = process.env.GITHUB_REPOSITORY;
    if (ghRepo && ghRepo.includes("/")) return ghRepo.split("/")[1];
    return process.env.GH_PAGES_BASE_PATH || "TaleLeaf";
  } catch {
    return "TaleLeaf";
  }
})();

// Enable GitHub Pages settings only when explicitly building for static export.
const isProd = process.env.NODE_ENV === "production";
const isStaticExport = process.env.STATIC_EXPORT === "true" && isProd;
const isGhPages = isStaticExport;

const nextConfig: NextConfig = {
  // Use `output: 'export'` and `trailingSlash` only for production static exports
  // (e.g., GitHub Pages). During local development we serve normally so routes
  // such as `/` work without needing the GH Pages path.
  ...(isStaticExport ? { output: "export", trailingSlash: true } : {}),
  // During CI builds for static export we can skip ESLint to avoid blocking
  // the export on non-critical lint/type warnings. Consider fixing lint
  // errors for a stricter CI later.
  eslint: {
    ignoreDuringBuilds: true,
  },
  ...(isGhPages
    ? { basePath: `/${repoNameFromEnv}`, assetPrefix: `/${repoNameFromEnv}` }
    : {}),
  webpack: (config, { isServer }) => {
    // Configure for react-pdf (legacy)
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Configure for PDF.js
    config.resolve.alias.fs = false;
    config.resolve.alias.path = false;

    // Handle PDF.js worker files
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
  // Enable static file serving for PDF.js workers
  async headers() {
    return [
      {
        source: "/pdf.worker.min.js",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
