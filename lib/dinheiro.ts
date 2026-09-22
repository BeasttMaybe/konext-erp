/**
 * Único módulo autorizado a fazer ARITMÉTICA COM DINHEIRO neste projeto
 * (Fase 2A-2 — AUDIT_REPORT/relatório da Fase 2A-1 documentaram um
 * fechamento de caixa que calculou R$ 1.409,8899999 em vez de R$ 1.409,89
 * por somar valores em ponto flutuante: `0.1 + 0.2 !== 0.3` em JavaScript,
 * porque nenhum desses dois números tem representação binária exata).
 *
 * Unidade interna: CENTAVOS INTEIROS (`number`, sempre um inteiro — nunca
 * fracionário). Somar/subtrair/multiplicar inteiros em JavaScript é exato
 * até `Number.MAX_SAFE_INTEGER` (~9 * 10^15), MUITO acima de qualquer valor
 * monetário real deste ERP — então, feita a conversão UMA VEZ na borda
 * (`deDecimal`/`lerReais`), toda soma/subtração vira aritmética de inteiro,
 * sem acúmulo de erro.
 *
 * Regra do projeto (ver `eslint-rules/dinheiro-fora-do-modulo.mjs`):
 * fora deste arquivo é proibido `.toNumber()` em `Decimal` do Prisma,
 * `parseFloat` sobre entrada de dinheiro, e `toFixed` para formatar
 * dinheiro — este módulo é a única exceção autorizada às três regras.
 * Valores `Decimal` do Prisma NUNCA saem do servidor: toda query converte
 * pra centavos inteiros (via `deDecimal`) antes de devolver ao componente
 * cliente, em campos nomeados `...Centavos`.
 */

/**
 * Qualquer coisa que `deDecimal` aceita: um `number` (já em reais, ex. vindo
 * de `Number(form.valor)`), uma `string` (ex. `"1409.89"`, formato que
 * `Prisma.Decimal#toString()`/`JSON.stringify` de um `Decimal` produzem —
 * sempre com `.` como separador decimal, nunca `,`), ou qualquer objeto com
 * `toString()` que produza esse mesmo formato (o próprio `Prisma.Decimal`,
 * sem precisar importar `@prisma/client` aqui — este módulo não depende do
 * Prisma de propósito, pra poder ser importado também no cliente).
 */
export type EntradaDecimal = number | string | { toString(): string };

function validarCentavos(centavos: number, origem: string): void {
  if (!Number.isFinite(centavos) || !Number.isInteger(centavos)) {
    throw new Error(
      `[lib/dinheiro] ${origem}: esperava um valor em CENTAVOS INTEIROS, recebeu ${String(centavos)}. ` +
        "Todo valor que atravessa este módulo depois da conversão de borda (deDecimal/lerReais) é sempre um inteiro."
    );
  }
}

/**
 * Arredondamento HALF-UP para o inteiro mais próximo (ex.: 2.5 -> 3,
 * -2.5 -> -2 — "half up" é sempre em direção a +Infinito, nunca "afasta de
 * zero", é a convenção financeira padrão e a mesma usada em
 * `aplicarPercentual`/`multiplicarPorQuantidade` abaixo).
 *
 * Implementado como `Math.floor(valor + 0.5)` em vez de `Math.round`
 * porque `Math.round` já FAZ half-up em JavaScript — a razão de ter esta
 * função nomeada à parte, e não usar `Math.round` direto nos dois call
 * sites, é só documentar em um único lugar por que o arredondamento é
 * half-up (decisão de negócio, não acidente de linguagem) em vez de
 * espalhar esse comentário pelas duas funções que arredondam.
 */
function arredondarHalfUp(valor: number): number {
  return Math.floor(valor + 0.5);
}

/**
 * Converte um número de reais (já com no máximo 2 casas decimais "reais",
 * mesmo que representado com ruído de ponto flutuante, ex. `1409.8899999999999`
 * vindo de uma soma feita errado em código legado) para CENTAVOS INTEIROS,
 * arredondando pro centavo mais próximo.
 *
 * Usa `toFixed(2)` (não multiplicação direta por 100 + `Math.round`) porque
 * `toFixed` arredonda em BASE DECIMAL — evita o artefato binário clássico
 * (ex.: `1.005 * 100` vira `100.49999999999999` em ponto flutuante puro,
 * arredondando pro centavo ERRADO se você fizer `Math.round(1.005 * 100)`).
 * Depois de arredondado como texto decimal, a conversão pra inteiro é exata.
 */
