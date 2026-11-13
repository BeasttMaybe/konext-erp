/**
 * Agenda — regras puras (sem banco, sem fuso do processo).
 *
 * A agenda junta numa linha do tempo:
 * - COMPROMISSO: marcado pela equipe (tabela Compromisso);
 * - RECEBER / PAGAR: vencimentos do financeiro (ContaReceber / ParcelaDespesa
 *   pendentes), so para quem pode ver o financeiro;
 * - META: prazo de meta em andamento, so para quem pode ver metas.
 *
 * So o compromisso e editavel aqui; os outros sao atalhos para a tela dona.
 */

export type TipoDeEvento = "COMPROMISSO" | "RECEBER" | "PAGAR" | "META";

export type EventoDaAgenda = {
  id: string;
  tipo: TipoDeEvento;
  titulo: string;
  detalhe: string | null;
  /** Instante (compromisso com hora) ou meia-noite UTC do dia (dia inteiro). */
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  /** Chave AAAA-MM-DD do dia NA LOJA — calculada no servidor. */
  dia: string;
  /** Valor em reais, para RECEBER/PAGAR. */
  valor: number | null;
  concluido: boolean;
  atrasado: boolean;
  href: string | null;
};

/** Antecedencias oferecidas para o aviso, em minutos. 0 = na hora; null = sem aviso. */
export const ANTECEDENCIAS_DE_AVISO = [0, 15, 30, 60, 120, 1440] as const;
export const ANTECEDENCIA_PADRAO = 60;

export function rotuloDaAntecedencia(minutos: number | null): string {
  if (minutos === null) return "Sem aviso";
  if (minutos === 0) return "Na hora";
  if (minutos < 60) return `${minutos} min antes`;
  if (minutos === 1440) return "1 dia antes";
  const horas = minutos / 60;
  return `${horas} ${horas === 1 ? "hora" : "horas"} antes`;
}

/** Um compromisso "passou da hora" de avisar quando ja comecou ha mais disso. */
export const LIMITE_DE_AVISO_ATRASADO_MS = 6 * 60 * 60 * 1000;

export type CompromissoParaAviso = {
  id: string;
  inicio: Date;
  diaInteiro: boolean;
  avisarMinutosAntes: number | null;
  avisadoEm: Date | null;
  concluidoEm: Date | null;
  canceladoEm: Date | null;
};

/**
 * Quais compromissos devem virar notificacao agora. Dia inteiro avisa a
 * partir de (meia-noite do dia na loja − antecedencia) — quem chama passa o
 * `inicio` ja como instante da meia-noite na loja.
 *
 * Nao avisa o que ja passou ha muito (sistema ficou fechado o dia todo): um
 * aviso de "reuniao as 9h" chegando as 18h so atrapalha.
 */
export function compromissosParaAvisar<T extends CompromissoParaAviso>(itens: readonly T[], agora: Date): T[] {
  const t = agora.getTime();
  return itens.filter((c) => {
    if (c.avisarMinutosAntes === null || c.avisadoEm || c.concluidoEm || c.canceladoEm) return false;
    const inicio = c.inicio.getTime();
    const aPartirDe = inicio - c.avisarMinutosAntes * 60_000;
    const limite = c.diaInteiro ? inicio + 24 * 60 * 60 * 1000 : inicio + LIMITE_DE_AVISO_ATRASADO_MS;
    return t >= aPartirDe && t <= limite;
  });
}

export type DadosDoCompromisso = {
  titulo: string;
  descricao: string | null;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM, ou null para dia inteiro */
  horaInicio: string | null;
  horaFim: string | null;
  avisarMinutosAntes: number | null;
  clienteId: string | null;
};

