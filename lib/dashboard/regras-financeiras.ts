import { Prisma } from "@prisma/client";

type LinhaMesReceita = {
  mes: Date;
  total: number | null;
};

type LinhaTotal = {
  total: number | null;
};

type LinhaClienteReceita = {
  clienteNome: string | null;
  total: number | null;
};

export type ReceitaCliente = {
  nome: string;
  valor: number;
};

export type ReceitaMensal = {
  mes: Date;
  valor: number;
};

type ContextoSchemaGarantiaRaw = {
  possuiTabelaRetornoGarantia: boolean;
  possuiColunaEhRetornoGarantia: boolean;
  possuiColunaRetornoGarantiaId: boolean;
};

type ClienteRegrasFinanceiras = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

const cacheContextoSchemaGarantiaRaw = new WeakMap<ClienteRegrasFinanceiras, ContextoSchemaGarantiaRaw>();

function serializarMetaErro(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }

  return Object.fromEntries(Object.entries(meta as Record<string, unknown>));
}

function registrarErroRawDashboard(contexto: string, erro: unknown): void {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[dashboard:raw] erro conhecido", {
      contexto,
      prismaCode: erro.code,
      message: erro.message,
      meta: serializarMetaErro(erro.meta),
    });
    return;
  }

  if (erro instanceof Error) {
    console.error("[dashboard:raw] erro", {
      contexto,
      message: erro.message,
      stack: erro.stack,
    });
    return;
  }

  console.error("[dashboard:raw] erro desconhecido", { contexto, erro: String(erro) });
}

