import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { listarMarcasPeca } from "@/app/actions/marcas-peca";
import { listarCategoriasProduto } from "@/app/actions/categorias-produto";
import { LayoutConfiguracoes } from "@/components/configuracoes/layout-configuracoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temAlgumaPermissao, temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";
import { EstadoDoSistema } from "@/components/configuracoes/estado-do-sistema";
import { lerEstadoDoSistema } from "@/lib/sistema/estado";
import { errosRecentesDaLoja } from "@/lib/sistema/registrar-erro";

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
  const podeGerirCadastros = temPermissao(contexto, "configuracoes.sistema");
  const marcasPeca = podeGerirCadastros ? await listarMarcasPeca() : null;

  // `listarCategoriasProduto` pede `estoque.ver`, mas renomear e desativar
  // pedem `configuracoes.sistema` — mostrar a lista a quem não pode mexer
  // nela seria oferecer controles que falham no clique.
  // E sem o modulo Estoque contratado nao ha categoria de produto a gerir
  // (estoque.ver some junto com o modulo — lib/modulos/catalogo.ts).
  const categoriasProduto =
    podeGerirCadastros && temPermissao(contexto, "estoque.ver") ? await listarCategoriasProduto() : null;
  const erros = podeGerirCadastros ? await errosRecentesDaLoja(contexto.empresaId) : null;

  return (
    <div className="flex w-full flex-col bg-kx-fundo p-5 lg:p-6">
      <LayoutConfiguracoes
        defaultValues={configuracoes}
        marcasPeca={marcasPeca}
        categoriasProduto={categoriasProduto}
      />

      {/* So para quem administra o sistema: e informacao de operacao, e o
          aviso pede uma acao na hospedagem que so o dono pode tomar. */}
      {podeGerirCadastros ? <EstadoDoSistema estado={lerEstadoDoSistema(process.env)} erros={erros} modulosAtivos={contexto.modulosAtivos ? [...contexto.modulosAtivos] : undefined} /> : null}
    </div>
  );
}
