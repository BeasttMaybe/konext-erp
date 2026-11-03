/**
 * Roda o SQL da lista de propostas contra um Postgres DE VERDADE.
 *
 * Por que existe: `lib/propostas/consulta.ts` monta a ordem de urgência em SQL,
 * e a mesma regra existe em TypeScript em `lib/dominio/propostas/situacao.ts`.
 * Nenhum teste de unidade consegue dizer se as duas concordam — nem se o SQL
 * sequer é válido, já que um erro de sintaxe ou de nome de coluna só aparece
 * quando o banco recebe a consulta, ou seja, quando alguém abre a tela.
 *
 * Então aqui o teste cria as propostas, pede a ordem ao banco, calcula a mesma
 * ordem em TypeScript e compara. Se as duas implementações divergirem, isto
 * falha no CI.
 *
 * Não roda no `npm test`: `vitest.config.ts` só inclui `lib/`, `components/` e
 * `store/`. Roda via `npm run verificar:consultas`, com `SOMBRA_DATABASE_URL`
 * apontando pra um Postgres descartável — nunca um banco real. O CI usa o
 * mesmo serviço de Postgres do job que confere as migrations.
 */

import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  calcularSituacao,
  pesoDeUrgencia,
  type StatusProposta,
} from "@/lib/dominio/propostas/situacao";
import {
  filtroDeBusca,
  filtroDeSituacao,
  ordenacao,
  type FiltroSituacaoProposta,
  type OrdemProposta,
} from "@/lib/propostas/consulta";
import { Prisma } from "@prisma/client";

const CONEXAO = process.env.SOMBRA_DATABASE_URL;

const HOJE_ISO = "2026-11-15";
const HOJE = new Date(`${HOJE_ISO}T00:00:00.000Z`);

type Semente = {
  apelido: string;
  status: StatusProposta;
  /** Dias de hoje até a validade. Negativo = já venceu. */
  validadeEmDias: number;
  /** Dias de hoje até o próximo contato, ou `null` quando não há. */
  contatoEmDias: number | null;
  cliente: string;
  equipamento: string | null;
};

/**
 * Uma proposta por faixa de urgência, mais os empates que importam. A ordem
 * daqui NÃO é a ordem esperada de propósito: quem diz qual é a ordem esperada é
 * `pesoDeUrgencia`, e é isso que está sendo conferido.
 */
const SEMENTES: Semente[] = [
  { apelido: "vence-hoje", status: "ENVIADA", validadeEmDias: 0, contatoEmDias: null, cliente: "Marina Alves", equipamento: "iPhone 11" },
  { apelido: "vence-em-3", status: "ENVIADA", validadeEmDias: 3, contatoEmDias: null, cliente: "Joana Prado", equipamento: "Moto G54" },
  { apelido: "aguardando", status: "ENVIADA", validadeEmDias: 25, contatoEmDias: null, cliente: "Carlos Dias", equipamento: "Galaxy A15" },
  { apelido: "aguardando-com-contato-atrasado", status: "ENVIADA", validadeEmDias: 25, contatoEmDias: -2, cliente: "Bruno Lima", equipamento: null },
  { apelido: "venceu-ontem", status: "ENVIADA", validadeEmDias: -1, contatoEmDias: null, cliente: "Ana Paula", equipamento: "Redmi Note 12" },
  { apelido: "venceu-ha-muito", status: "ENVIADA", validadeEmDias: -200, contatoEmDias: null, cliente: "Rafael Souza", equipamento: "iPhone 8" },
  { apelido: "rascunho", status: "RASCUNHO", validadeEmDias: 10, contatoEmDias: null, cliente: "Tatiane Melo", equipamento: null },
  { apelido: "rascunho-prometido", status: "RASCUNHO", validadeEmDias: 10, contatoEmDias: -5, cliente: "Diego Castro", equipamento: "iPad Air" },
  { apelido: "aprovada", status: "APROVADA", validadeEmDias: -40, contatoEmDias: null, cliente: "Luciana Reis", equipamento: "Galaxy S21" },
  { apelido: "rejeitada", status: "REJEITADA", validadeEmDias: -60, contatoEmDias: null, cliente: "Pedro Nunes", equipamento: "Mi 11" },
];

function emDias(dias: number) {
  return new Date(HOJE.getTime() + dias * 86_400_000);
}

