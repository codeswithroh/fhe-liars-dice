import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Strict Mode's dev-only double-mount briefly creates a second WebGL context for
  // every <Canvas>. Some sandboxed/software-rendered browsers cap total live WebGL
  // contexts very low, so the second mount immediately loses its context and the 3D scene
  // never renders in dev. Production builds don't double-invoke, so this is dev-only.
  reactStrictMode: false,

  // Production build uses `next build --webpack` (see package.json) -- Turbopack's
  // production build hangs on this project's dependency graph. Dev still runs on
  // Turbopack by default; an empty object here just silences Next's "no turbopack config"
  // warning.
  turbopack: {},

  // `@base-org/account`/`@coinbase/cdp-sdk` used to be aliased away here entirely (empty
  // stub) because their import chain reaches for `@x402/*` (Coinbase's payment protocol)
  // packages this app never installed. That was too broad: Privy genuinely needs the rest
  // of `@base-org/account` (its Coinbase Smart Wallet connector) at runtime, and stubbing
  // the whole package threw `TypeError: e is not a function` from inside Privy's own SDK
  // init. Stub only the actually-missing `@x402/*` leaves instead -- `@coinbase/cdp-sdk`'s
  // x402 payment feature (unused here) becomes a no-op, everything else resolves for real.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/svm": false,
      "@x402/evm": false,
    };
    return config;
  },
};

export default nextConfig;
