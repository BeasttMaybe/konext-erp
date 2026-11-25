/**
 * Reconhece, pelo NOME do cliente, se uma nota é de prefeitura.
 *
 * Puro de propósito: sem rede, sem banco. É o reconhecimento que não depende
 * de o cliente estar cadastrado — notas para a prefeitura vêm com o nome no
 * padrão "PREFEITURA MUNICIPAL DE X" / "MUNICIPIO DE X" / "FUNDO MUNICIPAL
 * DE SAUDE DE X", e isso basta para classificar.
 *
 * O reconhecimento por CNPJ (cliente cadastrado como órgão público) continua
 * valendo em paralelo; este cobre o caso, mais comum, de a nota chegar sem
 * cliente no cadastro.
 */

function normalizar(texto: string): string {
  // Tira acentos ("município" -> "municipio") e baixa a caixa, para a busca
  // não depender de como o Bling escreveu.
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Verdadeiro quando o nome contém "prefeitura" ou "municip..." (municipio,
 * municipal, municipais). `\b` evita casar no meio de outra palavra.
 */
export function ehNomeDePrefeitura(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const n = normalizar(nome);
  return /\bprefeitura\w*/.test(n) || /\bmunicip\w*/.test(n);
}
