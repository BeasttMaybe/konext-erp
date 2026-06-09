"use server";

import { revalidatePath } from "next/cache";
import type { TipoPeca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

const tiposPecaValidos: TipoPeca[] = [
  "TELA",
  "BATERIA",
  "CONECTOR_CARGA",
  "TAMPA_IPHONE",
  "TAMPA_ANDROID",
  "OUTROS",
];

function paraNumero(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return numero;
}

export async function adicionarItemOS(osId: string, data: any) {
  // C1: exige sessao valida antes de inserir item na OS.
  await exigirSessao();

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const descricao = String(data?.descricao ?? "").trim();
  const tipoPeca = String(data?.tipoPeca ?? "") as TipoPeca;
  const custoPeca = paraNumero(data?.custoPeca);
  const valorManual = paraNumero(data?.valorManual);

  if (!descricao) {
    throw new Error("A descricao do item e obrigatoria.");
  }

  if (!tiposPecaValidos.includes(tipoPeca)) {
    throw new Error("Tipo de peca invalido.");
  }

  if (custoPeca < 0) {
    throw new Error("O custo da peca nao pode ser negativo.");
  }

  // O valor cobrado ao cliente é sempre o informado manualmente — sem cálculo automático de markup.
  const valorCobrado = valorManual;

  if (valorCobrado <= 0) {
    throw new Error("Informe um valor cobrado ao cliente válido (maior que zero).");
  }

  const prismaAny = prisma as any;
  const delegate = prismaAny.itemOS ?? prismaAny.ItemOS;

  if (!delegate?.create) {
    throw new Error("Delegate Prisma de ItemOS nao disponivel.");
  }

  // Usa transaction para garantir que o item e a despesa financeira sejam criados juntos.
  await prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const txItemOS = txAny.itemOS ?? txAny.ItemOS;
    const txDespesa = txAny.despesa ?? txAny.Despesa;
    const txParcelaDespesa = txAny.parcelaDespesa ?? txAny.ParcelaDespesa;

    if (!txItemOS?.create) {
      throw new Error("Delegate Prisma de ItemOS nao disponivel na transacao.");
    }

    // 1. Insere o item na OS
    try {
      await txItemOS.create({
        data: { osId, descricao, tipoPeca, custoPeca, valorCobrado },
      });
    } catch {
      // Fallback para schema antigo enquanto a migração ainda não foi aplicada.
      await txItemOS.create({
        data: { ordemServicoId: osId, descricao, tipo: tipoPeca, custoPeca, valorCobrado },
      });
    }

    // 2. Cria despesa financeira automática caso a peça tenha custo registrado.
    if (custoPeca > 0 && txDespesa?.create && txParcelaDespesa?.create) {
      // Busca o número da OS para compor a descrição legível
      const osAny = txAny.ordemServico ?? txAny.OrdemServico;
      const numeroOs = osAny?.findUnique
        ? (await osAny.findUnique({ where: { id: osId }, select: { numeroOs: true } }))?.numeroOs ?? osId
        : osId;

      const despesa = await txDespesa.create({
        data: {
          fornecedor: "Custo de peça (OS)",
          descricao: `Custo de Peça - OS #${numeroOs} - ${descricao}`,
          valorTotal: custoPeca,
          tipo: "UNICA",
          qtdParcelas: 1,
        },
      });

      // Cria a parcela única com vencimento para hoje e status PENDENTE
      await txParcelaDespesa.create({
        data: {
          despesaId: despesa.id,
          numeroParcela: 1,
          valor: custoPeca,
          dataVencimento: new Date(),
          status: "PENDENTE",
        },
      });
    }
  });

  revalidatePath(`/os/${osId}`);
  revalidatePath("/os");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
}
