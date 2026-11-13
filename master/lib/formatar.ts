const FUSO = "America/Sao_Paulo";

export function dataHora(data: Date | null | undefined): string {
  if (!data) return "—";
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

export function data(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** "há 3 h", "há 2 dias" — para ultimo acesso. */
export function haQuanto(data: Date | null | undefined, agora = new Date()): string {
  if (!data) return "nunca";
  const minutos = Math.round((agora.getTime() - data.getTime()) / 60000);
  if (minutos < 2) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `há ${horas} h`;
  return `há ${Math.round(horas / 24)} dias`;
}

export const ROTULO_STATUS: Record<string, string> = {
  ATIVA: "Ativa",
  SUSPENSA: "Suspensa",
  INATIVA: "Inativa",
  ATIVO: "No ar",
  SUSPENSO: "Suspenso",
  PROVISIONANDO: "Preparando",
};
