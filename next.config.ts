import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/*": ["./data/rulings/**"] },
  agentRules: false,
  // FR-11/FR-12: `next dev` would print every Server Function's arguments (Tokens, edit
  // secrets) to stdout, and forward guests' browser console warnings to the Host's terminal.
  logging: { serverFunctions: false, browserToTerminal: false },
  // The link page's URL never leaves in a Referer (AD-7); the Token is in the fragment anyway.
  async headers() {
    return [
      {
        source: "/svar/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
