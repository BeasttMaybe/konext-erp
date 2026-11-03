/**
 * Stand-in de `@prisma/client` para os testes de `verificacao/`.
 *
 * Esses testes só precisam do construtor de SQL (`Prisma.sql`), que mora no
 * runtime do cliente e não depende de `prisma generate`. Com este shim a
 * verificação roda em qualquer máquina com um Postgres, inclusive onde o
 * binário do Prisma não baixa — e o módulo sob teste
 * (`lib/propostas/consulta.ts`) continua importando `@prisma/client` como
 * qualquer outro arquivo do projeto, sem nenhum código condicional de teste.
 *
 * Quem fala com o banco nos testes é `pg`, nunca o Prisma: este shim não abre
 * conexão nenhuma.
 */

import * as runtime from "@prisma/client/runtime/client.js";

/** O mínimo que um SQL montado precisa expor pros testes. */
export type SqlMontado = {
  /** Consulta com placeholders no estilo Postgres ($1, $2...). */
  text: string;
  values: unknown[];
};

const runtimeTipado = runtime as unknown as {
  sqltag: (strings: TemplateStringsArray, ...valores: unknown[]) => SqlMontado;
  Sql: new (strings: string[], valores: unknown[]) => SqlMontado;
};

export const Prisma = {
  sql: runtimeTipado.sqltag,
  Sql: runtimeTipado.Sql,
  raw: (texto: string) => new runtimeTipado.Sql([texto], []),
};
