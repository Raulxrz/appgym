import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  // Las plantillas se leen con fs en tiempo de ejecución: hay que incluirlas en el despliegue.
  outputFileTracingIncludes: { "/api/routines": ["./templates/**"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default config;
