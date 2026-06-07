"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao, obterUsuarioSessao } from "@/lib/auth/sessao";

export interface ContaReceberFinanceiro {
  id: string;
  descricao: string;
  valor: number;
  clienteId: string | null;
  vendaId: string | null;
  dataVencimento: Date;
  dataRecebimento: Date | null;
  status: "PENDENTE" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  formaRecebimento:
    | "PIX"
    | "BOLETO"
    | "CARTAO_CREDITO"
    | "CARTAO_DEBITO"
    | "DINHEIRO"
    | "CREDIARIO"
    | "EMPENHO_PUBLICO";
  cliente: {
    nomeRazaoSocial: string;
  } | null;
}

export async function listarContasReceber(): Promise<ContaReceberFinanceiro[]> {
  // Leitura: sem sessao valida nao expoe dados financeiros.
  const usuario = await obterUsuarioSessao();
  if (!usuario) {
    return [];
  }

  const contas = await prisma.contaReceber.findMany({
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
    },
    orderBy: {
      dataVencimento: "asc",
    },
  });

  const prioridadePorStatus: Record<ContaReceberFinanceiro["status"], number> = {
    PENDENTE: 0,
    ATRASADO: 1,
    RENEGOCIADO: 2,
    RECEBIDO: 3,
  };

  return contas.sort((a, b) => {
    const prioridadeA = prioridadePorStatus[a.status];
    const prioridadeB = prioridadePorStatus[b.status];

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return a.dataVencimento.getTime() - b.dataVencimento.getTime();
  });
}

export async function darBaixaConta(id: string) {
  // C1: exige sessao valida antes de registrar recebimento.
  await exigirSessao();

  await prisma.contaReceber.update({
    where: {
      id,
    },
    data: {
      status: "RECEBIDO",
      dataRecebimento: new Date(),
    },
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
}
