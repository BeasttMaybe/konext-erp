/**
 * Lógica pura (sem React, sem DOM) do componente compartilhado
 * `components/ui/filtro-periodo.tsx`: cálculo dos presets ("Hoje", "Esta
 * semana", "Mês passado"...), validação de intervalo e serialização
 * pra/da URL. Fica fora de `components/ui` de propósito, em dois motivos:
 *
 *   1. `vitest.config.ts` só roda `lib/**\/*.test.ts` (ambiente "node", sem
 *      DOM) — manter a lógica aqui é o que permite testar cada preset e o
 *      round-trip de URL sem subir um ambiente de componente.
 *   2. A regra de lint `konext-datas/*` (`eslint-rules/datas-fronteira-fora-do-modulo.mjs`)
 *      bane `setHours(0, ...)`/`startOfDay` etc. crus fora de `lib/datas.ts`
 *      em QUALQUER arquivo de `app/**`, `components/**` e `lib/**` — inclusive
 *      este. Este módulo nunca calcula fronteira de dia/semana/mês na unha:
 *      toda fronteira vem de `lib/datas.ts` (`inicioDaSemana`, `inicioDoMes`,
 *      `hojeComoDataDeCalendario`...). O único módulo autorizado a usar as
 *      primitivas cruas continua sendo `lib/datas.ts`.
 *
 * Convenção de data usada em todo este módulo: DATA DE CALENDÁRIO (meia-noite
 * UTC representando o dia, nunca um instante) — a mesma convenção que
 * `dataVencimento`/`dataPrazo`/`validade` já usam no projeto (ver o
 * cabeçalho de `lib/datas.ts`, seção `comoDataDeCalendario`). Quem consome
 * `IntervaloPeriodo` decide como comparar contra a COLUNA que está
 * filtrando: direto (coluna já é DATA DE CALENDÁRIO, ex. `dataVencimento`)
 * ou via `inicioDoDia`/`fimDoDia` (coluna é um INSTANTE, ex. `criadoEm`,
 * `dataPagamento`) — este módulo não sabe qual é o caso de quem o usa.
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import {
  agoraNaLoja,
  comoDataDeCalendario,
  dataDeCalendario,
  diferencaEntreDatasDeCalendario,
  FUSO_HORARIO_PADRAO,
  fimDaSemana,
  fimDoMes,
  hojeComoDataDeCalendario,
  inicioDaSemana,
  inicioDoMes,
  somarDias,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";

/** Um intervalo fechado de datas de calendário (`inicio`/`fim` inclusive). */
export interface IntervaloPeriodo {
  inicio: Date;
  fim: Date;
}

/** Uma opção de campo de data que o consumidor do componente oferece (ex.: "Vencimento", "Pagamento"). Nunca hardcoded dentro do componente. */
export interface OpcaoCampoPeriodo {
  valor: string;
  rotulo: string;
}

/** Um mês de calendário (`mesIndiceZero`: 0 = janeiro, igual à convenção de `Date`). */
export interface MesDeCalendario {
  ano: number;
  mesIndiceZero: number;
}

/** Chave de cada preset computado (não inclui "mes-especifico"/"personalizado" — esses não têm uma única fórmula, ver `identificarPresetAtivo`/`identificarMesEspecifico`). */
export type ChavePresetPeriodo =
  | "hoje"
  | "esta-semana"
  | "semana-passada"
  | "este-mes"
  | "mes-passado";

export interface DefinicaoPresetPeriodo {
  chave: ChavePresetPeriodo;
  rotulo: string;
  calcular: (fusoHorario?: string) => IntervaloPeriodo;
}

function comoIntervaloDeCalendario(
  inicio: Date,
  fim: Date,
  fusoHorario: string
): IntervaloPeriodo {
  return {
    inicio: comoDataDeCalendario(inicio, fusoHorario),
    fim: comoDataDeCalendario(fim, fusoHorario),
  };
}

/** "Hoje" — início e fim do intervalo são o mesmo dia. */
export function calcularPresetHoje(fusoHorario: string = FUSO_HORARIO_PADRAO): IntervaloPeriodo {
  const hoje = hojeComoDataDeCalendario(fusoHorario);
  return { inicio: hoje, fim: hoje };
}

