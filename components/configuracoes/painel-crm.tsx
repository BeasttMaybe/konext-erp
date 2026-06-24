import { PainelPlaceholder } from "./painel-placeholder";

export function PainelCrm() {
  return (
    <PainelPlaceholder
      titulo="CRM"
      descricao="Ajuste informações e preferências relacionadas aos clientes."
      itens={[
        "Campos padrão de cadastro",
        "Preferências de relacionamento",
        "Regras de segmentação e etiquetas",
        "Modelos de comunicação comercial",
      ]}
    />
  );
}
