import type { DadosConfiguracoes } from "@/app/actions/configuracoes";

export const TEXTO_COBERTURA_GARANTIA_PADRAO =
  "A garantia cobre exclusivamente o serviço executado e as peças substituídas nesta Ordem de Serviço, desde que o defeito apresentado esteja diretamente relacionado ao reparo realizado.";

export const TEXTO_EXCLUSOES_GARANTIA_PADRAO =
  "A garantia não cobre mau uso, queda, oxidação, umidade, danos por líquido, abertura por terceiros, defeitos não relacionados ao reparo, acessórios não inclusos na OS, perda de dados ou danos preexistentes.";

export const TEXTO_RESPONSABILIDADE_DADOS_PADRAO =
  "A assistência técnica não se responsabiliza por perda de dados, arquivos, fotos, vídeos, aplicativos, senhas, contas, backups ou informações pessoais armazenadas no aparelho. Recomenda-se que o cliente realize backup antes de qualquer procedimento técnico.";

export type ConfiguracaoOsGarantias = Pick<
  DadosConfiguracoes,
  | "habilitarMargemAutomatica"
  | "prazoGarantiaPadraoDias"
  | "prazoMinimoGarantiaDias"
  | "prazoMaximoGarantiaDias"
  | "exigirGarantiaAntesEntrega"
  | "exigirItemParaGarantia"
  | "exigirItemParaEnviarPDV"
  | "exigirDiagnosticoParaFinalizar"
  | "custoPecaOSJaPago"
  | "permitirFinalizarSemPagamento"
  | "permitirGarantiaPersonalizada"
  | "textoCoberturaGarantia"
  | "textoExclusoesGarantia"
  | "textoResponsabilidadeDados"
>;

export function obterDefaultsConfiguracaoOsGarantias(): ConfiguracaoOsGarantias {
  return {
    habilitarMargemAutomatica: true,
    prazoGarantiaPadraoDias: 90,
    prazoMinimoGarantiaDias: 1,
    prazoMaximoGarantiaDias: 365,
    exigirGarantiaAntesEntrega: true,
    exigirItemParaGarantia: true,
    exigirItemParaEnviarPDV: true,
    exigirDiagnosticoParaFinalizar: false,
    // Peça de conserto é comprada por serviço e, no caso comum, paga no ato:
    // o custo entra no financeiro já quitado, em vez de virar conta a pagar
    // esperando baixa de algo que já foi pago.
    custoPecaOSJaPago: true,
    permitirFinalizarSemPagamento: true,
    permitirGarantiaPersonalizada: true,
    textoCoberturaGarantia: TEXTO_COBERTURA_GARANTIA_PADRAO,
    textoExclusoesGarantia: TEXTO_EXCLUSOES_GARANTIA_PADRAO,
    textoResponsabilidadeDados: TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
  };
}

export function normalizarTextoGarantia(valor: string | null | undefined, fallback: string): string {
  const texto = String(valor ?? "").trim();
  return texto || fallback;
}

export function montarFaixaGarantia(
  configuracao: Pick<DadosConfiguracoes, "prazoMinimoGarantiaDias" | "prazoMaximoGarantiaDias">
): string {
  return `${configuracao.prazoMinimoGarantiaDias} a ${configuracao.prazoMaximoGarantiaDias} dias`;
}

export function mensagemIndicaRuntimeLegadoConfiguracao(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : "";
  return mensagem.includes("Unknown argument") || mensagem.includes("Invalid `") || mensagem.includes("configuracao.findFirst");
}