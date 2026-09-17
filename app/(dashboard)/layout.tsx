import { ConteudoPrincipal } from "@/components/layout/conteudo-principal";
import { Rodape } from "@/components/layout/rodape";
import { Cabecalho } from "@/components/layout/cabecalho";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterPermissoesDoContexto } from "@/lib/auth/permissoes";
import { ProvedorPermissoes } from "@/contextos/contexto-permissoes";

/**
 * Layout do Dashboard: cabeçalho único com a navegação, conteúdo e rodapé.
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
      <div className="min-h-screen flex flex-col bg-transparent">
        <Cabecalho />

        <ConteudoPrincipal>{children}</ConteudoPrincipal>

        <Rodape />
      </div>
    </ProvedorPermissoes>
  );
}
