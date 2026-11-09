"use server";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { deDecimal, paraMoeda, somar } from "@/lib/dinheiro";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * As ordens de serviço que podem ser faturadas no PDV agora.
 *
 * Existe porque o botão "Vincular OS · F4" do balcão não vinculava nada: ele
 * mostrava um aviso dizendo para abrir a OS e usar "Enviar para o PDV" por
 * lá. O caminho funcionava, mas era o mais longo possível — sair do PDV,
 * achar a OS numa lista, clicar, voltar — justamente no momento em que o
 * cliente está na frente do balcão esperando.
 *
 * O mecanismo de vínculo já existia (`/pdv?osId=…`); o que faltava era a
 * porta.
 *
 * A ELEGIBILIDADE É A MESMA DA TELA DA OS, de propósito
 *
 * Uma OS aparece aqui exatamente quando o botão "Enviar para o PDV"
 * apareceria lá: status PRONTO e ainda não faturada. Se as duas regras
 * divergissem, esta lista ofereceria OS que o PDV depois recusaria — e o
 * operador descobriria no meio do atendimento.
 *
 * Note que a exigência de ter item NÃO é aplicada aqui: ela é configurável
 * (`Configuracao.exigirItemParaEnviarPDV`) e conferida por
 * `obterPedidoOSParaPDV` na hora de carregar. Repetir a regra seria criar
 * uma segunda cópia dela, que um dia discordaria da primeira. O que a lista
 * faz é MOSTRAR quantos itens cada OS tem, para quem escolhe não precisar
 * adivinhar.
 */

export type OrdemProntaParaPDV = {
  id: string;
  numeroOs: number;
  clienteNome: string;
  equipamento: string | null;
  /** Em reais, só para exibir na lista. */
  valorTotal: number;
  quantidadeItens: number;
  /**
   * Última alteração da OS.
   *
   * Não existe campo "ficou pronta em" no modelo, então esta é a melhor
   * aproximação disponível. Serve para ordenar: a OS mexida há mais tempo é
   * a que está esperando há mais tempo.
   */
  atualizadaEm: string | null;
};

type OrdemLida = {
  id: string;
  numeroOs: number;
  equipamento: string | null;
  atualizadoEm: Date | null;
  cliente: { nomeRazaoSocial: string | null } | null;
  itens: Array<{ valorCobrado: unknown }>;
  transacoes: Array<{ vendaId: string | null; origem: string }>;
};

export async function listarOrdensProntasParaPDV(): Promise<OrdemProntaParaPDV[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");

  const delegate = (contexto.prisma as unknown as Record<string, {
    findMany?: (args: unknown) => Promise<OrdemLida[]>;
  }>).ordemServico;

  if (!delegate?.findMany) return [];

  const ordens = await delegate.findMany({
    where: { status: "PRONTO" },
    select: {
      id: true,
      numeroOs: true,
      equipamento: true,
      atualizadoEm: true,
      cliente: { select: { nomeRazaoSocial: true } },
      itens: { select: { valorCobrado: true } },
      transacoes: { select: { vendaId: true, origem: true } },
    },
    // Mais antiga primeiro: a OS pronta há mais tempo é a que está esperando
    // o cliente há mais tempo, e é a que some no fim de uma lista longa.
    orderBy: { atualizadoEm: "asc" },
    take: 200,
  });

  return ordens
    // Já faturada não entra: o PDV recusaria com "OS já vinculada", e
    // oferecer o que vai ser recusado é pior que não oferecer.
    .filter(
      (ordem) =>
        !ordem.transacoes.some(
          (transacao) => transacao.vendaId && String(transacao.origem) === "ORDEM_SERVICO"
        )
    )
    .map((ordem) => ({
      id: String(ordem.id),
      numeroOs: ordem.numeroOs,
      clienteNome: ordem.cliente?.nomeRazaoSocial ?? "Sem cliente",
      equipamento: ordem.equipamento,
      valorTotal: paraMoeda(
        somar(...ordem.itens.map((item) => deDecimal((item.valorCobrado ?? 0) as never)))
      ),
      quantidadeItens: ordem.itens.length,
      atualizadaEm: ordem.atualizadoEm?.toISOString() ?? null,
    }));
}
