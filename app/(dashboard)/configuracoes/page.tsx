import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { LayoutConfiguracoes } from "@/components/configuracoes/layout-configuracoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temAlgumaPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Configurações | Konext" };

/**
 * Configurações (Fase 3-2E) — shell no design system. O cabeçalho
 * (eyebrow "Configurações" + título da seção ativa) mora dentro de
 * LayoutConfiguracoes: a seção ativa é estado de cliente, esta página é
 * servidor.
 */
export default async function ConfiguracoesPage() {
  const contexto = await exigirContextoTenant();

  if (
    !temAlgumaPermissao(contexto, [
      "configuracoes.empresa",
      "configuracoes.sistema",
      "configuracoes.usuarios",
    ])
  ) {
    return <AcessoNegado />;
  }

  const configuracoes = await obterConfiguracoes();

  return (
    <div className="flex h-[calc(100vh-72px)] w-full flex-col overflow-hidden bg-kx-fundo p-5 lg:h-[calc(100vh-104px)] lg:p-6 xl:h-[calc(100vh-120px)]">
      <LayoutConfiguracoes defaultValues={configuracoes} />
    </div>
  );
}
