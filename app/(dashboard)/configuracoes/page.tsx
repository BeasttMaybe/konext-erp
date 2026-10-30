import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { listarMarcasPeca } from "@/app/actions/marcas-peca";
import { LayoutConfiguracoes } from "@/components/configuracoes/layout-configuracoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temAlgumaPermissao, temPermissao } from "@/lib/auth/permissoes";
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

  // `listarMarcasPeca` exige configuracoes.sistema, e esta pagina abre tambem
  // para quem so tem configuracoes.empresa ou .usuarios: buscar sem checar
  // derrubaria a pagina inteira pra esses usuarios.
  const marcasPeca = temPermissao(contexto, "configuracoes.sistema") ? await listarMarcasPeca() : null;

  return (
    <div className="flex w-full flex-col bg-kx-fundo p-5 lg:p-6">
      <LayoutConfiguracoes defaultValues={configuracoes} marcasPeca={marcasPeca} />
    </div>
  );
}
