"use server";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { deDecimal, paraMoeda, somar } from "@/lib/dinheiro";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * O que este cliente já trouxe e já comprou.
 *
 * O dono: "ao clicar no cadastro, abrisse um histórico das OS no nome desse
 * cliente e de vendas".
 *
 * O caso real é o balcão: o cliente chega, diz que o aparelho voltou a dar
 * problema, e quem atende precisa saber o que foi feito antes — e quando.
 * Hoje isso exige sair do cadastro, ir em Ordens de Serviço e procurar pelo
 * nome, torcendo para ter escrito igual.
 *
 * DUAS CONSULTAS, NÃO UMA SÓ COM `include`
 *
 * O cadastro do cliente carrega numa lista com dezenas de contatos. Trazer o
 * histórico junto de cada um seria pagar por todos para mostrar um. Isto é
 * buscado quando o painel do cliente abre, e só para aquele cliente.
 */

export type ItemDoHistorico = {
  id: string;
  /** "os" ou "venda" — decide o ícone, o link e o rótulo. */
  tipo: "os" | "venda";
  /** Número da OS, ou os primeiros caracteres do id da venda. */
  referencia: string;
  /** ISO. */
  data: string;
  descricao: string;
  /** Em reais. */
  valor: number;
  /** Texto curto de situação, já traduzido. */
  situacao: string;
  /** Verdadeiro quando a linha não vale dinheiro (venda estornada). */
  anulado: boolean;
};

export type HistoricoDoCliente = {
  itens: ItemDoHistorico[];
  quantidadeOs: number;
  quantidadeVendas: number;
  /** Soma do que o cliente já gastou, em reais, sem contar estorno. */
  totalGasto: number;
};

/**
 * Teto por tipo.
 *
 * Um painel lateral não é a tela de Ordens de Serviço: quem precisa ver tudo
 * vai à lista cheia. Aqui o que importa é o passado recente, que é o que
 * responde "o que já fizemos para este cliente?".
 */
const MAXIMO_POR_TIPO = 25;

const ROTULO_DE_STATUS_OS: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando orçamento",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADA: "Aprovada",
  EM_CONSERTO: "Em conserto",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  RECUSADA: "Recusada",
};

export async function obterHistoricoDoCliente(clienteId: string): Promise<HistoricoDoCliente> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "crm.ver");

  const prisma = contexto.prisma;

  const [ordens, vendas] = await Promise.all([
    prisma.ordemServico.findMany({
      where: { clienteId, excluidaEm: null },
      select: {
        id: true,
        numeroOs: true,
        equipamento: true,
        status: true,
        criadoEm: true,
        itens: { select: { valorCobrado: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: MAXIMO_POR_TIPO,
    }),
    prisma.venda.findMany({
      where: { clienteId },
      select: {
        id: true,
        valorTotal: true,
        criadoEm: true,
        estornadaEm: true,
        itens: { select: { id: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: MAXIMO_POR_TIPO,
    }),
  ]);

  const itensDeOs: ItemDoHistorico[] = ordens.map((ordem) => ({
    id: String(ordem.id),
    tipo: "os" as const,
    referencia: `#${ordem.numeroOs}`,
    data: ordem.criadoEm.toISOString(),
    descricao: ordem.equipamento || "Sem aparelho informado",
    valor: paraMoeda(
      somar(...ordem.itens.map((item) => deDecimal((item.valorCobrado ?? 0) as never)))
    ),
    situacao: ROTULO_DE_STATUS_OS[String(ordem.status)] ?? String(ordem.status),
    // OS cancelada ou recusada não entrou dinheiro, mas a linha continua
    // valendo como histórico: o cliente esteve aqui, e isso importa.
    anulado: String(ordem.status) === "CANCELADA" || String(ordem.status) === "RECUSADA",
  }));

  const itensDeVenda: ItemDoHistorico[] = vendas.map((venda) => {
    const quantidade = venda.itens.length;

    return {
      id: String(venda.id),
      tipo: "venda" as const,
      // A venda não tem número próprio; os primeiros caracteres do id são o
      // que aparece no recibo, então é por eles que ela é reconhecida.
      referencia: String(venda.id).slice(0, 8).toUpperCase(),
      data: venda.criadoEm.toISOString(),
      descricao: quantidade === 1 ? "1 item" : `${quantidade} itens`,
      valor: paraMoeda(deDecimal(venda.valorTotal)),
      situacao: venda.estornadaEm ? "Estornada" : "Concluída",
      anulado: venda.estornadaEm !== null,
    };
  });

  const itens = [...itensDeOs, ...itensDeVenda].sort((a, b) => b.data.localeCompare(a.data));

  // O total ignora o que foi anulado. Somar uma venda estornada aqui diria ao
  // balconista que o cliente gastou um dinheiro que voltou para ele.
  const totalGasto = paraMoeda(
    somar(...itens.filter((item) => !item.anulado).map((item) => Math.round(item.valor * 100)))
  );

  return {
    itens,
    quantidadeOs: itensDeOs.length,
    quantidadeVendas: itensDeVenda.length,
    totalGasto,
  };
}
