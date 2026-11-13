/**
 * Regras puras do cadastro de loja nova pelo master (testadas em
 * regras-loja-nova.test.ts).
 */

export type DadosDaLojaNova = { nomeDaLoja: string; slug: string; donoNome: string; donoEmail: string };

const RESERVADOS = new Set(["principal", "master", "admin", "konext", "teste", "api", "www"]);

/** "Assistência do João" -> "assistencia-do-joao" */
export function sugerirSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function validarLojaNova(dados: DadosDaLojaNova): string | null {
  if (dados.nomeDaLoja.trim().length < 3) return "Informe o nome da loja (3 letras ou mais).";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(dados.slug) || dados.slug.length < 3 || dados.slug.length > 40) {
    return "Identificador: de 3 a 40 letras minúsculas, números e hífens (ex.: assistencia-do-joao).";
  }
  if (RESERVADOS.has(dados.slug)) return "Este identificador é reservado. Escolha outro.";
  if (dados.donoNome.trim().length < 3) return "Informe o nome do responsável.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.donoEmail.trim())) return "E-mail do responsável inválido.";
  return null;
}

/** Nome do banco e do papel no Postgres: so letras minusculas, numeros e _. */
export function nomeNoBanco(slug: string): string {
  return `loja_${slug.replace(/-/g, "_")}`.slice(0, 63);
}
