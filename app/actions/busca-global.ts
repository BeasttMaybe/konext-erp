"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { buscarClientesCRM } from "@/app/actions/crm";
import { paraMensagemSegura } from "@/lib/erros";

/**
 * Busca global do app shell (Fase 3-1, Parte 3 — Ctrl+K). Só cobre OS e
 * clientes: não existe hoje nenhuma action de busca de produto no formato
 * "digite e receba poucos resultados" (listarProdutosPaginado é uma tela
 * de listagem paginada, não uma busca de paleta) — escopo reduzido de
 * propósito, registrado no relatório final da fase em vez de construir uma
 * busca de produtos nova (o pedido permite isso explicitamente quando o
 * trabalho passaria de um dia).
 */

export type ResultadoOSBusca = {
  id: string;
  numeroOs: number;
  cliente: string;
  equipamento: string;
  status: string;
};

export type ResultadoClienteBusca = {
  id: string;
  nome: string;
  documento: string;
};

export type ResultadoBuscaGlobal = {
  ordens: ResultadoOSBusca[];
  clientes: ResultadoClienteBusca[];
};

export async function buscarGlobal(
  termo: string
): Promise<{ sucesso: true; dados: ResultadoBuscaGlobal } | { sucesso: false; erro: string }> {
  try {
    const termoNormalizado = termo.trim();
    if (termoNormalizado.length < 2) {
      return { sucesso: true, dados: { ordens: [], clientes: [] } };
    }

    const contexto = await exigirContextoTenant();
    const numeroBuscado = Number(termoNormalizado.replace(/\D/g, ""));
    const numeroValido = Number.isFinite(numeroBuscado) && numeroBuscado > 0;

    const [ordens, clientesCRM] = await Promise.all([
      contexto.prisma.ordemServico.findMany({
        // Escopo de visibilidade da Fase 1D-2 — nunca reimplementado aqui, sempre a mesma função.
        where: {
          ...escopoOrdemServico(contexto),
          excluidaEm: null,
          OR: [
            ...(numeroValido ? [{ numeroOs: numeroBuscado }] : []),
            { equipamento: { contains: termoNormalizado, mode: "insensitive" as const } },
            { cliente: { nomeRazaoSocial: { contains: termoNormalizado, mode: "insensitive" as const } } },
          ],
        },
        select: {
          id: true,
          numeroOs: true,
          equipamento: true,
          status: true,
          cliente: { select: { nomeRazaoSocial: true } },
        },
        take: 6,
        orderBy: { atualizadoEm: "desc" },
      }),
      temPermissao(contexto, "crm.ver") ? buscarClientesCRM(termoNormalizado) : Promise.resolve([]),
    ]);

    return {
      sucesso: true,
      dados: {
        ordens: ordens.map((os) => ({
          id: os.id,
          numeroOs: os.numeroOs,
          cliente: os.cliente.nomeRazaoSocial,
          equipamento: os.equipamento,
          status: os.status,
        })),
        clientes: clientesCRM
          .slice(0, 6)
          .map((cliente) => ({ id: cliente.id, nome: cliente.nomeRazaoSocial, documento: cliente.documento ?? "" })),
      },
    };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
