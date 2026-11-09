"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import type { StatusNotaFiscal } from "@prisma/client";
import { dataDeCalendario } from "@/lib/datas";

/**
 * Esta tela e SO CONSULTA.
 *
 * O cadastro manual de nota fiscal saiu: o dono nao cria nota aqui — ele
 * emite no Bling, que e onde esta o motor fiscal e a contabilidade. Um
 * formulario de "nova nota fiscal" num sistema que nao emite nota so permitia
 * criar um registro que nao corresponde a documento nenhum, e ocupava metade
 * da tela que deveria mostrar as notas de verdade.
 *
 * Se um dia for preciso lancar algo a mao, volta — mas volta como excecao
 * declarada, nao como a acao principal de uma tela de consulta.
 */

export type NotaFiscalLista = {
  id: string;
  numero: string;
  serie: string | null;
  chaveAcesso: string | null;
  /**
   * NULO = ainda não lido do Bling.
   *
   * Era `Number(valorTotal ?? 0)`: uma nota sem valor virava R$ 0,00 na tela
   * e somava zero no total, sem ninguém desconfiar. A listagem do Bling não
   * traz o valor — ele chega na sincronização seguinte —, então essa janela
   * existe de verdade e precisa aparecer como travessão.
   */
  valorTotal: number | null;
  status: StatusNotaFiscal;
  situacaoBling: number | null;
  dataEmissao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  /** Veio do Bling? É a presença do id de lá que diz. */
  doBling: boolean;
  /** Venda deste sistema reconhecida como esta nota. */
  pedidoId: string | null;
  numeroPedido: number | null;
  motivoSemVinculo: string | null;
  linkXml: string | null;
  linkDanfe: string | null;
  descricaoItens: string | null;
  criadoEm: string;
};

export type FiltroNotaFiscal = {
  busca?: string;
  status?: StatusNotaFiscal | "TODAS";
  /** "aaaa-mm-dd". A janela é pela EMISSÃO, que é a data que importa. */
  inicio?: string;
  fim?: string;
};

function normalizarTexto(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.trim();
}

export async function listarNotasFiscais(
  filtros: FiltroNotaFiscal = {}
): Promise<{ sucesso: true; dados: NotaFiscalLista[] } | { sucesso: false; erro: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.ver");
    const prisma = contexto.prisma;

    const where: Record<string, unknown> = {};

    if (filtros.status && filtros.status !== "TODAS") {
      where.status = filtros.status;
    }

    const busca = normalizarTexto(filtros.busca);
    if (busca) {
      // O NOME DO CLIENTE entrou na busca. Era só número e chave, e nenhuma
      // das duas é como alguém procura uma nota: ninguém lembra 44 dígitos,
      // e o número só serve se você já souber qual é. Quem procura, procura
      // pelo cliente.
      where.OR = [
        { numero: { contains: busca, mode: "insensitive" } },
        { chaveAcesso: { contains: busca, mode: "insensitive" } },
        { clienteNome: { contains: busca, mode: "insensitive" } },
        { cliente: { nomeRazaoSocial: { contains: busca, mode: "insensitive" } } },
        { descricaoItens: { contains: busca, mode: "insensitive" } },
      ];
    }

    const inicio = dataDeCalendario(filtros.inicio ?? "");
    const fim = dataDeCalendario(filtros.fim ?? "");

    if (inicio && fim) {
      where.dataEmissao = { gte: inicio, lte: fim };
    }

    const notas = await prisma.notaFiscal.findMany({
      where,
      // Pela emissão, que é a data que importa para quem procura uma nota.
      // Nota lançada à mão não tem emissão e cai depois, pela criação.
      orderBy: [{ dataEmissao: "desc" }, { criadoEm: "desc" }],
      select: {
        id: true,
        numero: true,
        serie: true,
        chaveAcesso: true,
        valorTotal: true,
        status: true,
        situacaoBling: true,
        dataEmissao: true,
        blingId: true,
        pedidoId: true,
        motivoSemVinculo: true,
        linkXml: true,
        linkDanfe: true,
        descricaoItens: true,
        clienteNome: true,
        criadoEm: true,
        clienteId: true,
        cliente: {
          select: {
            nomeRazaoSocial: true,
          },
        },
        pedido: {
          select: {
            numeroPedido: true,
          },
        },
      },
    });

    return {
      sucesso: true,
      dados: notas.map((nota) => ({
        id: nota.id,
        numero: nota.numero,
        chaveAcesso: nota.chaveAcesso,
        serie: nota.serie,
        // Sem `?? 0`: nota sem valor lido tem que aparecer como travessão,
        // não como R$ 0,00 somando zero no total.
        valorTotal: nota.valorTotal === null ? null : Number(nota.valorTotal),
        status: nota.status,
        situacaoBling: nota.situacaoBling,
        dataEmissao: nota.dataEmissao?.toISOString() ?? null,
        clienteId: nota.clienteId,
        // O nome do contato do Bling é a reserva: o cadastro de clientes da
        // Konext pode não ter esse cliente, e nota sem nome é pior que nota
        // com o nome que o Bling conhece.
        clienteNome: nota.cliente?.nomeRazaoSocial ?? nota.clienteNome ?? null,
        doBling: nota.blingId !== null,
        pedidoId: nota.pedidoId,
        numeroPedido: nota.pedido?.numeroPedido ?? null,
        motivoSemVinculo: nota.motivoSemVinculo,
        linkXml: nota.linkXml,
        linkDanfe: nota.linkDanfe,
        descricaoItens: nota.descricaoItens,
        criadoEm: nota.criadoEm.toISOString(),
      })),
    };
  } catch (erro) {
    console.error("Erro ao listar notas fiscais:", erro);
    return { sucesso: false, erro: "Nao foi possivel carregar as notas fiscais." };
  }
}

/**
 * Quantas notas existem no total, IGNORANDO o filtro de período.
 *
 * Existe para a tela poder dizer "79 no total, mostrando as 4 de novembro".
 * Sem isso, quem acabou de sincronizar vê quatro notas numa tela que filtra
 * pelo mês e conclui que a importação falhou — foi exatamente o que
 * aconteceu quando a busca só olhava 90 dias.
 */
export async function contarNotasFiscais(): Promise<number> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  return contexto.prisma.notaFiscal.count();
}
