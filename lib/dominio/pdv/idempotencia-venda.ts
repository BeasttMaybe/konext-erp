/**
 * Idempotência de venda no PDV (Fase 2A-2 cont. — item 2b) — domínio puro,
 * sem Prisma.
 *
 * Contexto: numa sessão de teste manual, uma venda foi gravada DUAS VEZES
 * porque o navegador do testador perdeu a resposta de "Confirmar venda"
 * (fechou antes de ver o resultado) e uma nova tentativa criou uma segunda
 * venda idêntica — o servidor processou as duas com sucesso, cada uma
 * legitimamente, porque não existia nenhuma trava de "isso já foi enviado
 * antes". O botão desabilitado (`processando`) protege só contra
 * duplo-clique NO MESMO carregamento de página; não ajuda quando a página é
 * recarregada com o pedido em voo — só uma chave de idempotência do lado do
 * cliente, verificada no servidor, resolve isso de verdade.
 *
 * Desenho: o cliente gera UMA chave por TENTATIVA de venda (quando a tela
 * de pagamento abre) e reenvia a MESMA chave em qualquer reenvio da mesma
 * tentativa. O servidor:
 *   1. Antes de criar a venda, busca por uma venda já existente com essa
 *      chave — se achar, devolve ELA, sem criar outra (`buscarPorChave`).
 *   2. Se não achar, tenta criar. Mas o passo 1 e o passo 2 não são atômicos
 *      entre si (duas chamadas concorrentes podem passar pelo passo 1 ao
 *      mesmo tempo, antes de qualquer uma commitar) — quem garante "no
 *      máximo uma venda por chave" de verdade é a constraint UNIQUE no
 *      banco (`Venda.chaveIdempotencia`). Quando a chamada perdedora dessa
 *      corrida tenta criar e recebe a violação de UNIQUE, este módulo
 *      reconhece o erro (`ehViolacaoDeChaveUnica`) e busca de novo pela
 *      chave — a vencedora da corrida já commitou a essa altura, então essa
 *      segunda busca sempre encontra e devolve a mesma venda.
 *
 * Este módulo não sabe nada de Prisma/transação/tenant: recebe as duas
 * operações de banco que precisa (`buscarPorChave`, `criar`) já resolvidas
 * por quem chama (app/actions/pdv.ts) — o que permite testar a lógica de
 * decisão/corrida inteira com dublês em memória, sem subir um Postgres.
 */

export interface RepositorioIdempotenciaVenda<Venda> {
  /**
   * Busca uma venda já criada com esta chave. `null` se não existir — ou se
   * o chamador decidir tratar "coluna ainda não migrada neste tenant" como
   * "não existe" (ver app/actions/pdv.ts, que faz isso defensivamente).
   */
  buscarPorChave: (chaveIdempotencia: string) => Promise<Venda | null>;
  /**
   * Cria a venda de verdade. Pode rejeitar com uma violação de UNIQUE
   * (reconhecível por `ehViolacaoDeChaveUnica`) se outra chamada concorrente
   * com a mesma chave venceu a corrida entre a busca e a criação.
   */
  criar: () => Promise<Venda>;
}

/**
 * Reconhece a violação de UNIQUE constraint do Postgres via Prisma (código
 * `P2002`) especificamente na coluna `chaveIdempotencia` — outras violações
 * de UNIQUE (ex.: outro campo qualquer) não são engolidas por este módulo,
 * só repassadas.
 */
export function ehViolacaoDeChaveUnica(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;

  const comCodigo = erro as { code?: string; meta?: { target?: unknown } };
  if (comCodigo.code !== "P2002") return false;

  const alvo = comCodigo.meta?.target;
  const alvoTexto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  return alvoTexto.includes("chaveIdempotencia");
}

/**
 * Decide e executa: reutiliza uma venda existente pra essa chave, ou cria
 * uma nova — nunca cria duas vendas pra mesma chave, mesmo sob chamadas
 * concorrentes (a corrida real é resolvida pela constraint UNIQUE do banco;
 * este módulo só reage a ela).
 *
 * `chaveIdempotencia` ausente/vazia (chamador antigo, ou reenvio sem passar
 * a chave) sempre cria — sem essa chave não há como saber se é reenvio,
 * então o comportamento é o de hoje (sempre cria).
 */
export async function processarVendaComIdempotencia<Venda>(
  chaveIdempotencia: string | undefined | null,
  repositorio: RepositorioIdempotenciaVenda<Venda>
): Promise<Venda> {
  const chave = chaveIdempotencia?.trim() || undefined;

  if (chave) {
    const existente = await repositorio.buscarPorChave(chave);
    if (existente) {
      return existente;
    }
  }

  try {
    return await repositorio.criar();
  } catch (erro) {
    if (chave && ehViolacaoDeChaveUnica(erro)) {
      const existente = await repositorio.buscarPorChave(chave);
      if (existente) {
        return existente;
      }
    }

    throw erro;
  }
}
