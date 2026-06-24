import { PainelPlaceholder } from "./painel-placeholder";

export function PainelOs() {
  return (
    <PainelPlaceholder
      titulo="Ordens de Serviço"
      descricao="Defina preferências gerais do fluxo operacional das OS."
      itens={[
        "Preferências de abertura e triagem",
        "Parâmetros de execução e conclusão",
        "Padronização de impressão e comunicação",
        "Indicadores e alertas operacionais",
      ]}
    />
  );
}
