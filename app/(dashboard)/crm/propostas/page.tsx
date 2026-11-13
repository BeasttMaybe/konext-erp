import { PaginaPropostas } from "@/components/crm/propostas/pagina-propostas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { hojeComoDataDeCalendario } from "@/lib/datas";

export const metadata = {
  title: "Propostas | TechOS ERP",
  description: "Orçamentos enviados, o que vence e quanto dos seus orçamentos fecha.",
};

/**
 * Casca de servidor. A lista e os filtros são do cliente (`PaginaPropostas`), e
 * a única coisa que precisa vir daqui é "hoje".
 *
 * Hoje vem do SERVIDOR, no fuso da loja, e não de `new Date()` no navegador:
 * quem abre o sistema de outro fuso veria "vence hoje" num dia diferente de
 * quem está na loja, e a validade de um orçamento não pode depender de onde
 * está quem olha a tela.
 */
export default async function PropostasPage() {
  const contexto = await exigirContextoTenant();
  const hojeIso = hojeComoDataDeCalendario(contexto.fusoHorario).toISOString();

  return <PaginaPropostas hojeIso={hojeIso} />;
}
