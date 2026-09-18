import { ShellDashboard } from "@/components/shell/shell-dashboard";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterPermissoesDoContexto } from "@/lib/auth/permissoes";
import { ProvedorPermissoes } from "@/contextos/contexto-permissoes";

/**
 * Layout do Dashboard (Fase 3-1, Parte 3): barra lateral fixa + barra
 * superior + conteúdo — ver components/shell/shell-dashboard.tsx. Substitui
 * o cabeçalho único de navegação no topo (Fase 1B) pelo shell aprovado.
 *
 * Resolve o contexto do tenant aqui (uma vez por navegação) para alimentar o
 * provedor de permissões que toda a árvore client-side consome. Se a sessão
 * estiver expirada ou invalida, `exigirContextoTenant` redireciona para
 * /login?expirada=1 em vez de lançar — nenhuma página do dashboard precisa
 * tratar isso individualmente.
 */
export default async function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await exigirContextoTenant();
  const { papel, permissoes } = obterPermissoesDoContexto(contexto);

  return (
    <ProvedorPermissoes papel={papel} permissoes={permissoes}>
      <ShellDashboard>{children}</ShellDashboard>
    </ProvedorPermissoes>
  );
}