/**
 * A mesma data, como texto "yyyy-MM-dd", pra gravar no banco.
 *
 * Gravar o `Date` direto não serve: o driver `pg` serializa um Date pelo fuso
 * LOCAL da máquina, e a coluna é `timestamp without time zone`. Num runner em
 * UTC−3, a meia-noite UTC de 15/11 entra como 14/11 21:00 e `::date` devolve
 * o dia 14 — todas as datas do teste deslocadas um dia, e o teste acusando
 * divergência que não existe. (Foi o que aconteceu na primeira execução.) Texto
 * convertido pra timestamp não passa por fuso nenhum.
 *
 * A aplicação não tem esse problema porque o Prisma serializa em UTC, e é por
 * isso que `createProposta` ancora as datas de calendário em meia-noite UTC
 * (`dataDeCalendario`) em vez da meia-noite do processo.
 */
function emDiasIso(dias: number) {
  return emDias(dias).toISOString().slice(0, 10);
}

/** A ordem que o TypeScript diz ser a certa, pelos mesmos dados. */
function ordemEsperadaEmTypeScript(sementes: Semente[]): string[] {
  return [...sementes]
    .map((semente) => ({
      apelido: semente.apelido,
      peso: pesoDeUrgencia(
        calcularSituacao({
          status: semente.status,
          validade: emDias(semente.validadeEmDias),
          proximoContato: semente.contatoEmDias === null ? null : emDias(semente.contatoEmDias),
          hoje: HOJE,
        })
      ),
    }))
    .sort((a, b) => a.peso - b.peso)
    .map((linha) => linha.apelido);
}

const descrever = CONEXAO ? describe : describe.skip;

