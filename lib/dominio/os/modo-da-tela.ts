/**
 * Qual aba da tela de OS o endereco pede: `/os`, `/os?modo=lista`,
 * `/os?modo=garantia`.
 *
 * O ENDERECO E A FONTE DA VERDADE
 *
 * A tela lia `?modo=` uma unica vez, no primeiro carregamento, e dai em
 * diante guardava a aba num estado proprio. Os itens "Kanban",
 * "Finalizadas" e "Garantias" do menu lateral mudam so o `?modo=` — o
 * endereco trocava, a tela ja estava montada e continuava na aba de antes.
 * Para quem clicava, o menu simplesmente nao fazia nada.
 *
 * Agora a pagina (servidor) e a tela (navegador) traduzem o endereco pela
 * mesma funcao, e a tela volta a se alinhar a ele a cada navegacao.
 */
export type ModoDaTelaOS = "KANBAN" | "LISTA_FINALIZADAS" | "GARANTIA";

export function modoDaTelaPeloParametro(parametro: string | null | undefined): ModoDaTelaOS {
  const valor = String(parametro ?? "").toLowerCase();

  // "excluidas" e o link antigo de uma aba propria: hoje e um filtro dentro
  // de Finalizadas (Fase 1C-3, Parte 5).
  if (valor === "lista" || valor === "excluidas") return "LISTA_FINALIZADAS";
  if (valor === "garantia") return "GARANTIA";
  return "KANBAN";
}

export function parametroDoModo(modo: ModoDaTelaOS): "kanban" | "lista" | "garantia" {
  if (modo === "LISTA_FINALIZADAS") return "lista";
  if (modo === "GARANTIA") return "garantia";
  return "kanban";
}
