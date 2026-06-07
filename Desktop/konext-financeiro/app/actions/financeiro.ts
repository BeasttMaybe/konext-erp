"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao, obterUsuarioSessao } from "@/lib/auth/sessao";

export interface ContaReceberFinanceiro {
  id: string;
  descricao: string;
  origem: string;
  valor: number;
  dataVencimento: Date;
  dataRecebimento: Date | null;
  status: "PENDENTE" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  cliente: {
    nomeRazaoSocial: string;
  } | null;
}

export async function listarContasReceber(): Promise<ContaReceberFinanceiro[]> {
  // Leitura: sem sessão válida, não expõe dados financeiros.
  const usuario = await obterUsuarioSessao();
  if (!usuario) {
    return [];
  }

  try {
    const contas = await prisma.contaReceber.findMany({
      orderBy: {
        dataVencimento: "asc",
      },
      select: {
        id: true,
        descricao: true,
        origem: true,
        valor: true,
        dataVencimento: true,
        dataRecebimento: true,
        status: true,
        cliente: {
          select: {
            nomeRazaoSocial: true,
          },
        },
      },
    });

    return contas;
  } catch (erro) {
    console.error("Erro ao listar contas a receber:", erro);
    return [];
  }
}

type ResultadoBaixaConta = { sucesso: boolean; erro: string | null };

export async function darBaixaConta(id: string): Promise<ResultadoBaixaConta> {
  try {
    // Mutação sensível: exige sessão autenticada no backend.
    await exigirSessao();

    if (!id || typeof id !== "string") {
      return { sucesso: false, erro: "Identificador da conta inválido." };
    }

    await prisma.contaReceber.update({
      where: {
        id,
      },
      data: {
        status: "RECEBIDO",
        dataRecebimento: new Date(),
      },
    });

    revalidatePath("/financeiro");

    return { sucesso: true, erro: null };
  } catch (erro) {
    console.error("Erro ao dar baixa na conta:", erro);
    const mensagem =
      erro instanceof Error && erro.message.includes("Sessão")
        ? erro.message
        : "Não foi possível registrar o recebimento. Tente novamente.";
    return { sucesso: false, erro: mensagem };
  }
}
