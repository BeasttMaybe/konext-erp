import path from "node:path";
import type { NextConfig } from "next";

/**
 * O master le um arquivo do ERP (../lib/modulos/catalogo.ts, o catalogo de
 * modulos) — a raiz do Turbopack e do rastreio de arquivos e o repositorio
 * inteiro, nao so a pasta master/.
 */
const raizDoRepositorio = path.resolve(__dirname, "..");

const cabecalhos = [
  // O master nunca e carregado dentro de moldura, nem por ele mesmo.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Fora dos buscadores.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const config: NextConfig = {
  turbopack: { root: raizDoRepositorio },
  outputFileTracingRoot: raizDoRepositorio,
  poweredByHeader: false,
  // Mesmo motivo do ERP: Prisma, ws e o driver do Neon ficam como require()
  // externos no Node, nunca empacotados.
  serverExternalPackages: ["@prisma/client", "@prisma/client-central", "prisma", "ws", "@prisma/adapter-neon", "@neondatabase/serverless", "bcryptjs"],
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
};

export default config;
