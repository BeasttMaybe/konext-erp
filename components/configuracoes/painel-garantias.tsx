import { PainelPlaceholder } from "./painel-placeholder";

export function PainelGarantias() {
  return (
    <PainelPlaceholder
      titulo="Garantias"
      descricao="Gerencie a base das configurações e documentos de garantia."
      itens={[
        "Parâmetros de prazo padrão",
        "Textos institucionais de cobertura",
        "Regras de emissão de termo",
        "Rastreabilidade de retornos",
      ]}
    />
  );
}
