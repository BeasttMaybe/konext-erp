import { TZDate } from "@date-fns/tz";

/**
 * Quando o caixa deve ser fechado sozinho.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * A configuração "Fechamento automático do caixa" existia, com horário e
 * tudo — e o sistema só DESENHAVA um aviso na tela do caixa dizendo
 * "Fechamento automático 23:59". Nada fechava. O dono podia ligar a opção,
 * ver o aviso todos os dias e confiar nela enquanto o caixa seguia aberto a
 * noite inteira.
 *
 * Opção que promete e não cumpre é pior que opção que não existe: a que não
 * existe você sabe que precisa fazer à mão.
 *
 * POR QUE NÃO BASTA COMPARAR A HORA DE AGORA COM A HORA CONFIGURADA
 *
 * A rotina roda de hora em hora. Um caixa com fechamento às 23:59 só seria
 * pego por uma execução que caísse exatamente entre 23:59 e 00:00 — e nenhuma
 * cai. Pior: um caixa esquecido aberto desde anteontem nunca seria fechado,
 * porque "agora" nunca é igual ao horário de ontem.
 *
 * A regra certa olha para trás: qual foi a ÚLTIMA vez que o relógio passou
 * pelo horário configurado? Todo caixa aberto antes daquele instante está
 * atrasado e deve fechar — não importa se ele ficou aberto uma hora ou três
 * dias.
 */

/** `HH:MM` entre 00:00 e 23:59. */
export function lerHorarioDeFechamento(texto: string | null | undefined): {
  hora: number;
  minuto: number;
} | null {
  if (!texto) return null;

  const casou = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!casou) return null;

  const hora = Number(casou[1]);
  const minuto = Number(casou[2]);

  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null;
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

  return { hora, minuto };
}

/**
 * O instante da última passagem pelo horário configurado, no fuso da loja.
 *
 * Se já passou das 23:59 de hoje, é hoje às 23:59. Se ainda não, é ontem às
 * 23:59 — e é por isso que o caixa de ontem fecha na primeira execução de
 * hoje de manhã, em vez de esperar a noite seguinte.
 */
export function ultimaPassagemPeloHorario(
  agora: Date,
  horario: { hora: number; minuto: number },
  fusoHorario: string
): Date {
  const agoraNoFuso = new TZDate(agora, fusoHorario);

  const candidato = new TZDate(
    agoraNoFuso.getFullYear(),
    agoraNoFuso.getMonth(),
    agoraNoFuso.getDate(),
    horario.hora,
    horario.minuto,
    0,
    0,
    fusoHorario
  );

  if (candidato.getTime() <= agoraNoFuso.getTime()) {
    return new Date(candidato.getTime());
  }

  // Ainda não passou hoje: a última passagem foi ontem.
  const ontem = new TZDate(
    agoraNoFuso.getFullYear(),
    agoraNoFuso.getMonth(),
    agoraNoFuso.getDate() - 1,
    horario.hora,
    horario.minuto,
    0,
    0,
    fusoHorario
  );

  return new Date(ontem.getTime());
}

export type CaixaParaFechar = {
  id: string;
  dataAbertura: Date;
};

/**
 * Quais caixas abertos já passaram do horário.
 *
 * Um caixa ABERTO DEPOIS da última passagem não fecha: ele é do expediente
 * em curso, e fechá-lo seria interromper a venda de alguém.
 */
export function caixasAtrasados(
  caixasAbertos: CaixaParaFechar[],
  limite: Date
): CaixaParaFechar[] {
  return caixasAbertos.filter((caixa) => caixa.dataAbertura.getTime() < limite.getTime());
}

/**
 * A decisão inteira, num lugar só, para a rotina não precisar remontá-la.
 *
 * Devolve `null` quando não há o que fazer — opção desligada, horário
 * inválido ou nenhum caixa atrasado —, e nunca uma lista vazia com motivo
 * implícito: quem chama precisa distinguir "não devia rodar" de "rodou e não
 * achou nada".
 */
export function decidirFechamentoAutomatico(entrada: {
  ativo: boolean;
  horarioTexto: string | null | undefined;
  fusoHorario: string;
  agora: Date;
  caixasAbertos: CaixaParaFechar[];
}): { limite: Date; aFechar: CaixaParaFechar[] } | null {
  if (!entrada.ativo) return null;

  const horario = lerHorarioDeFechamento(entrada.horarioTexto);
  if (!horario) return null;

  const limite = ultimaPassagemPeloHorario(entrada.agora, horario, entrada.fusoHorario);
  const aFechar = caixasAtrasados(entrada.caixasAbertos, limite);

  return aFechar.length > 0 ? { limite, aFechar } : null;
}