export type ResultadoDaValidacao = { ok: true; dados: DadosDoCompromisso } | { ok: false; erro: string };

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validarCompromisso(entrada: Record<string, unknown>): ResultadoDaValidacao {
  const titulo = String(entrada.titulo ?? "").trim();
  if (!titulo) return { ok: false, erro: "Dê um título ao compromisso." };
  if (titulo.length > 120) return { ok: false, erro: "O título pode ter até 120 caracteres." };

  const descricaoBruta = String(entrada.descricao ?? "").trim();
  if (descricaoBruta.length > 2000) return { ok: false, erro: "A descrição pode ter até 2000 caracteres." };

  const data = String(entrada.data ?? "").trim();
  const partes = RE_DATA.exec(data);
  if (!partes) return { ok: false, erro: "Escolha a data." };
  const [, ano, mes, dia] = partes.map(Number) as [number, number, number, number];
  const conferida = new Date(Date.UTC(ano, mes - 1, dia));
  if (conferida.getUTCMonth() !== mes - 1 || conferida.getUTCDate() !== dia || ano < 2000 || ano > 2100) {
    return { ok: false, erro: "Data inválida." };
  }

  const diaInteiro = entrada.diaInteiro === true || entrada.diaInteiro === "on" || entrada.diaInteiro === "true";
  let horaInicio: string | null = null;
  let horaFim: string | null = null;
  if (!diaInteiro) {
    horaInicio = String(entrada.horaInicio ?? "").trim();
    if (!RE_HORA.test(horaInicio)) return { ok: false, erro: "Escolha o horário de início." };
    const fimTexto = String(entrada.horaFim ?? "").trim();
    if (fimTexto) {
      if (!RE_HORA.test(fimTexto)) return { ok: false, erro: "Horário de término inválido." };
      if (fimTexto <= horaInicio) return { ok: false, erro: "O término precisa ser depois do início." };
      horaFim = fimTexto;
    }
  }

  const avisoTexto = String(entrada.avisarMinutosAntes ?? "").trim();
  let avisarMinutosAntes: number | null = null;
  if (avisoTexto !== "" && avisoTexto !== "nenhum") {
    const n = Number(avisoTexto);
    if (!(ANTECEDENCIAS_DE_AVISO as readonly number[]).includes(n)) return { ok: false, erro: "Aviso inválido." };
    avisarMinutosAntes = n;
  }

  const clienteTexto = String(entrada.clienteId ?? "").trim();

  return {
    ok: true,
    dados: {
      titulo,
      descricao: descricaoBruta || null,
      data,
      horaInicio,
      horaFim,
      avisarMinutosAntes,
      clienteId: clienteTexto || null,
    },
  };
}

/** Ordena: por dia, dia inteiro primeiro, depois por hora, depois titulo. */
export function ordenarEventos<T extends Pick<EventoDaAgenda, "dia" | "diaInteiro" | "inicio" | "titulo">>(eventos: readonly T[]): T[] {
  return [...eventos].sort(
    (a, b) =>
      a.dia.localeCompare(b.dia) ||
      Number(b.diaInteiro) - Number(a.diaInteiro) ||
      a.inicio.getTime() - b.inicio.getTime() ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}

export function agruparPorDia<T extends Pick<EventoDaAgenda, "dia">>(eventos: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const e of eventos) {
    const lista = grupos.get(e.dia);
    if (lista) lista.push(e);
    else grupos.set(e.dia, [e]);
  }
  return grupos;
}

/** Texto do aviso no sininho. `hora` ja formatada no fuso da loja (ou null para dia inteiro). */
export function textoDoAviso(titulo: string, hora: string | null, quando: "hoje" | "amanha" | "outro", dataCurta: string): {
  titulo: string;
  mensagem: string;
} {
  const dia = quando === "hoje" ? "Hoje" : quando === "amanha" ? "Amanhã" : dataCurta;
  return {
    titulo: "Compromisso na agenda",
    mensagem: hora ? `${dia} às ${hora}: ${titulo}` : `${dia} (dia inteiro): ${titulo}`,
  };
}
