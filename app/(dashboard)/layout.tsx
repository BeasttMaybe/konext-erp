import { ShellDashboard } from "@/components/shell/shell-dashboard";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterPermissoesDoContexto } from "@/lib/auth/permissoes";
import { ProvedorPermissoes } from "@/contextos/contexto-permissoes";
import { ProvedorLoja } from "@/contextos/contexto-loja";

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
      {/* O slug sai do contexto que já foi resolvido acima — nenhuma consulta
          a mais. É o que permite os botões de link público montarem o
          endereço de rastreio sem ir ao servidor a cada clique. */}
      <ProvedorLoja slug={contexto.tenantSlug}>
        <ShellDashboard>{children}</ShellDashboard>
      </ProvedorLoja>
    </ProvedorPermissoes>
  );
}
