import "server-only";

/**
 * Marca de "quem me chamou foi o servidor".
 *
 * O PROBLEMA QUE RESOLVE
 *
 * Toda funcao async exportada de um arquivo "use server" vira endpoint. Duas
 * delas nao sao actions de verdade — sao auxiliares que outra parte do
 * servidor chama, entregando um cliente do banco JA aberto e JA autorizado:
 *
 *   garantirTermoGarantiaPorOS(tx, …)            chamada pela finalizacao da OS
 *   sincronizarMetasAutomaticasDoTenant(prisma…) chamada pelo cron
 *
 * Nenhuma confere sessao, porque confiam em quem as chama. Tira-las do
 * arquivo exigiria arrastar junto centenas de linhas de auxiliares privados.
 *
 * COMO A MARCA FUNCIONA
 *
 * E um `Symbol` local — nao `Symbol.for`. O protocolo que carrega os
 * argumentos de uma Server Action pelo fio nao consegue transportar um Symbol
 * local: nao existe sequencia de bytes que, desserializada, seja ESTE valor.
 * Entao so codigo que importou este modulo dentro do servidor consegue passar
 * na comparacao por identidade, e `server-only` impede que o modulo va para o
 * navegador.
 *
 * Preferi isso a um segredo em texto: um texto pode vazar e ser repetido; uma
 * identidade de objeto na memoria do servidor nao tem como ser repetida.
 */
export const CHAMADA_INTERNA: unique symbol = Symbol("konext.chamada-interna");

export type MarcaDeChamadaInterna = typeof CHAMADA_INTERNA;

export function exigirChamadaInterna(marca: unknown): asserts marca is MarcaDeChamadaInterna {
  if (marca !== CHAMADA_INTERNA) {
    // Mensagem generica de proposito: quem chega aqui pelo fio nao precisa
    // saber o que faltou.
    throw new Error("Operação não disponível.");
  }
}
