/**
 * Único módulo autorizado a calcular fronteira de dia/semana/mês e "agora"
 * para lógica de negócio (Fase 2A-1, AUDIT_REPORT — bug do relógio do
 * servidor). O deploy roda em UTC (Vercel); a loja fica em
 * `America/Sao_Paulo` (UTC−3, salvo eventual retomada de horário de verão).
 * Qualquer "hoje"/"este mês"/"vence hoje" calculado com `new Date()` cru e os
 * getters locais (`getHours`/`setHours`/`getMonth`...) usa o relógio E O
 * FUSO do PROCESSO — entre 21h e 23:59 no horário da loja, o processo já
 * está no dia seguinte em UTC, e a fronteira sai errada.
 *
 * A matemática de calendário aqui usa `@date-fns/tz` (`TZDate`, o companion
 * oficial de fuso horário do date-fns@4 — não `date-fns-tz`, que é a API
 * pré-v4). `TZDate` é uma subclasse de `Date` que resolve o offset real via
 * `Intl` a cada data, então NUNCA assume UTC-3 fixo: se o Brasil um dia
 * voltar a ter horário de verão, o cálculo já está certo.
 *
 * Regra do projeto (ver `eslint-rules/datas-fronteira-fora-do-modulo.mjs`):
 * fora deste arquivo é proibido `setHours(0`, os `startOfDay`/`startOfWeek`/
 * `startOfMonth`/`endOfDay`/`endOfMonth` puros do `date-fns`, e `CURRENT_DATE`
 * em SQL raw — este módulo é a única exceção autorizada às três regras.
 */
import { TZDate } from "@date-fns/tz";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** Fuso horário padrão de uma loja nova — mesmo valor de `Configuracao.fusoHorario` (`prisma/schema.prisma`). */
export const FUSO_HORARIO_PADRAO = "America/Sao_Paulo";

/** Semana começa no DOMINGO neste projeto — nunca segunda (padrão ISO). */
const CONFIGURACAO_SEMANA = { weekStartsOn: 0 as const };

export type EntradaData = Date | string | number;

function paraDataNaLoja(data: EntradaData, fusoHorario: string): TZDate {
  // Normaliza pra `Date` antes de repassar ao construtor de `TZDate`: os
  // overloads de `TZDate` são específicos por tipo (Date | string | number),
  // e `EntradaData` sendo a união dos três não casa com nenhum overload
  // isolado — `Date` sempre casa.
  const comoData = data instanceof Date ? data : new Date(data);
  return new TZDate(comoData, fusoHorario);
}

/**
 * "Agora", no fuso horário da loja — a única forma correta de obter o
 * instante atual para decidir uma fronteira de dia/semana/mês. Nunca
 * `new Date()` cru nesse contexto: aquilo é o instante certo, mas os
 * getters/setters locais que normalmente se aplicam sobre ele (`getMonth`,
 * `setHours(0`...) leriam o fuso do processo, não o da loja.
 */
export function agoraNaLoja(fusoHorario: string = FUSO_HORARIO_PADRAO): TZDate {
  return TZDate.tz(fusoHorario);
}

/** Início do dia (00:00:00.000) de `data`, no fuso da loja. */
export function inicioDoDia(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return startOfDay(paraDataNaLoja(data, fusoHorario));
}

/** Fim do dia (23:59:59.999) de `data`, no fuso da loja. */
export function fimDoDia(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return endOfDay(paraDataNaLoja(data, fusoHorario));
}

/** Início da semana (domingo, 00:00:00.000) que contém `data`, no fuso da loja. */
export function inicioDaSemana(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return startOfWeek(paraDataNaLoja(data, fusoHorario), CONFIGURACAO_SEMANA);
}

/** Fim da semana (sábado, 23:59:59.999) que contém `data`, no fuso da loja. */
export function fimDaSemana(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return endOfWeek(paraDataNaLoja(data, fusoHorario), CONFIGURACAO_SEMANA);
}

