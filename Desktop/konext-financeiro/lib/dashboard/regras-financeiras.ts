import { prisma } from "@/lib/prisma";

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

function normalizarNomeCliente(valor: string | null): string {
  const nome = String(valor ?? "").trim();
  return nome.length > 0 ? nome : "Cliente nao identificado";
}

export async function obterReceitaTotalPadrao(inicio: Date, fim: Date): Promise<number> {
  const linhas = await prisma.$queryRaw<LinhaTotal[]>`
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

export async function obterReceitaMensalPadrao(inicio: Date, fim: Date): Promise<ReceitaMensal[]> {
  const linhas = await prisma.$queryRaw<LinhaMesReceita[]>`
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
  `;

  return linhas.map((linha) => ({
    mes: new Date(linha.mes),
    valor: Number(linha.total ?? 0),
  }));
}

export async function obterReceitaPorClientePadrao(
  inicio: Date,
  fim: Date,
  limite: number
): Promise<ReceitaCliente[]> {
  const linhas = await prisma.$queryRaw<LinhaClienteReceita[]>`
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
  `;

  return linhas.map((linha) => ({
    nome: normalizarNomeCliente(linha.clienteNome),
    valor: Number(linha.total ?? 0),
  }));
}
