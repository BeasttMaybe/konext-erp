/**
 * Escapa texto para ser colocado dentro de HTML — em conteudo de elemento ou
 * em valor de atributo entre aspas.
 *
 * O React faz isso sozinho em todo JSX, e e por isso que o projeto quase nao
 * precisa desta funcao. Ela existe para o unico lugar em que o HTML e montado
 * como texto: a pagina de resposta do Bling, que e devolvida por um Route
 * Handler, fora do React.
 */
export function escaparHtml(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
