/**
 * Chave de unicidade a partir de um nome digitado por gente.
 *
 * Existe porque, em todo cadastro que a loja alimenta à mão, a mesma coisa é
 * digitada de três jeitos: "Original", "original " e "ORIGINÁL". Se a
 * unicidade for pela string crua, as três coexistem — e todo relatório que
 * agrupa por elas passa a mostrar três linhas para a mesma coisa. A chave é o
 * nome normalizado, e a normalização mora aqui, num só lugar.
 *
 * Nasceu em `lib/dominio/os/marcas-peca.ts` e foi extraída quando as
 * categorias de produto passaram a ser cadastradas pelo dono e precisaram da
 * mesma regra. Duas cópias da mesma normalização divergiriam na primeira
 * mudança, e aí "Capas" cadastrado de um lado deixaria de bater com "capas"
 * do outro.
 */

/**
 * Minúsculas, sem acento, sem espaço duplicado nas pontas ou no meio.
 *
 * `NFD` separa a letra do acento e o intervalo U+0300–U+036F remove as marcas
 * de combinação que sobram.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Como o nome é exibido e gravado: espaços colapsados, acento preservado. */
export function formatarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

export type ValidacaoDeNome =
  | { valido: true; nome: string; nomeNormalizado: string }
  | { valido: false; erro: string };

/**
 * Valida um nome de cadastro e já devolve as duas formas (exibição e chave),
 * pra action nunca montar a chave por conta própria.
 *
 * As mensagens são passadas por quem chama porque elas aparecem na tela do
 * dono: "Informe o nome da marca" e "Informe o nome da categoria" são erros
 * diferentes para quem lê, mesmo sendo a mesma regra aqui.
 */
export function validarNomeDeCadastro(
  nomeBruto: string,
  opcoes: {
    tamanhoMaximo: number;
    erroVazio: string;
    erroLongo: string;
    erroSemLetraOuNumero: string;
  }
): ValidacaoDeNome {
  const nome = formatarNome(nomeBruto);

  if (nome.length === 0) {
    return { valido: false, erro: opcoes.erroVazio };
  }

  if (nome.length > opcoes.tamanhoMaximo) {
    return { valido: false, erro: opcoes.erroLongo };
  }

  const nomeNormalizado = normalizarNome(nome);

  // Sem pelo menos uma letra ou um dígito não há nome: "---" e um nome feito só
  // de acentos combinantes (que a normalização remove por completo) não servem
  // como chave de agrupamento nem como rótulo numa tela.
  if (!/[a-z0-9]/.test(nomeNormalizado)) {
    return { valido: false, erro: opcoes.erroSemLetraOuNumero };
  }

  return { valido: true, nome, nomeNormalizado };
}