/** Semana corrente (domingo a sábado — semanas começam no domingo neste projeto, nunca segunda). */
export function calcularPresetEstaSemana(
  fusoHorario: string = FUSO_HORARIO_PADRAO
): IntervaloPeriodo {
  const agora = agoraNaLoja(fusoHorario);
  return comoIntervaloDeCalendario(
    inicioDaSemana(agora, fusoHorario),
    fimDaSemana(agora, fusoHorario),
    fusoHorario
  );
}

/** Semana anterior à corrente (domingo a sábado). */
export function calcularPresetSemanaPassada(
  fusoHorario: string = FUSO_HORARIO_PADRAO
): IntervaloPeriodo {
  const agora = agoraNaLoja(fusoHorario);
  const referencia = somarDias(agora, -7, fusoHorario);
  return comoIntervaloDeCalendario(
    inicioDaSemana(referencia, fusoHorario),
    fimDaSemana(referencia, fusoHorario),
    fusoHorario
  );
}

/** Mês corrente (dia 1 até o último dia do mês). */
export function calcularPresetEsteMes(
  fusoHorario: string = FUSO_HORARIO_PADRAO
): IntervaloPeriodo {
  const agora = agoraNaLoja(fusoHorario);
  return comoIntervaloDeCalendario(
    inicioDoMes(agora, fusoHorario),
    fimDoMes(agora, fusoHorario),
    fusoHorario
  );
}

/** Mês anterior ao corrente (dia 1 até o último dia). */
export function calcularPresetMesPassado(
  fusoHorario: string = FUSO_HORARIO_PADRAO
): IntervaloPeriodo {
  const agora = agoraNaLoja(fusoHorario);
  const inicioMesAtual = inicioDoMes(agora, fusoHorario);
  const referencia = somarDias(inicioMesAtual, -1, fusoHorario);
  return comoIntervaloDeCalendario(
    inicioDoMes(referencia, fusoHorario),
    fimDoMes(referencia, fusoHorario),
    fusoHorario
  );
}

/** Todos os presets computados, na ordem em que aparecem na UI. */
export const PRESETS_PERIODO: DefinicaoPresetPeriodo[] = [
  { chave: "hoje", rotulo: "Hoje", calcular: calcularPresetHoje },
  { chave: "esta-semana", rotulo: "Esta semana", calcular: calcularPresetEstaSemana },
  { chave: "semana-passada", rotulo: "Semana passada", calcular: calcularPresetSemanaPassada },
  { chave: "este-mes", rotulo: "Este mês", calcular: calcularPresetEsteMes },
  { chave: "mes-passado", rotulo: "Mês passado", calcular: calcularPresetMesPassado },
];

/**
 * Mês/ano de referência do preset "Selecionar mês" quando a grade ainda não
 * tem nada escolhido — o mês corrente, no fuso da loja.
 */
export function mesDeCalendarioAtual(fusoHorario: string = FUSO_HORARIO_PADRAO): MesDeCalendario {
  const hoje = hojeComoDataDeCalendario(fusoHorario);
  return { ano: hoje.getUTCFullYear(), mesIndiceZero: hoje.getUTCMonth() };
}

function paraTextoAnoMes(mes: MesDeCalendario): string {
  const mesTexto = String(mes.mesIndiceZero + 1).padStart(2, "0");
  return `${mes.ano}-${mesTexto}-01`;
}

/** Mês seguinte a `mes` (dezembro + 1 mês vira janeiro do ano seguinte). */
export function mesDeCalendarioSeguinte(mes: MesDeCalendario): MesDeCalendario {
  const mesSeguinteIndiceZero = mes.mesIndiceZero + 1;
  if (mesSeguinteIndiceZero > 11) {
    return { ano: mes.ano + 1, mesIndiceZero: 0 };
  }
  return { ano: mes.ano, mesIndiceZero: mesSeguinteIndiceZero };
}

/** Mês anterior a `mes` (janeiro − 1 mês vira dezembro do ano anterior). */
export function mesDeCalendarioAnterior(mes: MesDeCalendario): MesDeCalendario {
  const mesAnteriorIndiceZero = mes.mesIndiceZero - 1;
  if (mesAnteriorIndiceZero < 0) {
    return { ano: mes.ano - 1, mesIndiceZero: 11 };
  }
  return { ano: mes.ano, mesIndiceZero: mesAnteriorIndiceZero };
}

