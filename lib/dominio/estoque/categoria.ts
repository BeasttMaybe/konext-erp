/**
 * Regras das categorias de produto.
 *
 * Antes eram cinco valores fixos num enum do schema — ACESSORIO, PECA_REPARO,
 * EQUIPAMENTO_REDE, SERVICO, OUTROS — e nenhuma linha do sistema se comportava
 * diferente por causa deles: serviam só de rótulo na tela e de filtro na lista.
 * Ou seja, eram um cadastro travado em código por acidente, e qualquer
 * categoria nova ("Capas", "Películas", "Fones") exigia migration e deploy.
 *
 * Agora são cadastro do dono, no mesmo formato das marcas de peça: nome como
 * ele escreve e nome normalizado como chave de unicidade.
 */

import { validarNomeDeCadastro, type ValidacaoDeNome } from "@/lib/dominio/texto/chave-de-nome";

/** Nome mais longo que isso não é categoria, é descrição no campo errado. */
export const TAMANHO_MAXIMO_NOME_CATEGORIA = 40;

/**
 * As cinco que existiam no enum, na ordem em que apareciam, com o rótulo que
 * a tela já mostrava. A migration semeia exatamente estas e liga cada produto
 * à sua — nenhum produto fica sem categoria, e nada do que estava cadastrado
 * muda de nome.
 *
 * Fica aqui, e não só no SQL, porque a migration e o código precisam concordar
 * sobre a chave normalizada de cada uma.
 */
export const CATEGORIAS_HERDADAS_DO_ENUM = [
  { enum: "ACESSORIO", nome: "Acessório" },
  { enum: "PECA_REPARO", nome: "Peça de reparo" },
  { enum: "EQUIPAMENTO_REDE", nome: "Equipamento de rede" },
  { enum: "SERVICO", nome: "Serviço" },
  { enum: "OUTROS", nome: "Outros" },
] as const;

export function validarNomeCategoria(nomeBruto: string): ValidacaoDeNome {
  return validarNomeDeCadastro(nomeBruto, {
    tamanhoMaximo: TAMANHO_MAXIMO_NOME_CATEGORIA,
    erroVazio: "Informe o nome da categoria.",
    erroLongo: `O nome da categoria deve ter no máximo ${TAMANHO_MAXIMO_NOME_CATEGORIA} caracteres.`,
    erroSemLetraOuNumero: "Informe um nome de categoria com letras ou números.",
  });
}

export type MotivoBloqueioDesativacao = "TEM_PRODUTO_ATIVO" | "ULTIMA_ATIVA";

export type DecisaoDesativacao = { permitido: true } | { permitido: false; erro: string };

/**
 * Categoria em uso não é desativada.
 *
 * Desativar escondendo a categoria de um produto que a usa deixaria produto
 * ativo com categoria fantasma: ele continua aparecendo na lista, mas o filtro
 * por categoria não acha mais. Melhor dizer o que falta mover.
 *
 * E a última categoria ativa também não sai: sem nenhuma, o cadastro de
 * produto fica sem opção para escolher, e ninguém consegue cadastrar nada.
 */
export function podeDesativarCategoria(parametros: {
  produtosAtivosNaCategoria: number;
  categoriasAtivasNoTotal: number;
}): DecisaoDesativacao {
  const { produtosAtivosNaCategoria, categoriasAtivasNoTotal } = parametros;

  if (produtosAtivosNaCategoria > 0) {
    return {
      permitido: false,
      erro:
        produtosAtivosNaCategoria === 1
          ? "Há 1 produto ativo nesta categoria. Mova-o para outra antes de desativar."
          : `Há ${produtosAtivosNaCategoria} produtos ativos nesta categoria. Mova-os para outra antes de desativar.`,
    };
  }

  if (categoriasAtivasNoTotal <= 1) {
    return {
      permitido: false,
      erro: "Esta é a única categoria ativa. Crie outra antes de desativar esta.",
    };
  }

  return { permitido: true };
}
