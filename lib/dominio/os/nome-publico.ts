/**
 * O nome do cliente como ele pode aparecer numa página PÚBLICA.
 *
 * A tela de rastreio é aberta por link, sem login, e pode ser encaminhada —
 * então ela mostra só o primeiro nome. Não é enfeite: "João Silva" num
 * endereço que circula em grupo de WhatsApp é mais informação sobre uma
 * pessoa do que o rastreio precisa dar para cumprir a função dele, que é
 * dizer em que pé está o conserto.
 */

/**
 * O primeiro nome, ou "Cliente" quando não há nome utilizável.
 *
 * Existe como função própria porque a versão anterior, escrita direto na
 * consulta, era `.split("")[0]` — que separa a string em LETRAS. "João
 * Silva" virava "J", e a página pública cumprimentava todo mundo com uma
 * inicial. Passou despercebido porque nada quebrava: a tela carregava, o
 * nome só não era um nome.
 */
export function primeiroNomePublico(nomeCompleto: string | null | undefined): string {
  const limpo = (nomeCompleto ?? "").trim();
  if (limpo === "") return "Cliente";

  // Divide por qualquer espaço em branco, não por um espaço literal: nome
  // colado de outro sistema costuma vir com espaço duplo ou tabulação, e
  // `split(" ")` devolveria string vazia no primeiro pedaço.
  const primeiro = limpo.split(/\s+/)[0];

  return primeiro.length > 0 ? primeiro : "Cliente";
}
