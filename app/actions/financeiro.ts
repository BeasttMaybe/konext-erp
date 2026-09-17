"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";

export interface ContaReceberFinanceiro {
  id: string;
  descricao: string;
  origem: string;
  valor: number;
  dataVencimento: Date;
  dataRecebimento: Date | null;
  status: "PENDENTE" | "PAGO" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  cliente: {
    nomeRazaoSocial: string;
  } | null;
}

export async function listarContasReceber(): Promise<ContaReceberFinanceiro[]> {
  // Leitura: sem sessão válida, não expõe dados financeiros.
  let contexto: Awaited<ReturnType<typeof exigirContextoTenant>>;
  try {
    contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.ver");
  } catch {
    return [];
  }
  const prisma = contexto.prisma;

  try {
    const contas = await prisma.contaReceber.findMany({
      orderBy: {
        dataVencimento: "asc",
      },
      where: {
        OR: [
          { cliente: { is: null } },
          { cliente: { is: { papel: "CLIENTE" } } },
        ],
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
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.baixar");
    const { prisma } = contexto;

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
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao dar baixa na conta:", erro);
    return { sucesso: false, erro: "Não foi possível registrar o recebimento. Tente novamente." };
  }
}
