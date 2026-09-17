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

- `npm run build` — gera os dois clients Prisma (tenant e central) e compila com `next build`. **Não toca em nenhum banco de dados** e não exige nenhuma variável de conexão para rodar. É o que a Vercel executa.
- `npm run build:local` — alias de `npm run build`, mantido por compatibilidade com scripts e documentação antigos.

> Até a Fase 0, `npm run build` também rodava `prisma migrate deploy`. Migrations deixaram de fazer parte do build: elas agora só são aplicadas por decisão explícita de um operador.

## Banco de dados

- `npm run db:backup` — gera dumps (`pg_dump --format=custom`) do banco central e de cada tenant ativo em `backups/<AAAAMMDD-HHmm>/`, com `manifest.json`. Somente leitura. Ver `docs/operacao/backup-restore.md`.
- `npm run db:diagnostico` — coleta somente-leitura de migrations, schema real, drift e censo de dados em `docs/diagnostico/`. Não grava nada nos bancos.
- `npm run db:migrate:deploy:manual` — aplica migrations de verdade no banco apontado por `DATABASE_URL`. Imprime o host mascarado e o `AMBIENTE` alvo e **aborta** a menos que `CONFIRMAR_MIGRACAO=SIM` esteja definido. Faça backup antes.

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