/** Início do mês (dia 1, 00:00:00.000) que contém `data`, no fuso da loja. */
export function inicioDoMes(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return startOfMonth(paraDataNaLoja(data, fusoHorario));
}

/** Fim do mês (último dia, 23:59:59.999) que contém `data`, no fuso da loja. */
export function fimDoMes(data: EntradaData = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return endOfMonth(paraDataNaLoja(data, fusoHorario));
}

/** `a` e `b` caem no mesmo dia de calendário, no fuso da loja. */
export function mesmoDia(a: EntradaData, b: EntradaData, fusoHorario: string = FUSO_HORARIO_PADRAO): boolean {
  return isSameDay(paraDataNaLoja(a, fusoHorario), paraDataNaLoja(b, fusoHorario));
}

/**
 * Soma (ou subtrai, com `dias` negativo) dias corridos a `data`, no fuso da
 * loja — atravessa uma eventual virada de horário de verão corretamente
 * (`addDays` do date-fns, aplicado sobre uma `TZDate`, preserva o horário
 * local, não o offset).
 */
export function somarDias(data: EntradaData, dias: number, fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return addDays(paraDataNaLoja(data, fusoHorario), dias);
}

/**
 * Diferença em dias de calendário (`alvo` − `base`, pode ser negativa) no
 * fuso da loja. Sempre normaliza os dois lados pro início do dia antes de
 * subtrair — nunca divide a diferença de instantes crua por 86 400 000 ms,
 * o que quebraria num dia de 23h/25h (horário de verão).
 */
export function diferencaEmDiasDeCalendario(
  base: EntradaData,
  alvo: EntradaData,
  fusoHorario: string = FUSO_HORARIO_PADRAO
): number {
  const UM_DIA_MS = 24 * 60 * 60 * 1000;
  const inicioBase = inicioDoDia(base, fusoHorario).getTime();
  const inicioAlvo = inicioDoDia(alvo, fusoHorario).getTime();
  return Math.round((inicioAlvo - inicioBase) / UM_DIA_MS);
}

/**
 * Converte um instante (tipicamente "agora") no dia de calendário
 * correspondente NO FUSO DA LOJA, representado como meia-noite UTC — a
 * mesma convenção de `dataDeCalendario` acima e a mesma que o resto do
 * projeto já usa pra data de calendário vinda de string (`new Date("yyyy-MM-dd")`
 * é meia-noite UTC por especificação do `Date`).
 *
 * Use isto — nunca `inicioDoDia`/`agoraNaLoja` puros — pra comparar "hoje"
 * contra uma coluna DATA DE CALENDÁRIO (`dataVencimento`, `dataPrazo`,
 * `validade`...): essas colunas guardam o dia como meia-noite UTC, não
 * meia-noite do fuso da loja. `inicioDoDia(new Date(), "America/Sao_Paulo")`
 * devolve meia-noite LOCAL como instante (03:00 UTC) — comparado direto
 * contra uma `dataVencimento` de hoje (00:00 UTC), isso marcaria uma conta
 * que vence HOJE como já atrasada às 00:01 da manhã. `comoDataDeCalendario`
 * evita esse descompasso: primeiro resolve o dia certo no fuso da loja,
 * depois representa ESSE dia na mesma meia-noite UTC que a coluna usa.
 */
export function comoDataDeCalendario(
  data: EntradaData = new Date(),
  fusoHorario: string = FUSO_HORARIO_PADRAO
): Date {
  const dataNaLoja = paraDataNaLoja(data, fusoHorario);
  return new Date(Date.UTC(dataNaLoja.getFullYear(), dataNaLoja.getMonth(), dataNaLoja.getDate()));
}

/** Atalho de `comoDataDeCalendario(new Date(), fusoHorario)` — "hoje", pronto pra comparar contra uma coluna DATA DE CALENDÁRIO. */
export function hojeComoDataDeCalendario(fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return comoDataDeCalendario(new Date(), fusoHorario);
}

