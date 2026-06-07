/**
 * Rota raiz explícita — garante que "/" resolve corretamente no Vercel (Linux).
 *
 * Por que este arquivo existe:
 * O Next.js App Router mapeia app/(dashboard)/page.tsx → "/" via route groups,
 * mas em alguns ambientes de produção (ex.: Vercel / Linux case-sensitive) o
 * roteamento de route groups pode ser resolvido de forma diferente.
 * Este arquivo garante que "/" sempre retorna o dashboard sem depender apenas
 * do route group.
 *
 * Funciona como Server Component (sem "use client") para manter SSR total.
 */

export { default } from "@/app/(dashboard)/page";
