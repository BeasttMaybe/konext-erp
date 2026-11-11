import { Prisma } from "@prisma/client";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";

type LinhaTotal = {
  total: string | null;
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

/**
 * POR QUE AS CONTAS VINDAS DO BLING FICAM FORA DA RECEITA
 *
 * Toda regra de receita deste arquivo soma contas a receber marcadas como
 * RECEBIDO, datando-as por `COALESCE(dataRecebimento, criadoEm)`. O
 * `criadoEm` como reserva funciona para conta lançada aqui — ela é criada
 * perto de quando é recebida — e é VENENO para conta importada: a
 * importação traz anos de histórico e cria tudo hoje.
 *
 * Foi exatamente o que aconteceu. O painel mostrou R$ 97.692,45 de
 * faturamento em novembro, enquanto o gráfico logo abaixo dizia "sem receita
 * no período": um ano inteiro de notas do Bling, já pagas lá atrás, tinha
 * sido datado pelo dia da importação.
 *
 * Datar pelo vencimento resolveria o mês, mas gravaria no campo de
 * recebimento uma data que não é a do recebimento — a API do Bling não
 * manda essa data na listagem. Então a escolha é não contar: nota emitida no
 * Bling tem o seu próprio total, na tela de Notas Fiscais, e misturá-la ao
 * faturamento sem data real de pagamento troca um número errado por outro.
 *
 * Se um dia essa receita precisar entrar aqui, o caminho é buscar a data de
 * baixa no detalhe da conta no Bling — uma decisão deliberada, não um efeito
 * colateral da importação.
 */
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
        SELECT COALESCE(SUM(base.valor), 0)::text AS total
        FROM (
          SELECT v."valorTotal" AS valor
          FROM "Venda" v
          LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
          LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
          LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
          WHERE v."estornadaEm" IS NULL
            AND v."criadoEm" >= ${inicio}
            AND v."criadoEm" <= ${fim}
            AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))
            AND (
              os.id IS NULL
              OR os."ehRetornoGarantia" = false
              OR COALESCE(rg."houveCobranca", false) = true
              OR COALESCE(rg."valorAdicional", 0) > 0
            )

          UNION ALL

          SELECT cr.valor AS valor
          FROM "ContaReceber" cr
          LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
          LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
          WHERE cr."estornadaEm" IS NULL
            AND cr.status::text = 'RECEBIDO'
            AND cr."vendaId" IS NULL
            AND COALESCE(cr."dataRecebimento", CASE WHEN cr."blingParcelaRef" IS NULL THEN cr."criadoEm" END) >= ${inicio}
            AND COALESCE(cr."dataRecebimento", CASE WHEN cr."blingParcelaRef" IS NULL THEN cr."criadoEm" END) <= ${fim}
            AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))
            AND (
              os.id IS NULL
              OR os."ehRetornoGarantia" = false
              OR COALESCE(rg."houveCobranca", false) = true
              OR COALESCE(rg."valorAdicional", 0) > 0
            )
        ) base
      `;

      return paraMoeda(deDecimal(linhas[0]?.total ?? 0));
    }

    const linhasLegado = await client.$queryRaw<LinhaTotal[]>`
      SELECT COALESCE(SUM(base.valor), 0)::text AS total
      FROM (
        SELECT v."valorTotal" AS valor
        FROM "Venda" v
        LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
        LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
        WHERE v."estornadaEm" IS NULL
          AND v."criadoEm" >= ${inicio}
          AND v."criadoEm" <= ${fim}
          AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))

        UNION ALL

        SELECT cr.valor AS valor
        FROM "ContaReceber" cr
        LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
        WHERE cr."estornadaEm" IS NULL
            AND cr.status::text = 'RECEBIDO'
          AND cr."vendaId" IS NULL
          AND COALESCE(cr."dataRecebimento", CASE WHEN cr."blingParcelaRef" IS NULL THEN cr."criadoEm" END) >= ${inicio}
          AND COALESCE(cr."dataRecebimento", CASE WHEN cr."blingParcelaRef" IS NULL THEN cr."criadoEm" END) <= ${fim}
          AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))
      ) base
    `;

    console.error("[dashboard:raw] schema legado detectado para receita total", contextoSchema);
    return paraMoeda(deDecimal(linhasLegado[0]?.total ?? 0));
  } catch (erro) {
    registrarErroRawDashboard("obterReceitaTotalPadrao", erro);
    throw erro;
  }
}