/**
 * Intervalo (dia 1 até o último dia) de um mês/ano ESCOLHIDO explicitamente
 * pelo usuário (preset "Selecionar mês") — não depende de "agora", então não
 * tem a ambiguidade de fuso que os presets relativos acima têm. Construído
 * só com `dataDeCalendario`/`somarDiasEmDataDeCalendario` (as duas funções
 * de `lib/datas.ts` que fazem aritmética de calendário pura, sem TZDate) —
 * nunca `new Date(ano, mes, dia)` cru, que constrói no fuso do PROCESSO.
 */
export function calcularIntervaloMesEspecifico(mes: MesDeCalendario): IntervaloPeriodo {
  const inicio = dataDeCalendario(paraTextoAnoMes(mes));
  const primeiroDiaMesSeguinte = dataDeCalendario(paraTextoAnoMes(mesDeCalendarioSeguinte(mes)));

  if (!inicio || !primeiroDiaMesSeguinte) {
    throw new Error(`Mês/ano inválido: ${mes.ano}-${mes.mesIndiceZero + 1}`);
  }

  return { inicio, fim: somarDiasEmDataDeCalendario(primeiroDiaMesSeguinte, -1) };
}

function mesmoIntervalo(a: IntervaloPeriodo, b: IntervaloPeriodo): boolean {
  return (
    diferencaEntreDatasDeCalendario(a.inicio, b.inicio) === 0 &&
    diferencaEntreDatasDeCalendario(a.fim, b.fim) === 0
  );
}

/** Qual preset computado (se algum) corresponde a `intervalo` — usado pra destacar o preset ativo na UI. `null` quando não bate com nenhum (intervalo customizado ou um mês específico — ver `identificarMesEspecifico`). */
export function identificarPresetAtivo(
  intervalo: IntervaloPeriodo,
  fusoHorario: string = FUSO_HORARIO_PADRAO
): ChavePresetPeriodo | null {
  const encontrado = PRESETS_PERIODO.find((preset) =>
    mesmoIntervalo(preset.calcular(fusoHorario), intervalo)
  );
  return encontrado?.chave ?? null;
}

/** Se `intervalo` é exatamente um mês inteiro (dia 1 ao último dia), devolve esse mês/ano — usado pra destacar o preset "Selecionar mês" quando o intervalo veio de lá (ex.: depois de recarregar a página, lendo da URL). */
export function identificarMesEspecifico(intervalo: IntervaloPeriodo): MesDeCalendario | null {
  const candidato: MesDeCalendario = {
    ano: intervalo.inicio.getUTCFullYear(),
    mesIndiceZero: intervalo.inicio.getUTCMonth(),
  };

  try {
    if (mesmoIntervalo(calcularIntervaloMesEspecifico(candidato), intervalo)) {
      return candidato;
    }
  } catch {
    // Mês/ano fora do que `dataDeCalendario` aceita — não é um mês específico válido.
  }

  return null;
}

export interface ResultadoValidacaoIntervalo {
  valido: boolean;
  mensagemErro?: string;
}

/** Fim não pode ser antes do início — mensagem já em pt-BR, pronta pra exibir. */
export function validarIntervalo(inicio: Date, fim: Date): ResultadoValidacaoIntervalo {
  if (diferencaEntreDatasDeCalendario(inicio, fim) < 0) {
    return { valido: false, mensagemErro: "O fim do período não pode ser antes do início." };
  }
  return { valido: true };
}

// ── Digitação (campos "Início do período"/"Fim do período") ────────────────

const PADRAO_DATA_DIGITADA_COMPLETA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Máscara incremental dd/mm/aaaa: recebe o texto que o campo teria (usuário
 * já digitou ou apagou algo) e devolve o texto mascarado — nunca deixa o
 * usuário digitar algo que não seja dígito, e insere as barras sozinho.
 */
export function aplicarMascaraDataDigitada(valorDigitado: string): string {
  const apenasDigitos = valorDigitado.replace(/\D/g, "").slice(0, 8);
  const dia = apenasDigitos.slice(0, 2);
  const mes = apenasDigitos.slice(2, 4);
  const ano = apenasDigitos.slice(4, 8);
  return [dia, mes, ano].filter((parte) => parte.length > 0).join("/");
}

/**
 * Interpreta um texto dd/mm/aaaa JÁ COMPLETO como data de calendário.
 * Devolve `null` pra texto incompleto ou pra uma data de calendário
 * inexistente (31/02, por exemplo) — quem chama mantém o último valor
 * válido nesse caso, nunca aplica um `null`/`NaN` ao estado.
 */
