import { PainelPlaceholder } from "./painel-placeholder";

export function PainelFinanceiro() {
  return (
    <PainelPlaceholder
      titulo="Financeiro"
      descricao="Ajuste parâmetros gerais de contas, caixa e comportamento financeiro."
      itens={[
        "Regras de classificação e conciliação",
        "Preferências de vencimento e cobrança",
        "Padrões de caixa e fechamento",
        "Critérios de exibição analítica",
      ]}
    />
  );
}