/**
 * Soma (ou subtrai) dias corridos a uma DATA DE CALENDÁRIO (meia-noite UTC —
 * `comoDataDeCalendario`/`dataDeCalendario`). Aritmética pura em UTC, nunca
 * via `TZDate`/`somarDias`: um dia UTC tem sempre exatamente 86 400 000 ms
 * (UTC não tem horário de verão), então não há ambiguidade a resolver — e
 * envolver a data num fuso não-UTC aqui na verdade INTRODUZIRIA um
 * deslocamento de dia (o mesmo problema que `comoDataDeCalendario` existe
 * pra evitar).
 */
export function somarDiasEmDataDeCalendario(data: Date, dias: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias));
}

/**
 * Diferença em dias (`alvo` − `base`) entre duas DATAS DE CALENDÁRIO (meia-noite
 * UTC). Mesma ressalva de `somarDiasEmDataDeCalendario`: matemática pura em
 * UTC, nunca via `TZDate`.
 */
export function diferencaEntreDatasDeCalendario(base: Date, alvo: Date): number {
  const UM_DIA_MS = 24 * 60 * 60 * 1000;
  const baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const alvoUtc = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate());
  return Math.round((alvoUtc - baseUtc) / UM_DIA_MS);
}

/**
 * Interpreta uma data de calendário no formato "yyyy-MM-dd" (o formato de
 * `<input type="date">` e de `dataInicio`/`dataPrazo` serializados) como
 * meia-noite UTC daquele dia — nunca meia-noite do fuso do PROCESSO
 * (`new Date(`${texto}T00:00:00`)`), que desloca a data pra véspera sempre
 * que o processo roda num fuso adiantado em relação a UTC (ou seja, sempre,
 * num servidor UTC lendo uma loja UTC−3... o inverso do bug de "21h": aqui o
 * processo é UTC e o texto não tem fuso, então a meia-noite "local" do
 * processo colada num servidor UTC É a meia-noite UTC — o problema real é a
 * INCONSISTÊNCIA entre call sites que usam esse truque e os que já ancoram
 * em UTC; ancorar sempre em UTC aqui elimina a divergência).
 *
 * Uma data de calendário (vencimento, validade, prazo) nunca tem hora
 * significativa — representá-la sempre como meia-noite UTC garante que ela
 * nunca "desloca um dia" ao ser lida de volta, seja qual for o fuso de quem
 * lê. Devolve `null` para texto que não é uma data de calendário válida.
 */
export function dataDeCalendario(anoMesDiaIso: string): Date | null {
  const compativel = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anoMesDiaIso.trim());
  if (!compativel) return null;

  const [, anoTexto, mesTexto, diaTexto] = compativel;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const dataRealCorresponde =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;

  return dataRealCorresponde ? data : null;
}

/**
 * O mesmo que `dataDeCalendario`, mas recusa a entrada inválida em vez de
 * devolver `null` — para uso em server action, onde a data vem de formulário
 * e o certo é parar com mensagem legível, não gravar lixo.
 *
 * Esta é a ÚNICA porta por onde uma data digitada deve entrar no banco. O
 * motivo é um bug que existiu em sete telas: cada uma montava a data no
 * navegador com `new Date(`${texto}T12:00:00`)`, que é meia-noite (ou meio-dia)
 * do fuso de QUEM DIGITOU. Em São Paulo isso gravava 15:00 UTC, e aí o filtro
 * de período — que compara com meia-noite UTC, como manda a convenção —
 * deixava de fora justamente o último dia do intervalo: filtrar "1 a 30" não
 * mostrava os boletos do dia 30.
 *
 * Nenhum dado de calendário pode depender do fuso do navegador de quem
 * cadastrou: o vencimento do dia 30 é dia 30 em qualquer lugar do mundo. Por
 * isso a tela manda TEXTO e a conversão acontece aqui.
 */
export function exigirDataDeCalendario(anoMesDiaIso: string, nomeDoCampo: string): Date {
  const data = dataDeCalendario(anoMesDiaIso);

  if (!data) {
    throw new Error(`Informe ${nomeDoCampo} em formato de data válido (dia, mês e ano).`);
  }

  return data;
}