export function interpretarDataDigitada(texto: string): Date | null {
  const compativel = PADRAO_DATA_DIGITADA_COMPLETA.exec(texto.trim());
  if (!compativel) return null;

  const [, dia, mes, ano] = compativel;
  return dataDeCalendario(`${ano}-${mes}-${dia}`);
}

// ── Exibição ─────────────────────────────────────────────────────────────

/**
 * Datas de calendário deste módulo são meia-noite UTC (mesma convenção de
 * `lib/datas.ts`). Formatá-las com `format` do date-fns puro leria os
 * getters LOCAIS do processo/navegador (`getDate`/`getMonth` no fuso do
 * DISPOSITIVO) — deslocando o dia sempre que esse fuso não é UTC. É o mesmo
 * bug de fronteira que `lib/datas.ts` existe pra evitar no servidor, agora
 * do lado do cliente. Ancorar em `TZDate(data, "UTC")` antes de formatar faz
 * `format` ler os componentes UTC certos, não os do navegador de quem está
 * olhando a tela.
 */
export function formatarDataExibicao(data: Date): string {
  return format(new TZDate(data, "UTC"), "dd/MM/yyyy");
}

/** "Vencimento: 22/08/2026 até 21/09/2026" (ou sem o prefixo, quando `rotuloCampo` não é passado). */
export function formatarRotuloIntervalo(intervalo: IntervaloPeriodo, rotuloCampo?: string): string {
  const texto = `${formatarDataExibicao(intervalo.inicio)} até ${formatarDataExibicao(intervalo.fim)}`;
  return rotuloCampo ? `${rotuloCampo}: ${texto}` : texto;
}

// ── URL ──────────────────────────────────────────────────────────────────

/** Nomes dos search params que o componente lê/escreve — customizável só pra evitar colisão quando uma mesma tela (hipoteticamente) precisar de duas instâncias. */
export interface NomesParamsPeriodo {
  campo: string;
  inicio: string;
  fim: string;
}

export const NOMES_PARAMS_PERIODO_PADRAO: NomesParamsPeriodo = {
  campo: "campo",
  inicio: "inicio",
  fim: "fim",
};

function formatarDataParaUrl(data: Date): string {
  const ano = String(data.getUTCFullYear()).padStart(4, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Monta os search params a partir de um intervalo + campo escolhido, em cima
 * dos params já existentes na URL (preserva qualquer outro filtro que a tela
 * já tenha — busca por texto, página, etc.). Só é chamada ao clicar
 * "Filtrar": nada nesta tela some o estado do popover até a confirmação.
 */
export function paraSearchParams(
  intervalo: IntervaloPeriodo,
  campoSelecionado: string | undefined,
  paramsAtuais: URLSearchParams,
  nomesParams: NomesParamsPeriodo = NOMES_PARAMS_PERIODO_PADRAO
): URLSearchParams {
  const params = new URLSearchParams(paramsAtuais.toString());
  params.set(nomesParams.inicio, formatarDataParaUrl(intervalo.inicio));
  params.set(nomesParams.fim, formatarDataParaUrl(intervalo.fim));

  if (campoSelecionado) {
    params.set(nomesParams.campo, campoSelecionado);
  } else {
    params.delete(nomesParams.campo);
  }

  return params;
}

export interface PeriodoLidoDaUrl {
  campo: string | undefined;
  /** `null` quando os params estão ausentes, incompletos ou descrevem um intervalo inválido (fim antes do início, data inexistente...) — quem chama cai pro próprio período padrão nesse caso. */
  intervalo: IntervaloPeriodo | null;
}

/** Lê de volta o que `paraSearchParams` escreveu — recarregar a página ou compartilhar o link chega aqui com o mesmo intervalo. */
export function deSearchParams(
  params: URLSearchParams,
  nomesParams: NomesParamsPeriodo = NOMES_PARAMS_PERIODO_PADRAO
): PeriodoLidoDaUrl {
  const campo = params.get(nomesParams.campo) ?? undefined;
  const inicioTexto = params.get(nomesParams.inicio);
  const fimTexto = params.get(nomesParams.fim);

  if (!inicioTexto || !fimTexto) {
    return { campo, intervalo: null };
  }

  const inicio = dataDeCalendario(inicioTexto);
  const fim = dataDeCalendario(fimTexto);

  if (!inicio || !fim || !validarIntervalo(inicio, fim).valido) {
    return { campo, intervalo: null };
  }

  return { campo, intervalo: { inicio, fim } };
}
