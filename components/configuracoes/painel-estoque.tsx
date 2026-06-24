import { PainelPlaceholder } from "./painel-placeholder";

export function PainelEstoque() {
  return (
    <PainelPlaceholder
      titulo="Estoque"
      descricao="Controle preferências de movimentação, baixa e disponibilidade de itens."
      itens={[
        "Parâmetros de entrada e saída",
        "Políticas de baixa e reserva",
        "Alertas de estoque crítico",
        "Padronização de inventário",
      ]}
    />
  );
}
