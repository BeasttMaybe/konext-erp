import { unstable_rethrow } from "next/navigation";

import { ShellDashboard } from "@/components/shell/shell-dashboard";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterPermissoesDoContexto } from "@/lib/auth/permissoes";
import { ProvedorPermissoes } from "@/contextos/contexto-permissoes";
import { ProvedorLoja } from "@/contextos/contexto-loja";
import { PERFIL_VAZIO, ProvedorPerfil, type PerfilDaMoldura } from "@/contextos/contexto-perfil";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";

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
/**
 * Nome, e-mail, foto e logo para a moldura — lidos AQUI, uma vez, em vez de
 * cada barra ir buscar sozinha depois de montada (ver contexto-perfil.tsx).
 *
 * O contexto de quem esta logado ja foi resolvido nesta mesma renderizacao e
 * esta memorizado, entao isto custa so as duas leituras do banco da loja.
 *
 * Nunca lanca: foto e logo sao enfeite. Se a leitura falhar, as barras caem
 * nos substitutos que ja tinham (a marca "K", as iniciais) — exatamente o
 * que faziam quando a busca delas falhava.
 */
async function carregarPerfilDaMoldura(): Promise<PerfilDaMoldura> {
  try {
    const dados = await obterDadosPerfilConfiguracao();

    return {
      nome: dados.usuario.nome ?? "",
      email: dados.usuario.email ?? "",
      fotoPerfilUrl: dados.usuario.fotoPerfilUrl,
      logoUrl: dados.configuracao.logoUrl,
    };
  } catch (erro) {
    // O redirecionamento de sessao expirada chega aqui como erro: precisa subir.
    unstable_rethrow(erro);
    return PERFIL_VAZIO;
  }
}

export default async function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await exigirContextoTenant();
  const { papel, permissoes } = obterPermissoesDoContexto(contexto);
  const perfil = await carregarPerfilDaMoldura();

  return (
    <ProvedorPermissoes papel={papel} permissoes={permissoes}>
      {/* O slug sai do contexto que já foi resolvido acima — nenhuma consulta
          a mais. É o que permite os botões de link público montarem o
          endereço de rastreio sem ir ao servidor a cada clique. */}
      <ProvedorLoja slug={contexto.tenantSlug}>
        <ProvedorPerfil perfil={perfil}>
          <ShellDashboard>{children}</ShellDashboard>
        </ProvedorPerfil>
      </ProvedorLoja>
    </ProvedorPermissoes>
  );
}
