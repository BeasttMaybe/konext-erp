This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Build

- `npm run build:local` — gera os clients Prisma e compila com `next build`. Não toca em nenhum banco de dados. Use este para verificar tipos/build localmente, especialmente com um `.env` de teste ativo.
- `npm run build` — pipeline de deploy: além do build, roda `prisma migrate deploy` (via `scripts/migrate-deploy-com-retry.mjs`) contra o banco apontado pelo `DATABASE_URL`/`AMBIENTE` ativos. É o que a Vercel executa. **Nunca rode `npm run build` localmente com o `.env` de produção ativo** — ele aplica migrations de verdade. O script imprime o host mascarado e o `AMBIENTE` alvo antes de migrar, para deixar claro o que está prestes a mudar.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
