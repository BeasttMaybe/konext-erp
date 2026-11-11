import type { NextConfig } from "next";

/**
 * Cabecalhos de seguranca de toda resposta.
 *
 * Nao havia nenhum. Cada um fecha uma classe de ataque que independe de
 * qualquer defeito no codigo do sistema:
 *
 * - X-Frame-Options / frame-ancestors: impede que outro site carregue o
 *   Konext dentro de uma moldura invisivel e induza um clique ("excluir",
 *   "pagar") em quem esta logado. `SAMEORIGIN` e nao `DENY` porque o proprio
 *   PDV mostra o recibo numa moldura da mesma origem.
 * - X-Content-Type-Options: o navegador nao "adivinha" que um arquivo
 *   enviado e HTML ou script quando o servidor disse que e imagem.
 * - Referrer-Policy: os links de foto e de rastreio carregam um segredo no
 *   caminho; sem isto, clicar num link externo a partir deles entregaria o
 *   endereco inteiro ao outro site.
 * - Strict-Transport-Security: depois da primeira visita o navegador recusa
 *   falar http com o dominio, mesmo que alguem na rede tente rebaixar.
 * - Permissions-Policy: a camera fica so para a propria origem (envio de
 *   foto); microfone, localizacao e pagamento, que o sistema nao usa, ficam
 *   desligados para qualquer script.
 *
 * O QUE FICOU DE FORA, DE PROPOSITO
 *
 * Uma Content-Security-Policy que restrinja `script-src`. E a defesa mais
 * forte contra XSS, mas o Next injeta scripts inline e exige nonce por
 * requisicao; ligada sem teste no navegador ela derruba a aplicacao inteira.
 * Fica como trabalho proprio, com tela aberta para conferir.
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Nao anunciar a tecnologia e a versao em toda resposta.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },
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