descrever("SQL da lista de propostas, contra um Postgres real", () => {
  const cliente = new Client({ connectionString: CONEXAO });
  const idPorApelido = new Map<string, string>();
  const apelidoPorId = new Map<string, string>();

  beforeAll(async () => {
    await cliente.connect();

    // O banco é descartável, mas ainda assim só mexe na tabela deste teste.
    await cliente.query('TRUNCATE TABLE "PropostaItem", "PropostaComercial" CASCADE');

    for (const [indice, semente] of SEMENTES.entries()) {
      const id = randomUUID();
      idPorApelido.set(semente.apelido, id);
      apelidoPorId.set(id, semente.apelido);

      await cliente.query(
        `INSERT INTO "PropostaComercial"
           ("id", "cliente", "equipamento", "defeito", "dataEmissao", "validade",
            "proximoContato", "subtotalBruto", "descontoTotal", "valorTotal",
            "status", "criadoEm", "atualizadoEm")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::"StatusPropostaComercial", $12, $12)`,
        [
          id,
          semente.cliente,
          semente.equipamento,
          "Não liga",
          emDiasIso(-30),
          emDiasIso(semente.validadeEmDias),
          semente.contatoEmDias === null ? null : emDiasIso(semente.contatoEmDias),
          "100.00",
          "0.00",
          // Valor crescente, pra ordem "maior_valor" ter o que distinguir.
          `${100 + indice * 10}.00`,
          semente.status,
          // `criadoEm` crescente: é o critério de desempate da urgência.
          new Date(HOJE.getTime() - (SEMENTES.length - indice) * 3_600_000),
        ]
      );
    }
  }, 30_000);

  afterAll(async () => {
    await cliente.end();
  });

  async function executar(sql: Prisma.Sql) {
    return cliente.query<{ id: string }>(sql.text, sql.values as unknown[]);
  }

  function consultaDeLista(
    situacao: FiltroSituacaoProposta,
    ordem: OrdemProposta,
    busca?: string
  ) {
    const onde = Prisma.sql`
      ${filtroDeSituacao(situacao, HOJE_ISO)}
      AND ${filtroDeBusca(busca)}`;

    return Prisma.sql`
      SELECT "PropostaComercial"."id" FROM "PropostaComercial"
      WHERE ${onde}
      ORDER BY ${ordenacao(ordem, HOJE_ISO)}
      LIMIT ${100} OFFSET ${0}`;
  }

  const situacoes: FiltroSituacaoProposta[] = [
    "ATENCAO",
    "EM_ABERTO",
    "RASCUNHO",
    "AGUARDANDO",
    "APROVADA",
    "REJEITADA",
    "TODAS",
  ];
  const ordens: OrdemProposta[] = ["urgencia", "recentes", "maior_valor"];

  it("toda combinação de filtro e ordem é SQL válido", async () => {
    // Erro de sintaxe, nome de coluna errado ou cast impossível aparece aqui, e
    // não na primeira vez que alguém abre a tela.
    for (const situacao of situacoes) {
      for (const ordem of ordens) {
        await expect(
          executar(consultaDeLista(situacao, ordem)),
          `${situacao} / ${ordem}`
        ).resolves.toBeTruthy();
      }
    }
  }, 30_000);

  it("a busca também é SQL válido, com e sem termo", async () => {
    await expect(executar(consultaDeLista("TODAS", "urgencia", "iPhone"))).resolves.toBeTruthy();
    await expect(executar(consultaDeLista("TODAS", "urgencia", "   "))).resolves.toBeTruthy();
  });

  it("a contagem roda com o mesmo filtro da lista", async () => {
    for (const situacao of situacoes) {
      const onde = Prisma.sql`
        ${filtroDeSituacao(situacao, HOJE_ISO)}
        AND ${filtroDeBusca(undefined)}`;
      const consulta = Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM "PropostaComercial" WHERE ${onde}`;

      const resultado = await cliente.query<{ total: string }>(
        consulta.text,
        consulta.values as unknown[]
      );
      expect(Number(resultado.rows[0].total), situacao).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);

  /**
   * O teste que justifica o arquivo: a ordem do banco e a ordem do TypeScript
   * têm que ser a mesma lista, nome por nome.
   */
  it("a ordem que o banco produz é a que pesoDeUrgencia calcula", async () => {
    const resultado = await executar(consultaDeLista("TODAS", "urgencia"));
    const doBanco = resultado.rows.map((linha) => apelidoPorId.get(linha.id));

    expect(doBanco).toEqual(ordemEsperadaEmTypeScript(SEMENTES));
  });

  it("os filtros selecionam exatamente o que a regra em TypeScript diz", async () => {
    const esperado = (filtro: (semente: Semente) => boolean) =>
      new Set(SEMENTES.filter(filtro).map((semente) => semente.apelido));

    const doBanco = async (situacao: FiltroSituacaoProposta) => {
      const resultado = await executar(consultaDeLista(situacao, "recentes"));
      return new Set(resultado.rows.map((linha) => apelidoPorId.get(linha.id)));
    };

    const situacaoDe = (semente: Semente) =>
      calcularSituacao({
        status: semente.status,
        validade: emDias(semente.validadeEmDias),
        proximoContato: semente.contatoEmDias === null ? null : emDias(semente.contatoEmDias),
        hoje: HOJE,
      });

    expect(await doBanco("EM_ABERTO")).toEqual(esperado((s) => situacaoDe(s).emAberto));

    expect(await doBanco("AGUARDANDO")).toEqual(
      esperado((s) => {
        const calculada = situacaoDe(s);
        return calculada.situacao === "AGUARDANDO" && !calculada.contatoAtrasado;
      })
    );

    expect(await doBanco("ATENCAO")).toEqual(
      esperado((s) => {
        const calculada = situacaoDe(s);
        if (!calculada.emAberto) return false;
        return (
          calculada.situacao === "VENCENDO" ||
          calculada.situacao === "VENCIDA" ||
          calculada.contatoAtrasado
        );
      })
    );

    expect(await doBanco("APROVADA")).toEqual(esperado((s) => s.status === "APROVADA"));
    expect(await doBanco("REJEITADA")).toEqual(esperado((s) => s.status === "REJEITADA"));
    expect(await doBanco("RASCUNHO")).toEqual(esperado((s) => s.status === "RASCUNHO"));
  }, 30_000);

  it("a busca encontra por cliente, equipamento e defeito", async () => {
    const porCliente = await executar(consultaDeLista("TODAS", "recentes", "marina"));
    expect(porCliente.rows.map((l) => apelidoPorId.get(l.id))).toEqual(["vence-hoje"]);

    const porEquipamento = await executar(consultaDeLista("TODAS", "recentes", "iPad"));
    expect(porEquipamento.rows.map((l) => apelidoPorId.get(l.id))).toEqual(["rascunho-prometido"]);

    // "Não liga" está em todas as sementes: a busca por defeito tem que achar
    // todas, e não nenhuma (seria o sintoma de um OR mal montado).
    const porDefeito = await executar(consultaDeLista("TODAS", "recentes", "não liga"));
    expect(porDefeito.rows).toHaveLength(SEMENTES.length);
  });

  it("a paginação não repete nem perde linha entre páginas", async () => {
    const pagina = (numero: number) => {
      const onde = Prisma.sql`
        ${filtroDeSituacao("TODAS", HOJE_ISO)}
        AND ${filtroDeBusca(undefined)}`;
      return Prisma.sql`
        SELECT "PropostaComercial"."id" FROM "PropostaComercial"
        WHERE ${onde}
        ORDER BY ${ordenacao("urgencia", HOJE_ISO)}
        LIMIT ${4} OFFSET ${(numero - 1) * 4}`;
    };

    // Uma por vez: um único `Client` do pg não aceita consultas concorrentes.
    const juntas: Array<string | undefined> = [];
    for (const numero of [1, 2, 3]) {
      const resultado = await executar(pagina(numero));
      juntas.push(...resultado.rows.map((linha) => apelidoPorId.get(linha.id)));
    }

    expect(new Set(juntas).size).toBe(SEMENTES.length);
    expect(juntas).toEqual(ordemEsperadaEmTypeScript(SEMENTES));
  });
});