async function obterContextoSchemaGarantiaRaw(client: ClienteRegrasFinanceiras): Promise<ContextoSchemaGarantiaRaw> {
  const cachePorClient = cacheContextoSchemaGarantiaRaw.get(client);
  if (cachePorClient) {
    return cachePorClient;
  }

  const [tabelaRetorno, colunaEhRetorno, colunaRetornoId] = await Promise.all([
    client.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'RetornoGarantiaOS'
      ) AS existe
    `,
    client.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'OrdemServico'
          AND column_name = 'ehRetornoGarantia'
      ) AS existe
    `,
    client.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'OrdemServico'
          AND column_name = 'retornoGarantiaId'
      ) AS existe
    `,
  ]);

  const contextoSchema = {
    possuiTabelaRetornoGarantia: Boolean(tabelaRetorno[0]?.existe),
    possuiColunaEhRetornoGarantia: Boolean(colunaEhRetorno[0]?.existe),
    possuiColunaRetornoGarantiaId: Boolean(colunaRetornoId[0]?.existe),
  };

  cacheContextoSchemaGarantiaRaw.set(client, contextoSchema);

  return contextoSchema;
}

function normalizarNomeCliente(valor: string | null): string {
  const nome = String(valor ?? "").trim();
  return nome.length > 0 ? nome : "Cliente nao identificado";
}

export async function obterReceitaTotalPadrao(
  inicio: Date,
  fim: Date,
  client: ClienteRegrasFinanceiras
): Promise<number> {
  try {
    const contextoSchema = await obterContextoSchemaGarantiaRaw(client);

    if (
      contextoSchema.possuiTabelaRetornoGarantia &&
      contextoSchema.possuiColunaEhRetornoGarantia &&
      contextoSchema.possuiColunaRetornoGarantiaId
    ) {
      const linhas = await client.$queryRaw<LinhaTotal[]>`
        SELECT COALESCE(SUM(base.valor), 0) AS total
        FROM (
          SELECT v."valorTotal"::double precision AS valor
          FROM "Venda" v
          LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
          LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
          LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
          WHERE v."criadoEm" >= ${inicio}
            AND v."criadoEm" <= ${fim}
            AND (os.id IS NULL OR os."excluidaEm" IS NULL)
            AND (
              os.id IS NULL
              OR os."ehRetornoGarantia" = false
              OR COALESCE(rg."houveCobranca", false) = true
              OR COALESCE(rg."valorAdicional", 0) > 0
            )

          UNION ALL

          SELECT cr.valor::double precision AS valor
          FROM "ContaReceber" cr
          LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
          LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
          WHERE cr.status::text = 'RECEBIDO'
            AND cr."vendaId" IS NULL
            AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
            AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
            AND (os.id IS NULL OR os."excluidaEm" IS NULL)
            AND (
              os.id IS NULL
              OR os."ehRetornoGarantia" = false
              OR COALESCE(rg."houveCobranca", false) = true
              OR COALESCE(rg."valorAdicional", 0) > 0
            )
        ) base
      `;

      return Number(linhas[0]?.total ?? 0);
    }

    const linhasLegado = await client.$queryRaw<LinhaTotal[]>`
      SELECT COALESCE(SUM(base.valor), 0) AS total
      FROM (
        SELECT v."valorTotal"::double precision AS valor
        FROM "Venda" v
        LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
        LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
        WHERE v."criadoEm" >= ${inicio}
          AND v."criadoEm" <= ${fim}
          AND (os.id IS NULL OR os."excluidaEm" IS NULL)

        UNION ALL

        SELECT cr.valor::double precision AS valor
        FROM "ContaReceber" cr
        LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
        WHERE cr.status::text = 'RECEBIDO'
          AND cr."vendaId" IS NULL
          AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
          AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
          AND (os.id IS NULL OR os."excluidaEm" IS NULL)
      ) base
    `;

    console.error("[dashboard:raw] schema legado detectado para receita total", contextoSchema);
    return Number(linhasLegado[0]?.total ?? 0);
  } catch (erro) {
    registrarErroRawDashboard("obterReceitaTotalPadrao", erro);
    throw erro;
  }
}

export async function obterReceitaMensalPadrao(
  inicio: Date,
  fim: Date,
  client: ClienteRegrasFinanceiras
): Promise<ReceitaMensal[]> {
  try {
    const contextoSchema = await obterContextoSchemaGarantiaRaw(client);
    const possuiCamposGarantia =
      contextoSchema.possuiTabelaRetornoGarantia &&
      contextoSchema.possuiColunaEhRetornoGarantia &&
      contextoSchema.possuiColunaRetornoGarantiaId;

    const linhas = possuiCamposGarantia
      ? await client.$queryRaw<LinhaMesReceita[]>`
          SELECT DATE_TRUNC('month', base.mes) AS mes, COALESCE(SUM(base.valor), 0) AS total
          FROM (
            SELECT v."criadoEm" AS mes, v."valorTotal"::double precision AS valor
            FROM "Venda" v
            LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
            WHERE v."criadoEm" >= ${inicio}
              AND v."criadoEm" <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
              AND (
                os.id IS NULL
                OR os."ehRetornoGarantia" = false
                OR COALESCE(rg."houveCobranca", false) = true
                OR COALESCE(rg."valorAdicional", 0) > 0
              )

            UNION ALL

            SELECT COALESCE(cr."dataRecebimento", cr."criadoEm") AS mes,
                   cr.valor::double precision AS valor
            FROM "ContaReceber" cr
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
            WHERE cr.status::text = 'RECEBIDO'
              AND cr."vendaId" IS NULL
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
              AND (
                os.id IS NULL
                OR os."ehRetornoGarantia" = false
                OR COALESCE(rg."houveCobranca", false) = true
                OR COALESCE(rg."valorAdicional", 0) > 0
              )
          ) base
          GROUP BY DATE_TRUNC('month', base.mes)
          ORDER BY DATE_TRUNC('month', base.mes) ASC
        `
      : await client.$queryRaw<LinhaMesReceita[]>`
          SELECT DATE_TRUNC('month', base.mes) AS mes, COALESCE(SUM(base.valor), 0) AS total
          FROM (
            SELECT v."criadoEm" AS mes, v."valorTotal"::double precision AS valor
            FROM "Venda" v
            LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            WHERE v."criadoEm" >= ${inicio}
              AND v."criadoEm" <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)

            UNION ALL

            SELECT COALESCE(cr."dataRecebimento", cr."criadoEm") AS mes,
                   cr.valor::double precision AS valor
            FROM "ContaReceber" cr
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            WHERE cr.status::text = 'RECEBIDO'
              AND cr."vendaId" IS NULL
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
          ) base
          GROUP BY DATE_TRUNC('month', base.mes)
          ORDER BY DATE_TRUNC('month', base.mes) ASC
        `;

    if (!possuiCamposGarantia) {
      console.error("[dashboard:raw] schema legado detectado para receita mensal", contextoSchema);
    }

    return linhas.map((linha) => ({
      mes: new Date(linha.mes),
      valor: Number(linha.total ?? 0),
    }));
  } catch (erro) {
    registrarErroRawDashboard("obterReceitaMensalPadrao", erro);
    throw erro;
  }
}

export async function obterReceitaPorClientePadrao(
  inicio: Date,
  fim: Date,
  limite: number,
  client: ClienteRegrasFinanceiras
): Promise<ReceitaCliente[]> {
  try {
    const contextoSchema = await obterContextoSchemaGarantiaRaw(client);
    const possuiCamposGarantia =
      contextoSchema.possuiTabelaRetornoGarantia &&
      contextoSchema.possuiColunaEhRetornoGarantia &&
      contextoSchema.possuiColunaRetornoGarantiaId;

    const linhas = possuiCamposGarantia
      ? await client.$queryRaw<LinhaClienteReceita[]>`
          SELECT base."clienteNome", COALESCE(SUM(base.valor), 0) AS total
          FROM (
            SELECT c."nomeRazaoSocial" AS "clienteNome", v."valorTotal"::double precision AS valor
            FROM "Venda" v
            LEFT JOIN "Cliente" c ON c.id = v."clienteId"
            LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
            WHERE v."criadoEm" >= ${inicio}
              AND v."criadoEm" <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
              AND (
                os.id IS NULL
                OR os."ehRetornoGarantia" = false
                OR COALESCE(rg."houveCobranca", false) = true
                OR COALESCE(rg."valorAdicional", 0) > 0
              )

            UNION ALL

            SELECT c."nomeRazaoSocial" AS "clienteNome", cr.valor::double precision AS valor
            FROM "ContaReceber" cr
            LEFT JOIN "Cliente" c ON c.id = cr."clienteId"
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
            WHERE cr.status::text = 'RECEBIDO'
              AND cr."vendaId" IS NULL
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
              AND (
                os.id IS NULL
                OR os."ehRetornoGarantia" = false
                OR COALESCE(rg."houveCobranca", false) = true
                OR COALESCE(rg."valorAdicional", 0) > 0
              )
          ) base
          GROUP BY base."clienteNome"
          ORDER BY total DESC
          LIMIT ${limite}
        `
      : await client.$queryRaw<LinhaClienteReceita[]>`
          SELECT base."clienteNome", COALESCE(SUM(base.valor), 0) AS total
          FROM (
            SELECT c."nomeRazaoSocial" AS "clienteNome", v."valorTotal"::double precision AS valor
            FROM "Venda" v
            LEFT JOIN "Cliente" c ON c.id = v."clienteId"
            LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            WHERE v."criadoEm" >= ${inicio}
              AND v."criadoEm" <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)

            UNION ALL

            SELECT c."nomeRazaoSocial" AS "clienteNome", cr.valor::double precision AS valor
            FROM "ContaReceber" cr
            LEFT JOIN "Cliente" c ON c.id = cr."clienteId"
            LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
            WHERE cr.status::text = 'RECEBIDO'
              AND cr."vendaId" IS NULL
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
              AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
              AND (os.id IS NULL OR os."excluidaEm" IS NULL)
          ) base
          GROUP BY base."clienteNome"
          ORDER BY total DESC
          LIMIT ${limite}
        `;

    if (!possuiCamposGarantia) {
      console.error("[dashboard:raw] schema legado detectado para receita por cliente", contextoSchema);
    }

    return linhas.map((linha) => ({
      nome: normalizarNomeCliente(linha.clienteNome),
      valor: Number(linha.total ?? 0),
    }));
  } catch (erro) {
    registrarErroRawDashboard("obterReceitaPorClientePadrao", erro);
    throw erro;
  }
}
