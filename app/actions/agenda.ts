"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import {
  chaveDoDiaNaLoja,
  dataDeCalendario,
  FUSO_HORARIO_PADRAO,
  horaNaLoja,
  instanteNaLoja,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";
import { ordenarEventos, validarCompromisso, type EventoDaAgenda } from "@/lib/dominio/agenda/agenda";
import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Agenda (lib/dominio/agenda/agenda.ts). Qualquer pessoa da loja ve e marca
 * compromissos — e o nucleo, como o Dashboard. Os vencimentos do financeiro
 * so aparecem para quem pode ver o financeiro, e os prazos de meta so para
 * quem pode ver metas: a agenda nunca mostra mais do que a tela dona.
 */

const MAXIMO_DE_DIAS = 62;

export type CompromissoDetalhe = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  diaInteiro: boolean;
  avisarMinutosAntes: number | null;
  concluido: boolean;
  cliente: { id: string; nome: string } | null;
};

export type AgendaDoPeriodo = {
  de: string;
  ate: string;
  hoje: string;
  eventos: EventoDaAgenda[];
  compromissos: Record<string, CompromissoDetalhe>;
  podeVerClientes: boolean;
};

const fusoDe = (contexto: ContextoTenantServidor) => contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;

function intervaloValido(de: string, ate: string): { de: Date; ate: Date } | null {
  const inicio = dataDeCalendario(de);
  const fim = dataDeCalendario(ate);
  if (!inicio || !fim || fim < inicio) return null;
  if ((fim.getTime() - inicio.getTime()) / 86_400_000 > MAXIMO_DE_DIAS) return null;
  return { de: inicio, ate: fim };
}

const chaveCalendario = (data: Date) => data.toISOString().slice(0, 10);

