import "server-only";

import type { PrismaClient } from "@prisma/client";

import { compromissosParaAvisar, textoDoAviso } from "@/lib/dominio/agenda/agenda";
import { chaveDoDiaNaLoja, horaNaLoja, somarDiasEmDataDeCalendario } from "@/lib/datas";

/**
 * Transforma em notificacao do sininho os compromissos que chegaram na hora
 * de avisar (lib/dominio/agenda/agenda.ts). Roda quando alguem abre o
 * sistema (o sininho conta as nao lidas a cada tela), entao nao depende de
 * cron. Duas abas ao mesmo tempo nao duplicam: so cria a notificacao quem
 * conseguir marcar `avisadoEm` (updateMany com avisadoEm nulo).
 */
export async function gerarAvisosDeCompromissos(prisma: PrismaClient, fusoHorario: string): Promise<number> {
  const agora = new Date();
  const candidatos = await prisma.compromisso.findMany({
    where: {
      avisadoEm: null,
      concluidoEm: null,
      canceladoEm: null,
      avisarMinutosAntes: { not: null },
      // janela larga: 1 dia de antecedencia maxima, 1 dia de atraso maximo
      inicio: { gte: new Date(agora.getTime() - 24 * 3600_000), lte: new Date(agora.getTime() + 25 * 3600_000) },
    },
    select: {
      id: true,
      titulo: true,
      inicio: true,
      diaInteiro: true,
      avisarMinutosAntes: true,
      avisadoEm: true,
      concluidoEm: true,
      canceladoEm: true,
    },
    take: 50,
  });

  const devidos = compromissosParaAvisar(candidatos, agora);
  if (devidos.length === 0) return 0;

  const hoje = chaveDoDiaNaLoja(agora, fusoHorario);
  const amanha = somarDiasEmDataDeCalendario(new Date(`${hoje}T00:00:00Z`), 1).toISOString().slice(0, 10);

  let criados = 0;
  for (const c of devidos) {
    const marcado = await prisma.compromisso.updateMany({
      where: { id: c.id, avisadoEm: null },
      data: { avisadoEm: agora },
    });
    if (marcado.count !== 1) continue;
    const dia = chaveDoDiaNaLoja(c.inicio, fusoHorario);
    const [, mes, d] = dia.split("-");
    const aviso = textoDoAviso(
      c.titulo,
      c.diaInteiro ? null : horaNaLoja(c.inicio, fusoHorario),
      dia === hoje ? "hoje" : dia === amanha ? "amanha" : "outro",
      `${d}/${mes}`
    );
    await prisma.notificacao.create({ data: aviso, select: { id: true } });
    criados += 1;
  }
  return criados;
}
