import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Permite envio de logos/fotos em data URL maiores que 1MB.
      bodySizeLimit: "5mb",
    },
  },
  // Instrui o bundler a NUNCA empacotar estes módulos em nenhum bundle
  // (Edge Runtime, Server Components, Route Handlers, etc.).
  // Eles ficam como require() externos no Node.js runtime da Vercel.
  // Sem esta configuração, o Turbopack pode incluir silenciosamente
  // código que usa __dirname (Prisma, ws) em contextos Edge.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "ws",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "bcryptjs",
  ],
};

export default nextConfig;
