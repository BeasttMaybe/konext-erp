import { FormularioDeProposta } from "@/components/crm/propostas/formulario-de-proposta";

/**
 * O formulário em si mora em `components/crm/propostas/formulario-de-proposta`,
 * porque a tela de editar usa exatamente o mesmo. Sem proposta = criar.
 */
export default function NovaPropostaPage() {
  return <FormularioDeProposta />;
}