async function montarAgenda(contexto: ContextoTenantServidor, de: string, ate: string): Promise<AgendaDoPeriodo> {
  const { prisma } = contexto;
  const fuso = fusoDe(contexto);
  const hoje = chaveDoDiaNaLoja(new Date(), fuso);
  const intervalo = intervaloValido(de, ate);
  if (!intervalo) throw new Error("Período inválido.");

  const inicioInstante = instanteNaLoja(de, null, fuso);
  const fimInstante = new Date(instanteNaLoja(chaveCalendario(somarDiasEmDataDeCalendario(intervalo.ate, 1)), null, fuso).getTime() - 1);
  const podeFinanceiro = temPermissao(contexto, "financeiro.ver");
  const podeMetas = temPermissao(contexto, "metas.ver");

  const [compromissos, receber, pagar, metas] = await Promise.all([
    prisma.compromisso.findMany({
      where: { canceladoEm: null, inicio: { gte: inicioInstante, lte: fimInstante } },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        inicio: true,
        fim: true,
        diaInteiro: true,
        avisarMinutosAntes: true,
        concluidoEm: true,
        cliente: { select: { id: true, nomeRazaoSocial: true } },
      },
      orderBy: { inicio: "asc" },
      take: 500,
    }),
    podeFinanceiro
      ? prisma.contaReceber.findMany({
          where: {
            status: { in: ["PENDENTE", "ATRASADO"] },
            estornadaEm: null,
            dataVencimento: { gte: intervalo.de, lte: intervalo.ate },
          },
          select: { id: true, descricao: true, valor: true, dataVencimento: true, cliente: { select: { nomeRazaoSocial: true } } },
          take: 300,
        })
      : Promise.resolve([]),
    podeFinanceiro
      ? prisma.parcelaDespesa.findMany({
          where: { status: { in: ["PENDENTE", "ATRASADO"] }, dataVencimento: { gte: intervalo.de, lte: intervalo.ate } },
          select: { id: true, valor: true, dataVencimento: true, despesa: { select: { descricao: true, fornecedor: true } } },
          take: 300,
        })
      : Promise.resolve([]),
    podeMetas
      ? prisma.meta.findMany({
          where: {
            excluidaEm: null,
            status: { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] },
            dataPrazo: { gte: intervalo.de, lte: intervalo.ate },
          },
          select: { id: true, titulo: true, dataPrazo: true },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  const eventos: EventoDaAgenda[] = [];
  const detalhes: Record<string, CompromissoDetalhe> = {};

  for (const c of compromissos) {
    const dia = chaveDoDiaNaLoja(c.inicio, fuso);
    const horaInicio = c.diaInteiro ? null : horaNaLoja(c.inicio, fuso);
    const horaFim = c.diaInteiro || !c.fim ? null : horaNaLoja(c.fim, fuso);
    const partes = [horaInicio ? (horaFim ? `${horaInicio}–${horaFim}` : horaInicio) : "Dia inteiro", c.cliente?.nomeRazaoSocial];
    eventos.push({
      id: c.id,
      tipo: "COMPROMISSO",
      titulo: c.titulo,
      detalhe: partes.filter(Boolean).join(" · "),
      inicio: c.inicio,
      fim: c.fim,
      diaInteiro: c.diaInteiro,
      dia,
      valor: null,
      concluido: c.concluidoEm !== null,
      atrasado: false,
      href: null,
    });
    detalhes[c.id] = {
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      data: dia,
      horaInicio,
      horaFim,
      diaInteiro: c.diaInteiro,
      avisarMinutosAntes: c.avisarMinutosAntes,
      concluido: c.concluidoEm !== null,
      cliente: c.cliente ? { id: c.cliente.id, nome: c.cliente.nomeRazaoSocial } : null,
    };
  }

  for (const conta of receber) {
    const dia = chaveCalendario(conta.dataVencimento);
    eventos.push({
      id: `receber-${conta.id}`,
      tipo: "RECEBER",
      titulo: conta.cliente?.nomeRazaoSocial || conta.descricao || "Conta a receber",
      detalhe: conta.cliente && conta.descricao ? conta.descricao : null,
      inicio: conta.dataVencimento,
      fim: null,
      diaInteiro: true,
      dia,
      valor: paraMoeda(deDecimal(conta.valor)),
      concluido: false,
      atrasado: dia < hoje,
      href: "/financeiro/receber",
    });
  }

  for (const parcela of pagar) {
    const dia = chaveCalendario(parcela.dataVencimento);
    eventos.push({
      id: `pagar-${parcela.id}`,
      tipo: "PAGAR",
      titulo: parcela.despesa?.descricao || parcela.despesa?.fornecedor || "Conta a pagar",
      detalhe: parcela.despesa?.descricao && parcela.despesa.fornecedor ? parcela.despesa.fornecedor : null,
      inicio: parcela.dataVencimento,
      fim: null,
      diaInteiro: true,
      dia,
      valor: paraMoeda(deDecimal(parcela.valor)),
      concluido: false,
      atrasado: dia < hoje,
      href: "/financeiro/pagar",
    });
  }

  for (const meta of metas) {
    if (!meta.dataPrazo) continue;
    const dia = chaveCalendario(meta.dataPrazo);
    eventos.push({
      id: `meta-${meta.id}`,
      tipo: "META",
      titulo: meta.titulo,
      detalhe: "Prazo da meta",
      inicio: meta.dataPrazo,
      fim: null,
      diaInteiro: true,
      dia,
      valor: null,
      concluido: false,
      atrasado: dia < hoje,
      href: "/metas",
    });
  }

  return {
    de,
    ate,
    hoje,
    eventos: ordenarEventos(eventos),
    compromissos: detalhes,
    podeVerClientes: temPermissao(contexto, "crm.ver"),
  };
}

export async function obterAgenda(de: string, ate: string): Promise<AgendaDoPeriodo> {
  const contexto = await exigirContextoTenant();
  return montarAgenda(contexto, de, ate);
}

/** Mini agenda do Dashboard: hoje e os proximos 6 dias, no maximo `limite` itens. */
export async function obterProximosDaAgenda(limite = 6): Promise<{ hoje: string; eventos: EventoDaAgenda[] }> {
  const contexto = await exigirContextoTenant();
  const hoje = chaveDoDiaNaLoja(new Date(), fusoDe(contexto));
  const ate = chaveCalendario(somarDiasEmDataDeCalendario(new Date(`${hoje}T00:00:00Z`), 6));
  const agenda = await montarAgenda(contexto, hoje, ate);
  const pendentes = agenda.eventos.filter((e) => !e.concluido);
  return { hoje, eventos: pendentes.slice(0, Math.max(1, Math.min(limite, 20))) };
}

export type ResultadoAgenda = { sucesso: true; id: string } | { sucesso: false; erro: string };

async function clienteExiste(contexto: ContextoTenantServidor, clienteId: string | null): Promise<boolean> {
  if (!clienteId) return true;
  if (!temPermissao(contexto, "crm.ver")) return false;
  const cliente = await contexto.prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  return cliente !== null;
}

function dadosParaGravar(dados: Extract<ReturnType<typeof validarCompromisso>, { ok: true }>, fuso: string) {
  const d = dados.dados;
  return {
    titulo: d.titulo,
    descricao: d.descricao,
    inicio: instanteNaLoja(d.data, d.horaInicio, fuso),
    fim: d.horaFim ? instanteNaLoja(d.data, d.horaFim, fuso) : null,
    diaInteiro: d.horaInicio === null,
    avisarMinutosAntes: d.avisarMinutosAntes,
    clienteId: d.clienteId,
  };
}

export async function salvarCompromisso(id: string | null, entrada: Record<string, unknown>): Promise<ResultadoAgenda> {
  const contexto = await exigirContextoTenant();
  const validacao = validarCompromisso(entrada ?? {});
  if (!validacao.ok) return { sucesso: false, erro: validacao.erro };
  if (!(await clienteExiste(contexto, validacao.dados.clienteId))) {
    return { sucesso: false, erro: "Cliente não encontrado." };
  }
  const dados = dadosParaGravar(validacao, fusoDe(contexto));

  try {
    if (id) {
      const atual = await contexto.prisma.compromisso.findFirst({
        where: { id: String(id), canceladoEm: null },
        select: { id: true, inicio: true, avisarMinutosAntes: true },
      });
      if (!atual) return { sucesso: false, erro: "Compromisso não encontrado." };
      // Mudou a hora ou o aviso: avisa de novo no horario novo.
      const reavisar =
        atual.inicio.getTime() !== dados.inicio.getTime() || atual.avisarMinutosAntes !== dados.avisarMinutosAntes;
      await contexto.prisma.compromisso.update({
        where: { id: atual.id },
        data: { ...dados, ...(reavisar ? { avisadoEm: null } : {}) },
        select: { id: true },
      });
      revalidatePath("/agenda");
      revalidatePath("/");
      return { sucesso: true, id: atual.id };
    }
    const criado = await contexto.prisma.compromisso.create({
      data: { ...dados, criadoPorId: contexto.usuarioOperacional.id || null },
      select: { id: true },
    });
    revalidatePath("/agenda");
    revalidatePath("/");
    return { sucesso: true, id: criado.id };
  } catch (erro) {
    console.error("[agenda] falha ao salvar", erro instanceof Error ? erro.message : erro);
    return { sucesso: false, erro: "Não foi possível salvar o compromisso. Tente de novo." };
  }
}

export async function marcarCompromissoConcluido(id: string, concluido: boolean): Promise<ResultadoAgenda> {
  const contexto = await exigirContextoTenant();
  const alterado = await contexto.prisma.compromisso.updateMany({
    where: { id: String(id), canceladoEm: null },
    data: { concluidoEm: concluido ? new Date() : null },
  });
  if (alterado.count !== 1) return { sucesso: false, erro: "Compromisso não encontrado." };
  revalidatePath("/agenda");
  revalidatePath("/");
  return { sucesso: true, id: String(id) };
}

export async function removerCompromisso(id: string): Promise<ResultadoAgenda> {
  const contexto = await exigirContextoTenant();
  const alterado = await contexto.prisma.compromisso.updateMany({
    where: { id: String(id), canceladoEm: null },
    data: { canceladoEm: new Date() },
  });
  if (alterado.count !== 1) return { sucesso: false, erro: "Compromisso não encontrado." };
  revalidatePath("/agenda");
  revalidatePath("/");
  return { sucesso: true, id: String(id) };
}