function centavosDeNumero(numero: number): number {
  if (!Number.isFinite(numero)) {
    throw new Error(`[lib/dinheiro] valor numérico inválido: ${String(numero)}`);
  }

  const sinal = numero < 0 ? -1 : 1;
  const comDuasCasas = Math.abs(numero).toFixed(2);
  const [parteInteira, parteDecimal] = comDuasCasas.split(".");

  return sinal * (Number(parteInteira) * 100 + Number(parteDecimal));
}

/**
 * Converte um valor decimal (número, string ou `Prisma.Decimal` — ver
 * `EntradaDecimal`) para CENTAVOS INTEIROS. Esta é a ÚNICA forma sancionada
 * de tirar um `Decimal` do Prisma da borda do servidor: em vez de
 * `campo.toNumber()` (banido fora deste módulo), toda query faz
 * `deDecimal(registro.campo)` e devolve o resultado num campo
 * `...Centavos` pro cliente.
 */
export function deDecimal(valor: EntradaDecimal): number {
  const numero = typeof valor === "number" ? valor : Number(String(valor).trim());

  if (!Number.isFinite(numero)) {
    throw new Error(`[lib/dinheiro] deDecimal: valor não é um decimal válido: ${JSON.stringify(String(valor))}`);
  }

  return centavosDeNumero(numero);
}

/**
 * Converte CENTAVOS INTEIROS de volta para a representação decimal em
 * string (ex. `140989` -> `"1409.89"`) — o formato que `Prisma.Decimal`
 * aceita diretamente (`new Prisma.Decimal(paraDecimal(centavos))`) sem
 * reintroduzir ponto flutuante entre o cálculo em centavos e a gravação.
 * Devolve `string`, nunca `number`, de propósito: um `number` intermediário
 * aqui reabriria a mesma porta de imprecisão que este módulo existe para
 * fechar.
 */
export function paraDecimal(centavos: number): string {
  validarCentavos(centavos, "paraDecimal");

  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  const inteiro = Math.trunc(absoluto / 100);
  const fracao = absoluto % 100;

  return `${sinal}${inteiro}.${String(fracao).padStart(2, "0")}`;
}

/** Soma quaisquer valores em CENTAVOS INTEIROS — aritmética de inteiro, exata. */
export function somar(...valoresCentavos: number[]): number {
  return valoresCentavos.reduce((total, valor, indice) => {
    validarCentavos(valor, `somar (argumento ${indice})`);
    return total + valor;
  }, 0);
}

/** Subtrai `b` de `a`, ambos em CENTAVOS INTEIROS. */
export function subtrair(aCentavos: number, bCentavos: number): number {
  validarCentavos(aCentavos, "subtrair (a)");
  validarCentavos(bCentavos, "subtrair (b)");
  return aCentavos - bCentavos;
}

/**
 * Multiplica um valor em CENTAVOS INTEIROS por uma quantidade (normalmente
 * inteira — un. vendidas —, mas aceita fracionária pra insumo vendido por
 * peso/medida), arredondando HALF-UP pro centavo mais próximo.
 */
export function multiplicarPorQuantidade(centavos: number, quantidade: number): number {
  validarCentavos(centavos, "multiplicarPorQuantidade");

  if (!Number.isFinite(quantidade)) {
    throw new Error(`[lib/dinheiro] multiplicarPorQuantidade: quantidade inválida: ${String(quantidade)}`);
  }

  return arredondarHalfUp(centavos * quantidade);
}

/**
 * Aplica um percentual (ex. `3.14` = 3,14%) sobre um valor em CENTAVOS
 * INTEIROS, arredondando HALF-UP pro centavo mais próximo — convenção
 * financeira padrão (nunca "trunca", nunca "sempre pra cima" tipo `ceil`,
 * que infla toda taxa em favor da loja; nunca "sempre pra baixo" tipo
 * `floor`, que o inverso). HALF-UP é o mesmo critério que um caixa físico
 * usaria arredondando de cabeça: 0,5 centavo sobe.
 */
export function aplicarPercentual(centavos: number, percentual: number): number {
  validarCentavos(centavos, "aplicarPercentual");

  if (!Number.isFinite(percentual)) {
    throw new Error(`[lib/dinheiro] aplicarPercentual: percentual inválido: ${String(percentual)}`);
  }

  return arredondarHalfUp((centavos * percentual) / 100);
}

