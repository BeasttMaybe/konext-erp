/**
 * Tipo da etapa ativa no balcão do PDV (Fase "PDV em 3 etapas"). Módulo
 * próprio (em vez de declarar o tipo dentro de page.tsx) porque tanto o
 * orquestrador (app/(dashboard)/pdv/page.tsx) quanto os componentes de
 * apresentação (barra de etapas, resumo da venda) precisam dele.
 */
export type EtapaPdv = "produto" | "cliente" | "pagamento";

export const ORDEM_ETAPAS_PDV: readonly EtapaPdv[] = ["produto", "cliente", "pagamento"];
