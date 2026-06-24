import { PainelPlaceholder } from "./painel-placeholder";

export function PainelPdv() {
  return (
    <PainelPlaceholder
      titulo="PDV e Vendas"
      descricao="Centralize preferências de vendas, recebimentos e formas de pagamento."
      itens={[
        "Comportamento de recebimento e troco",
        "Preferências de fechamento e impressão",
        "Parâmetros comerciais por canal",
        "Fluxos de atendimento e finalização",
      ]}
    />
  );
}
