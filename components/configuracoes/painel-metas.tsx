import { PainelPlaceholder } from "./painel-placeholder";

export function PainelMetas() {
  return (
    <PainelPlaceholder
      titulo="Metas"
      descricao="Defina preferências iniciais do módulo de metas e indicadores."
      itens={[
        "Periodicidade padrão de metas",
        "Critérios de medição e consolidação",
        "Alertas e marcos de acompanhamento",
        "Padrões de painéis executivos",
      ]}
    />
  );
}
