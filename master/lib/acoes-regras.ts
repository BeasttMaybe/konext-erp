import { ehIdDeModulo, type IdModulo } from "@erp/lib/modulos/catalogo";

/**
 * Regras puras das acoes do master (testadas em acoes-regras.test.ts).
 */

export const SITUACOES_DA_LOJA = ["ATIVA", "SUSPENSA"] as const;
export type SituacaoDaLoja = (typeof SITUACOES_DA_LOJA)[number];

export function validarModulo(modulo: string): modulo is IdModulo {
  return ehIdDeModulo(modulo);
}

/**
 * Suspender corta o acesso de todo mundo da loja na proxima tela — por isso
 * pede que se digite o identificador (slug) da loja, como confirmacao.
 * Reativar nao pede nada.
 */
export function conferirConfirmacao(situacao: SituacaoDaLoja, digitado: string, slug: string): string | null {
  if (situacao !== "SUSPENSA") return null;
  return digitado.trim() === slug ? null : `Para suspender, digite exatamente: ${slug}`;
}

/** Ligado e o padrao: ligar apaga a linha; desligar grava ativo=false. */
export function operacaoDoModulo(ativo: boolean): "apagar" | "gravar-desligado" {
  return ativo ? "apagar" : "gravar-desligado";
}