/**
 * Divide um valor em CENTAVOS INTEIROS em `quantidadeParcelas` parcelas
 * inteiras que somam EXATAMENTE o valor original — o resto da divisão (em
 * centavos) vai para as PRIMEIRAS parcelas, nunca se perde e nunca sobra.
 *
 * Ex.: R$ 100,00 em 3x -> [3334, 3333, 3333] centavos (33,34 + 33,33 +
 * 33,33 = 100,00). O resto vai pra(s) primeira(s) parcela(s) — não pra
 * última — por convenção deste projeto (documentada no relatório da
 * Fase 2A-2): a primeira parcela costuma ser a de entrada/mais visível pro
 * cliente, então é ela que "sobra" um centavo, não a última (arbitrária,
 * mas precisa ser consistente — e testada).
 */
export function dividirEmParcelas(centavos: number, quantidadeParcelas: number): number[] {
  validarCentavos(centavos, "dividirEmParcelas");

  if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas <= 0) {
    throw new Error(
      `[lib/dinheiro] dividirEmParcelas: quantidadeParcelas precisa ser um inteiro positivo, recebeu ${String(quantidadeParcelas)}.`
    );
  }

  const sinal = centavos < 0 ? -1 : 1;
  const absoluto = Math.abs(centavos);

  const base = Math.floor(absoluto / quantidadeParcelas);
  const resto = absoluto - base * quantidadeParcelas;

  return Array.from({ length: quantidadeParcelas }, (_, indice) => {
    const valorParcela = indice < resto ? base + 1 : base;
    return sinal * valorParcela;
  });
}

/**
 * Formata CENTAVOS INTEIROS como "R$ 1.409,89" (pt-BR, com separador de
 * milhar). Única função autorizada a transformar dinheiro em texto pro
 * usuário — nunca `toFixed`/interpolação manual fora deste módulo.
 */
export function formatarReais(centavos: number): string {
  validarCentavos(centavos, "formatarReais");

  const formatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);

  // `Intl.NumberFormat` insere um espaço "non-breaking"/"narrow no-break"
  // (U+00A0/U+202F, dependendo da versão do ICU) entre "R$" e o valor, não
  // um espaço comum (U+0020) — normaliza pra espaço comum, senão o texto
  // parece idêntico visualmente mas falha comparação exata (`===`) e não
  // corta linha normalmente em contextos que não são HTML.
  return formatado.replace(/[  ]/g, " ");
}

/**
 * Interpreta texto de entrada do usuário em formato pt-BR ("R$ 1.409,89",
 * "1.409,89", "1409,89", "1409") como CENTAVOS INTEIROS. `.` é separador de
 * milhar (removido), `,` é separador decimal (vira `.` antes do parse) —
 * convenção pt-BR, nunca a convenção en-US. Lança se o texto não for um
 * valor monetário válido.
 */
export function lerReais(texto: string): number {
  const semPrefixo = texto.trim().replace(/^R\$\s*/i, "");
  const semEspacos = semPrefixo.replace(/\s+/g, "");

  if (!semEspacos) {
    throw new Error("[lib/dinheiro] lerReais: texto vazio não é um valor monetário válido.");
  }

  const semSeparadorDeMilhar = semEspacos.replace(/\./g, "");
  const comPontoDecimal = semSeparadorDeMilhar.replace(",", ".");
  const numero = Number(comPontoDecimal);

  if (!Number.isFinite(numero)) {
    throw new Error(`[lib/dinheiro] lerReais: "${texto}" não é um valor monetário pt-BR válido.`);
  }

  return centavosDeNumero(numero);
}

/**
 * Alias de `deDecimal` restrito a `number` — mantido pelo mesmo nome que
 * `lib/pdv/pagamentos.ts` já usava antes desta fase (Fase 2A-2 absorveu os
 * dois helpers de centavo daquele módulo pra cá, pra existir só UMA fórmula
 * de arredondamento de centavo no projeto). `lib/pdv/pagamentos.ts` agora
 * só reexporta estes dois nomes.
 */
export function paraCentavos(valor: number): number {
  return centavosDeNumero(valor);
}

/** Alias de `paraDecimal`, mas devolvendo `number` — ver `paraCentavos` acima. Mesma ressalva: só usar quando o `number` resultante NÃO for de volta pra um campo `Decimal` do Prisma (nesse caso, use `paraDecimal`, que devolve `string`). */
export function paraMoeda(centavos: number): number {
  validarCentavos(centavos, "paraMoeda");
  return centavos / 100;
}
