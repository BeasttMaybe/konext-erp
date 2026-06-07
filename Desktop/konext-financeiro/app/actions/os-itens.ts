"use server";

import { revalidatePath } from "next/cache";
import type { TipoPeca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularPrecoVendaPeca } from "@/lib/utils/precificacao";
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

  const valorCobrado =
    tipoPeca === "OUTROS" ? valorManual : calcularPrecoVendaPeca(tipoPeca, custoPeca);

  if (valorCobrado <= 0) {
    throw new Error("Informe um valor manual valido para itens do tipo OUTROS.");
  }

  const prismaAny = prisma as any;
  const delegate = prismaAny.itemOS ?? prismaAny.ItemOS;

  if (!delegate?.create) {
    throw new Error("Delegate Prisma de ItemOS nao disponivel.");
  }

  try {
    await delegate.create({
      data: {
        osId,
        descricao,
        tipoPeca,
        custoPeca,
        valorCobrado,
      },
    });
  } catch {
    // Fallback para schema antigo enquanto a migracao ainda nao foi aplicada.
    await delegate.create({
      data: {
        ordemServicoId: osId,
        descricao,
        tipo: tipoPeca,
        custoPeca,
        valorCobrado,
      },
    });
  }

  revalidatePath(`/os/${osId}`);
  revalidatePath("/os");
}
