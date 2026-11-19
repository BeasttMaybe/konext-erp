"use server";

import { revalidatePath } from "next/cache";
import { format, subDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { CANAIS_ORGANICOS, ROTULO_CANAL, type CanalMarketing } from "@/lib/dominio/marketing/plataformas";
import {
  podeCancelar,
  podeEditar,
  validarPublicacao,
  type StatusPublicacao,
  type TipoPublicacao,
} from "@/lib/dominio/marketing/publicacao";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import {
  estadoIntegracaoZernio,
  lerChaveZernio,
  registrarErroZernio,
  removerChaveZernio,
  salvarChaveZernio,
} from "@/lib/zernio/conexao";
import {
  CATEGORIAS_FOTO_GOOGLE,
  ErroZernio,
  LIMITE_DESCRICAO_GOOGLE,
  adicionarFotoGoogle,
  atualizarDescricaoGoogle,
  criarPost,
  excluirPostZernio,
  fichaGoogle,
  fotosGoogle,
  enviarMensagem,
  historicoSeguidoresInstagram,
  insightsDaRede,
  listarAvaliacoes,
  listarContas,
  listarConversas,
  listarMensagens,
  melhorHorario,
  metricasGooglePerfil,
  responderAvaliacao as responderAvaliacaoZernio,
  subirMidia,
  validarChave,
  type AvaliacaoZernio,
  type ConversaZernio,
  type DestinoPost,
  type HorarioSlot,
  type MensagemDireta,
  type ResumoAvaliacoes,
} from "@/lib/zernio/cliente";
import { auditarSite } from "@/lib/seo/auditar";
import {
  lerRecomendacoes,
  montarMensagensAnalise,
  ordenarPorPrioridade,
  type ContextoAnalise,
  type Recomendacao,
} from "@/lib/dominio/marketing/analise";
import {
  canalParaZernio,
  resumirMetricasGoogle,
  serieDiariaDinamica,
  totalMetrica,
  zernioParaCanal,
  type MetricasBrutas,
  type MetricasGoogle,
} from "@/lib/zernio/mapeamento";
import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Marketing integrado 100% à Zernio. As contas das redes (Instagram, TikTok,
 * Perfil do Google) vivem na Zernio; o ERP fala com ela por uma chave de API da
 * loja (cifrada — lib/zernio). Aqui ficam: conexão, composição/agendamento,
 * geração de texto com IA e o painel do Perfil do Google (métricas e avaliações).
 */

const ORIGEM = "app/actions/marketing.ts";

/** Rótulo amigável para plataformas que não têm um canal nosso (ex.: linkedin). */
function rotuloPlataformaZernio(plataforma: string): string {
  const mapa: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    googlebusiness: "Perfil do Google",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    twitter: "X (Twitter)",
    pinterest: "Pinterest",
    threads: "Threads",
    bluesky: "Bluesky",
  };
  return mapa[plataforma] ?? plataforma.charAt(0).toUpperCase() + plataforma.slice(1);
}

// ── Conexão com a Zernio ──────────────────────────────────────────────────────

export type ContaConectada = {
  id: string;
  plataforma: string;
  usuario: string;
  canal: CanalMarketing | null;
  rotulo: string;
};

export type EstadoConexaoZernio = {
  configurada: boolean;
  conectadoEm: string | null;
  contas: ContaConectada[];
  erro: string | null;
};

export async function obterConexaoZernio(): Promise<EstadoConexaoZernio> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const estado = await estadoIntegracaoZernio(contexto.prisma);
  if (!estado.existe) return { configurada: false, conectadoEm: null, contas: [], erro: null };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) {
    return { configurada: false, conectadoEm: null, contas: [], erro: "A chave salva não pôde ser lida. Reconecte a Zernio." };
  }

  try {
    const contas = await listarContas(chave);
    await registrarErroZernio(contexto.prisma, null);
    return {
      configurada: true,
      conectadoEm: estado.conectadoEm?.toISOString() ?? null,
      contas: contas.map((c) => {
        const canal = zernioParaCanal(c.plataforma);
        return {
          id: c.id,
          plataforma: c.plataforma,
          usuario: c.usuario,
          canal,
          rotulo: canal ? ROTULO_CANAL[canal] : rotuloPlataformaZernio(c.plataforma),
        };
      }),
      erro: null,
    };
  } catch (erro) {
    const mensagem = erro instanceof ErroZernio ? erro.message : "Não foi possível falar com a Zernio agora.";
    await registrarErroZernio(contexto.prisma, mensagem).catch(() => {});
    return { configurada: true, conectadoEm: estado.conectadoEm?.toISOString() ?? null, contas: [], erro: mensagem };
  }
}

export type ResultadoConexaoZernio = { ok: true; contas: number } | { ok: false; erro: string };

export async function conectarZernio(chaveBruta: string): Promise<ResultadoConexaoZernio> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.conectar");

  const chave = String(chaveBruta ?? "").trim();
  if (!chave) return { ok: false, erro: "Cole a sua chave da API Zernio." };
  if (chave.length < 10) return { ok: false, erro: "Essa chave parece curta demais. Confira em zernio.com → API keys." };

  let contas;
  try {
    contas = await validarChave(chave);
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível validar a chave agora. Tente de novo." };
  }

  await salvarChaveZernio(contexto.prisma, contexto.empresaId, chave, contexto.usuarioOperacional.id || null);
  await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:conectarZernio`), {
    acao: ACOES_AUDITORIA.CONECTAR_ZERNIO,
    entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
    dadosDepois: { contas: contas.length },
  });
  revalidatePath("/marketing/conexoes");
  revalidatePath("/marketing");
  return { ok: true, contas: contas.length };
}

export async function desconectarZernio(): Promise<{ ok: boolean }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.conectar");
  await removerChaveZernio(contexto.prisma);
  await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:desconectarZernio`), {
    acao: ACOES_AUDITORIA.DESCONECTAR_ZERNIO,
    entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
  });
  revalidatePath("/marketing/conexoes");
  revalidatePath("/marketing");
  return { ok: true };
}

// ── Publicações (CRUD) ────────────────────────────────────────────────────────

export type MidiaDaPublicacao = { id: string; url: string; tipoConteudo: string };

export type PublicacaoDaLista = {
  id: string;
  tipo: TipoPublicacao;
  texto: string;
  status: StatusPublicacao;
  canais: CanalMarketing[];
  agendadoPara: string | null;
  publicadoEm: string | null;
  orcamentoCentavos: number | null;
  criadoEm: string;
  temMidia: boolean;
};

export async function listarPublicacoes(tipo?: TipoPublicacao): Promise<PublicacaoDaLista[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const linhas = await contexto.prisma.publicacaoMarketing.findMany({
    where: tipo ? { tipo } : undefined,
    select: {
      id: true,
      tipo: true,
      texto: true,
      status: true,
      agendadoPara: true,
      publicadoEm: true,
      orcamentoCentavos: true,
      criadoEm: true,
      destinos: { select: { canal: true } },
      _count: { select: { midias: true } },
    },
    orderBy: [{ agendadoPara: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    take: 200,
  });

  return linhas.map((p) => ({
    id: p.id,
    tipo: p.tipo as TipoPublicacao,
    texto: p.texto,
    status: p.status as StatusPublicacao,
    canais: p.destinos.map((d) => d.canal as CanalMarketing),
    agendadoPara: p.agendadoPara?.toISOString() ?? null,
    publicadoEm: p.publicadoEm?.toISOString() ?? null,
    orcamentoCentavos: p.orcamentoCentavos,
    criadoEm: p.criadoEm.toISOString(),
    temMidia: p._count.midias > 0,
  }));
}

export type ResultadoPublicacao = { ok: true; id: string } | { ok: false; erro: string };

function exigirPermissaoDoTipo(contexto: ContextoTenantServidor, tipo: TipoPublicacao) {
  exigirPermissao(contexto, tipo === "ANUNCIO_PAGO" ? "marketing.anunciar" : "marketing.publicar");
}

export async function salvarPublicacao(id: string | null, entrada: Record<string, unknown>): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const validacao = validarPublicacao(entrada ?? {});
  if (!validacao.ok) return { ok: false, erro: validacao.erro };
  const dados = validacao.dados;
  exigirPermissaoDoTipo(contexto, dados.tipo);

  const canaisValidos = dados.canais.filter((c) => (CANAIS_ORGANICOS as readonly string[]).includes(c));
  if (canaisValidos.length === 0) return { ok: false, erro: "Escolha um canal de publicação válido." };

  // Salvar sempre guarda como RASCUNHO: publicar/agendar é um passo explícito
  // (publicarPublicacao), que é quem fala com a Zernio. A data preenchida fica
  // guardada como a hora pretendida para o botão "Agendar".
  try {
    if (id) {
      const atual = await contexto.prisma.publicacaoMarketing.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!atual) return { ok: false, erro: "Publicação não encontrada." };
      if (atual.status === "AGENDADA") {
        return { ok: false, erro: "Esta publicação está agendada na Zernio. Cancele o agendamento antes de editar." };
      }
      if (!podeEditar(atual.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode mais ser editada." };
      await contexto.prisma.$transaction(async (tx) => {
        await tx.publicacaoDestino.deleteMany({ where: { publicacaoId: id } });
        await tx.publicacaoMarketing.update({
          where: { id },
          data: {
            tipo: dados.tipo,
            texto: dados.texto,
            status: "RASCUNHO",
            zernioPostId: null,
            agendadoPara: dados.agendadoPara ? new Date(dados.agendadoPara) : null,
            orcamentoCentavos: dados.orcamentoCentavos,
            linkDestino: dados.linkDestino,
            ultimoErro: null,
            destinos: { create: canaisValidos.map((canal) => ({ canal })) },
          },
          select: { id: true },
        });
      });
      revalidatePath("/marketing/publicacoes");
      revalidatePath("/marketing/anuncios");
      return { ok: true, id };
    }

    const criada = await contexto.prisma.publicacaoMarketing.create({
      data: {
        tipo: dados.tipo,
        texto: dados.texto,
        status: "RASCUNHO",
        agendadoPara: dados.agendadoPara ? new Date(dados.agendadoPara) : null,
        orcamentoCentavos: dados.orcamentoCentavos,
        linkDestino: dados.linkDestino,
        criadoPorId: contexto.usuarioOperacional.id || null,
        destinos: { create: canaisValidos.map((canal) => ({ canal })) },
      },
      select: { id: true },
    });
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:salvarPublicacao`), {
      acao: ACOES_AUDITORIA.CRIAR,
      entidade: ENTIDADES_AUDITORIA.PUBLICACAO_MARKETING,
      entidadeId: criada.id,
      dadosDepois: { tipo: dados.tipo, status: "RASCUNHO", canais: canaisValidos },
    });
    revalidatePath("/marketing/publicacoes");
    revalidatePath("/marketing/anuncios");
    return { ok: true, id: criada.id };
  } catch (erro) {
    console.error("[marketing] falha ao salvar publicação", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }
}

export type PublicacaoParaEditar = {
  id: string;
  tipo: TipoPublicacao;
  texto: string;
  status: StatusPublicacao;
  canais: CanalMarketing[];
  agendadoPara: string | null;
  orcamentoCentavos: number | null;
  linkDestino: string | null;
  midias: MidiaDaPublicacao[];
};

export async function obterPublicacao(id: string): Promise<PublicacaoParaEditar | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { gerarUrlDeLeitura } = await import("@/lib/fotos/armazenamento");

  const p = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      texto: true,
      status: true,
      agendadoPara: true,
      orcamentoCentavos: true,
      linkDestino: true,
      destinos: { select: { canal: true } },
      midias: { select: { id: true, chaveArmazenamento: true, tipoConteudo: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    tipo: p.tipo as TipoPublicacao,
    texto: p.texto,
    status: p.status as StatusPublicacao,
    canais: p.destinos.map((d) => d.canal as CanalMarketing),
    agendadoPara: p.agendadoPara?.toISOString() ?? null,
    orcamentoCentavos: p.orcamentoCentavos,
    linkDestino: p.linkDestino,
    midias: await Promise.all(
      p.midias.map(async (m) => ({ id: m.id, tipoConteudo: m.tipoConteudo, url: await gerarUrlDeLeitura(m.chaveArmazenamento) }))
    ),
  };
}

export async function cancelarPublicacao(id: string): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const atual = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: { id: true, status: true, tipo: true, zernioPostId: true },
  });
  if (!atual) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, atual.tipo as TipoPublicacao);
  if (!podeCancelar(atual.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode ser cancelada." };

  // Agendada na Zernio: tira o agendamento de lá ANTES, senão o post sairia
  // mesmo cancelado aqui.
  if (atual.status === "AGENDADA" && atual.zernioPostId) {
    const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
    if (!chave) return { ok: false, erro: "Conecte a Zernio para cancelar um post agendado." };
    try {
      await excluirPostZernio(chave, atual.zernioPostId);
    } catch (erro) {
      return {
        ok: false,
        erro: erro instanceof ErroZernio ? `Não deu para cancelar o agendamento na Zernio: ${erro.message}` : "Não deu para cancelar o agendamento na Zernio agora. Tente de novo.",
      };
    }
  }

  await contexto.prisma.publicacaoMarketing.update({ where: { id }, data: { status: "CANCELADA", zernioPostId: null }, select: { id: true } });
  revalidatePath("/marketing/publicacoes");
  revalidatePath("/marketing/anuncios");
  return { ok: true, id };
}

export async function excluirPublicacao(id: string): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { apagarObjeto } = await import("@/lib/fotos/armazenamento");
  const p = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: { id: true, tipo: true, status: true, zernioPostId: true, midias: { select: { chaveArmazenamento: true } } },
  });
  if (!p) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, p.tipo as TipoPublicacao);

  // Se ainda está agendada na Zernio, tira de lá antes de apagar aqui.
  if (p.status === "AGENDADA" && p.zernioPostId) {
    const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
    if (chave) {
      try {
        await excluirPostZernio(chave, p.zernioPostId);
      } catch (erro) {
        return {
          ok: false,
          erro: erro instanceof ErroZernio ? `Cancele o agendamento na Zernio antes de excluir: ${erro.message}` : "Não deu para cancelar o agendamento na Zernio agora. Tente de novo.",
        };
      }
    }
  }

  for (const m of p.midias) await apagarObjeto(m.chaveArmazenamento).catch(() => {});
  await contexto.prisma.publicacaoMarketing.delete({ where: { id } });
  revalidatePath("/marketing/publicacoes");
  revalidatePath("/marketing/anuncios");
  return { ok: true, id };
}

// ── Publicar / agendar (via Zernio) ───────────────────────────────────────────

export type ResultadoPublicar =
  | { ok: true; status: StatusPublicacao; url: string | null }
  | { ok: false; erro: string; configurar?: boolean };

export async function publicarPublicacao(id: string, opcoes?: { agendarPara?: string | null }): Promise<ResultadoPublicar> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { randomUUID } = await import("node:crypto");
  const { lerObjetoComoBytes } = await import("@/lib/fotos/armazenamento");

  const pub = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      texto: true,
      status: true,
      agendadoPara: true,
      destinos: { select: { canal: true } },
      midias: { select: { chaveArmazenamento: true, tipoConteudo: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!pub) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, pub.tipo as TipoPublicacao);

  if (pub.tipo === "ANUNCIO_PAGO") {
    return { ok: false, erro: "Anúncios pagos não publicam por aqui ainda — por ora são planejados. A publicação paga entra numa etapa própria." };
  }
  if (!podeEditar(pub.status as StatusPublicacao)) {
    return { ok: false, erro: "Esta publicação não pode mais ser publicada (já saiu ou foi cancelada)." };
  }
  if (!pub.texto.trim()) return { ok: false, erro: "Escreva o texto antes de publicar." };

  const canais = pub.destinos.map((d) => d.canal as CanalMarketing);
  if (canais.length === 0) return { ok: false, erro: "Escolha ao menos um canal." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, configurar: true, erro: "Conecte a Zernio em Marketing → Conexões antes de publicar." };

  // Agendar? Converte o instante guardado (UTC) para a hora local da loja, que é
  // o formato que a Zernio espera (horário "de parede" + fuso à parte).
  const fuso = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const quando = opcoes?.agendarPara ?? (pub.agendadoPara ? pub.agendadoPara.toISOString() : null);
  let agendarLocal: string | null = null;
  if (quando) {
    const instante = new Date(quando);
    if (Number.isNaN(instante.getTime())) return { ok: false, erro: "Data de agendamento inválida." };
    if (instante.getTime() <= Date.now()) {
      return { ok: false, erro: "O horário de agendamento já passou. Escolha um horário futuro ou publique agora." };
    }
    agendarLocal = format(new TZDate(instante, fuso), "yyyy-MM-dd'T'HH:mm:ss");
  }

  try {
    const contas = await listarContas(chave);
    const porPlataforma = new Map<string, string>();
    for (const c of contas) if (!porPlataforma.has(c.plataforma)) porPlataforma.set(c.plataforma, c.id);

    const destinos: DestinoPost[] = [];
    const faltando: string[] = [];
    for (const canal of canais) {
      const contaId = porPlataforma.get(canalParaZernio(canal));
      if (contaId) destinos.push({ plataforma: canalParaZernio(canal), contaId });
      else faltando.push(ROTULO_CANAL[canal]);
    }
    if (destinos.length === 0) {
      return {
        ok: false,
        configurar: true,
        erro: `Nenhum dos canais escolhidos está conectado na Zernio (${faltando.join(", ")}). Conecte-os na Zernio e tente de novo.`,
      };
    }

    // Reenvia as imagens do R2 para a Zernio (ela hospeda e serve no post).
    const midias: Array<{ tipo: "image"; url: string }> = [];
    for (const m of pub.midias) {
      const bytes = await lerObjetoComoBytes(m.chaveArmazenamento);
      const nome = m.chaveArmazenamento.split("/").pop() || "imagem.jpg";
      const url = await subirMidia(chave, { nome, tipoConteudo: m.tipoConteudo, bytes });
      midias.push({ tipo: "image", url });
    }

    const resultado = await criarPost(chave, {
      conteudo: pub.texto,
      destinos,
      midias,
      agendarPara: agendarLocal,
      fusoHorario: fuso,
      idempotencia: randomUUID(),
    });

    const novoStatus: StatusPublicacao = agendarLocal ? "AGENDADA" : "PUBLICADA";
    const statusPorPlataforma = new Map(resultado.porPlataforma.map((p) => [p.plataforma, p]));

    await contexto.prisma.$transaction(async (tx) => {
      await tx.publicacaoMarketing.update({
        where: { id },
        data: {
          status: novoStatus,
          publicadoEm: agendarLocal ? null : new Date(),
          agendadoPara: quando ? new Date(quando) : null,
          zernioPostId: resultado.postId,
          ultimoErro: null,
        },
      });
      for (const canal of canais) {
        const plataforma = canalParaZernio(canal);
        const enviado = destinos.some((d) => d.plataforma === plataforma);
        const resPlataforma = statusPorPlataforma.get(plataforma);
        const falhou = Boolean(resPlataforma && /fail|error|reject/i.test(resPlataforma.status));
        await tx.publicacaoDestino.updateMany({
          where: { publicacaoId: id, canal },
          data: {
            status: !enviado ? "FALHOU" : agendarLocal ? "PENDENTE" : falhou ? "FALHOU" : "PUBLICADA",
            idExternoPublicado: resPlataforma?.url ?? null,
            erro: !enviado ? "Canal não conectado na Zernio" : null,
            publicadoEm: !agendarLocal && enviado && !falhou ? new Date() : null,
          },
        });
      }
    });

    await registrarErroZernio(contexto.prisma, null).catch(() => {});
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:publicarPublicacao`), {
      acao: ACOES_AUDITORIA.PUBLICAR_MARKETING,
      entidade: ENTIDADES_AUDITORIA.PUBLICACAO_MARKETING,
      entidadeId: id,
      dadosDepois: { status: novoStatus, canais, agendado: Boolean(agendarLocal), zernioPostId: resultado.postId },
    });

    revalidatePath("/marketing/publicacoes");
    revalidatePath("/marketing");
    const url = resultado.porPlataforma.find((p) => p.url)?.url ?? null;
    return { ok: true, status: novoStatus, url };
  } catch (erro) {
    const mensagem = erro instanceof ErroZernio ? erro.message : "Não foi possível publicar agora. Tente de novo.";
    await contexto.prisma.publicacaoMarketing
      .update({ where: { id }, data: { status: "FALHOU", ultimoErro: mensagem.slice(0, 500) } })
      .catch(() => {});
    await registrarErroZernio(contexto.prisma, mensagem).catch(() => {});
    if (!(erro instanceof ErroZernio)) console.error("[marketing] falha ao publicar", erro instanceof Error ? erro.message : erro);
    revalidatePath("/marketing/publicacoes");
    return { ok: false, erro: mensagem };
  }
}

// ── Mídia ──────────────────────────────────────────────────────────────────────

export type ResultadoMidia = { ok: true; midia: MidiaDaPublicacao } | { ok: false; erro: string };

export async function enviarMidiaDaPublicacao(dados: FormData): Promise<ResultadoMidia> {
  const contexto = await exigirContextoTenant();
  const { randomUUID } = await import("node:crypto");
  const { ehTipoDeImagemAceito, TAMANHO_MAXIMO_DA_FOTO_EM_BYTES, conteudoConfereComOTipo } = await import("@/lib/dominio/os/fotos");
  const { armazenamentoEstaConfigurado, gravarObjeto, gerarUrlDeLeitura } = await import("@/lib/fotos/armazenamento");

  const publicacaoId = String(dados.get("publicacaoId") ?? "");
  const arquivo = dados.get("arquivo");

  const pub = await contexto.prisma.publicacaoMarketing.findUnique({ where: { id: publicacaoId }, select: { id: true, tipo: true, status: true } });
  if (!pub) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, pub.tipo as TipoPublicacao);
  if (!podeEditar(pub.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode mais receber imagens." };
  if (!armazenamentoEstaConfigurado()) return { ok: false, erro: "O armazenamento de imagens ainda não está configurado (Configurações)." };
  if (!(arquivo instanceof File)) return { ok: false, erro: "Nenhum arquivo foi recebido." };
  if (!ehTipoDeImagemAceito(arquivo.type)) return { ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." };
  if (arquivo.size > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) return { ok: false, erro: "A imagem é grande demais." };

  const total = await contexto.prisma.publicacaoMidia.count({ where: { publicacaoId } });
  if (total >= 10) return { ok: false, erro: "Máximo de 10 imagens por publicação." };

  const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const chave = `marketing/${publicacaoId}/${randomUUID()}.${extensao}`;
  const conteudo = new Uint8Array(await arquivo.arrayBuffer());
  if (!conteudoConfereComOTipo(conteudo, arquivo.type)) return { ok: false, erro: "Esse arquivo não é uma imagem válida." };

  await gravarObjeto({ chave, corpo: conteudo, tipoConteudo: arquivo.type });
  const midia = await contexto.prisma.publicacaoMidia.create({
    data: { publicacaoId, chaveArmazenamento: chave, tipoConteudo: arquivo.type, tamanhoBytes: arquivo.size, ordem: total },
    select: { id: true, chaveArmazenamento: true, tipoConteudo: true },
  });
  revalidatePath("/marketing/publicacoes");
  return { ok: true, midia: { id: midia.id, tipoConteudo: midia.tipoConteudo, url: await gerarUrlDeLeitura(midia.chaveArmazenamento) } };
}

export async function removerMidiaDaPublicacao(midiaId: string): Promise<{ ok: boolean }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { apagarObjeto } = await import("@/lib/fotos/armazenamento");
  const midia = await contexto.prisma.publicacaoMidia.findUnique({
    where: { id: midiaId },
    select: { id: true, chaveArmazenamento: true, publicacao: { select: { tipo: true, status: true } } },
  });
  if (!midia) return { ok: false };
  exigirPermissaoDoTipo(contexto, midia.publicacao.tipo as TipoPublicacao);
  if (!podeEditar(midia.publicacao.status as StatusPublicacao)) return { ok: false };
  await apagarObjeto(midia.chaveArmazenamento).catch(() => {});
  await contexto.prisma.publicacaoMidia.delete({ where: { id: midiaId } });
  revalidatePath("/marketing/publicacoes");
  return { ok: true };
}

/** Indicadores da home do Marketing. */
export async function obterResumoMarketing(): Promise<{ agendadas: number; rascunhos: number; publicadas: number; conexoesAtivas: number }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const [agendadas, rascunhos, publicadas] = await Promise.all([
    contexto.prisma.publicacaoMarketing.count({ where: { status: "AGENDADA" } }),
    contexto.prisma.publicacaoMarketing.count({ where: { status: "RASCUNHO" } }),
    contexto.prisma.publicacaoMarketing.count({ where: { status: "PUBLICADA" } }),
  ]);

  let conexoesAtivas = 0;
  try {
    const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
    if (chave) conexoesAtivas = (await listarContas(chave)).length;
  } catch {
    conexoesAtivas = 0;
  }

  return { agendadas, rascunhos, publicadas, conexoesAtivas };
}

// ── Gerador de texto com IA ────────────────────────────────────────────────────

export type ResultadoGeracao = { ok: true; variacoes: string[] } | { ok: false; erro: string; configurar?: boolean };

export async function gerarTextoPublicacao(entrada: Record<string, unknown>): Promise<ResultadoGeracao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { lerPedido, montarMensagens, separarVariacoes } = await import("@/lib/dominio/marketing/gerador-de-texto");
  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");

  if (!iaConfigurada()) {
    return {
      ok: false,
      configurar: true,
      erro: "O gerador por IA ainda não está ligado. Configure a chave de IA (IA_API_KEY) para usar.",
    };
  }

  const pedidoLido = lerPedido(entrada ?? {});
  if (!pedidoLido.ok) return { ok: false, erro: pedidoLido.erro };

  const config = await contexto.prisma.configuracao.findFirst({ select: { nomeFantasia: true, cidade: true, telefone: true } });

  const mensagens = montarMensagens(
    {
      nome: config?.nomeFantasia?.trim() || "a loja",
      cidade: config?.cidade?.trim() || null,
      telefone: config?.telefone?.trim() || null,
      segmento: "Assistência técnica de celulares: conserto, troca de tela, bateria, venda de acessórios e películas.",
    },
    pedidoLido.pedido
  );

  try {
    const resposta = await gerarComIA(mensagens);
    const variacoes = separarVariacoes(resposta);
    if (variacoes.length === 0) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, variacoes };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    console.error("[marketing] falha ao gerar texto", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível gerar o texto agora. Tente de novo." };
  }
}

// ── Perfil do Google: métricas e avaliações ───────────────────────────────────

async function contaGoogleId(chave: string): Promise<string | null> {
  const contas = await listarContas(chave);
  return contas.find((c) => c.plataforma === "googlebusiness")?.id ?? null;
}

export type MotivoSemGoogle = "SEM_CHAVE" | "SEM_CONTA" | "SEM_ANALYTICS" | "ERRO";

export type ResultadoMetricasGoogle =
  | { ok: true; conta: string; dias: number; metricas: MetricasGoogle }
  | { ok: false; motivo: MotivoSemGoogle; erro: string };

export async function obterMetricasGoogle(dias = 30): Promise<ResultadoMetricasGoogle> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const janela = Math.max(7, Math.min(540, Math.trunc(dias) || 30));
  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  const fuso = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const hoje = TZDate.tz(fuso);
  const ate = format(hoje, "yyyy-MM-dd");
  const de = format(subDays(hoje, janela), "yyyy-MM-dd");

  try {
    const contaId = await contaGoogleId(chave);
    if (!contaId) return { ok: false, motivo: "SEM_CONTA", erro: "O Perfil do Google ainda não está conectado na Zernio." };
    const resposta = await metricasGooglePerfil(chave, { contaId, de, ate });
    return { ok: true, conta: contaId, dias: janela, metricas: resumirMetricasGoogle(resposta) };
  } catch (erro) {
    if (erro instanceof ErroZernio && erro.codigo === "analytics_addon_required") {
      return { ok: false, motivo: "SEM_ANALYTICS", erro: erro.message };
    }
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível obter as métricas agora." };
  }
}

// ── Análise de redes (Instagram / TikTok) ─────────────────────────────────────

export type SerieGrafico = {
  titulo: string;
  tipo: "area" | "bar";
  series: Array<{ chave: string; rotulo: string; cor: string }>;
  dados: Array<Record<string, number | string>>;
};

export type AnaliseRede = {
  kpis: Array<{ rotulo: string; valor: number }>;
  graficos: SerieGrafico[];
  aviso: string | null;
};

export type ResultadoAnaliseRede =
  | { ok: true; plataforma: "INSTAGRAM" | "TIKTOK"; analise: AnaliseRede }
  | { ok: false; motivo: MotivoSemGoogle; erro: string };

const CORES_GRAFICO = ["var(--kx-primaria)", "var(--kx-sucesso)", "var(--kx-destaque)", "var(--kx-pronto)"];

function diaCurtoAnalise(data: string): string {
  const [, mes, dia] = data.split("-");
  return mes && dia ? `${dia}/${mes}` : data;
}

function comRotuloDeDia(linhas: Array<Record<string, number | string>>): Array<Record<string, number | string>> {
  return linhas.map((l) => ({ ...l, rotulo: diaCurtoAnalise(String(l.data)) }));
}

export async function obterAnaliseRede(plataforma: "INSTAGRAM" | "TIKTOK", dias = 30): Promise<ResultadoAnaliseRede> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const janela = Math.max(7, Math.min(89, Math.trunc(dias) || 30));
  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  const fuso = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const hoje = TZDate.tz(fuso);
  const ate = format(hoje, "yyyy-MM-dd");
  const de = format(subDays(hoje, janela), "yyyy-MM-dd");
  const idZernio = plataforma === "INSTAGRAM" ? "instagram" : "tiktok";
  const nomeRede = plataforma === "INSTAGRAM" ? "Instagram" : "TikTok";

  try {
    const contas = await listarContas(chave);
    const contaId = contas.find((c) => c.plataforma === idZernio)?.id;
    if (!contaId) return { ok: false, motivo: "SEM_CONTA", erro: `A conta de ${nomeRede} ainda não está conectada na Zernio.` };

    if (plataforma === "TIKTOK") {
      const resp = await insightsDaRede(chave, {
        plataforma: "tiktok",
        contaId,
        de,
        ate,
        tipo: "time_series",
        metricas: "follower_count,video_views,likes,comments,shares,profile_views",
      });
      const m = (resp.metrics ?? {}) as MetricasBrutas;
      const kpis = [
        { rotulo: "Seguidores", valor: totalMetrica(m, "follower_count") },
        { rotulo: "Visualizações", valor: totalMetrica(m, "video_views") },
        { rotulo: "Curtidas", valor: totalMetrica(m, "likes") },
        { rotulo: "Comentários", valor: totalMetrica(m, "comments") },
        { rotulo: "Compart.", valor: totalMetrica(m, "shares") },
        { rotulo: "Visitas ao perfil", valor: totalMetrica(m, "profile_views") },
      ];
      const graficos: SerieGrafico[] = [
        {
          titulo: "Visualizações por dia",
          tipo: "area",
          series: [{ chave: "video_views", rotulo: "Visualizações", cor: CORES_GRAFICO[0] }],
          dados: comRotuloDeDia(serieDiariaDinamica(m, ["video_views"])),
        },
        {
          titulo: "Engajamento por dia",
          tipo: "bar",
          series: [
            { chave: "likes", rotulo: "Curtidas", cor: CORES_GRAFICO[1] },
            { chave: "comments", rotulo: "Comentários", cor: CORES_GRAFICO[2] },
            { chave: "shares", rotulo: "Compart.", cor: CORES_GRAFICO[3] },
          ],
          dados: comRotuloDeDia(serieDiariaDinamica(m, ["likes", "comments", "shares"])),
        },
      ];
      return { ok: true, plataforma, analise: { kpis, graficos, aviso: "O TikTok fecha os números de cada dia com 24–48h de atraso." } };
    }

    // Instagram
    const [totais, seguidores, alcance] = await Promise.all([
      insightsDaRede(chave, {
        plataforma: "instagram",
        contaId,
        de,
        ate,
        tipo: "total_value",
        metricas: "reach,views,accounts_engaged,total_interactions,profile_views,website_clicks,likes,saves,shares,comments",
      }),
      historicoSeguidoresInstagram(chave, { contaId, de, ate }),
      insightsDaRede(chave, { plataforma: "instagram", contaId, de, ate, tipo: "time_series", metricas: "reach" }),
    ]);
    const mt = (totais.metrics ?? {}) as MetricasBrutas;
    const ms = (seguidores.metrics ?? {}) as MetricasBrutas;
    const ma = (alcance.metrics ?? {}) as MetricasBrutas;

    const kpis = [
      { rotulo: "Seguidores", valor: totalMetrica(ms, "follower_count") },
      { rotulo: "Alcance", valor: totalMetrica(mt, "reach") },
      { rotulo: "Visualizações", valor: totalMetrica(mt, "views") },
      { rotulo: "Contas engajadas", valor: totalMetrica(mt, "accounts_engaged") },
      { rotulo: "Interações", valor: totalMetrica(mt, "total_interactions") },
      { rotulo: "Visitas ao perfil", valor: totalMetrica(mt, "profile_views") },
      { rotulo: "Cliques no site", valor: totalMetrica(mt, "website_clicks") },
    ];

    const graficos: SerieGrafico[] = [];
    const serieAlcance = comRotuloDeDia(serieDiariaDinamica(ma, ["reach"]));
    if (serieAlcance.length > 0) {
      graficos.push({
        titulo: "Alcance por dia",
        tipo: "area",
        series: [{ chave: "reach", rotulo: "Alcance", cor: CORES_GRAFICO[0] }],
        dados: serieAlcance,
      });
    }
    const serieSeguidores = comRotuloDeDia(serieDiariaDinamica(ms, ["follower_count"]));
    if (serieSeguidores.length > 1) {
      graficos.push({
        titulo: "Seguidores por dia",
        tipo: "area",
        series: [{ chave: "follower_count", rotulo: "Seguidores", cor: CORES_GRAFICO[1] }],
        dados: serieSeguidores,
      });
    }

    const aviso =
      graficos.length === 0
        ? "Os totais acima já refletem os últimos 30 dias. Os gráficos diários vão aparecer conforme os próximos dias forem registrados."
        : "O Instagram entrega a maioria dos números como total do período; o histórico diário preenche com o tempo.";

    return { ok: true, plataforma, analise: { kpis, graficos, aviso } };
  } catch (erro) {
    if (erro instanceof ErroZernio && erro.codigo === "analytics_addon_required") {
      return { ok: false, motivo: "SEM_ANALYTICS", erro: erro.message };
    }
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível obter os dados agora." };
  }
}

// ── Análise & Dicas (IA sobre os dados reais) ─────────────────────────────────

export type ResultadoAnalise =
  | {
      ok: true;
      recomendacoes: Recomendacao[];
      seo: { url: string; palavras: number; pareceSpa: boolean; problemas: string[] } | null;
    }
  | { ok: false; erro: string; configurar?: boolean };

export async function gerarAnaliseMarketing(): Promise<ResultadoAnalise> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) {
    return { ok: false, configurar: true, erro: "A análise usa IA. Configure a chave de IA (IA_API_KEY) para usar." };
  }

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio em Marketing → Conexões para gerar a análise." };

  const config = await contexto.prisma.configuracao.findFirst({ select: { nomeFantasia: true, cidade: true } });
  const fuso = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const hoje = TZDate.tz(fuso);
  const ate = format(hoje, "yyyy-MM-dd");
  const de = format(subDays(hoje, 30), "yyyy-MM-dd");

  let contas;
  try {
    contas = await listarContas(chave);
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível falar com a Zernio agora." };
  }
  const idGoogle = contas.find((c) => c.plataforma === "googlebusiness")?.id ?? null;
  const idInstagram = contas.find((c) => c.plataforma === "instagram")?.id ?? null;
  const idTiktok = contas.find((c) => c.plataforma === "tiktok")?.id ?? null;

  // Perfil do Google: métricas + avaliações + ficha + fotos (resiliente a falhas parciais).
  let google: ContextoAnalise["google"] = null;
  let siteUrl: string | null = null;
  if (idGoogle) {
    const [metricasRes, avaliacoesRes, fichaRes, fotosRes] = await Promise.allSettled([
      metricasGooglePerfil(chave, { contaId: idGoogle, de, ate }),
      listarAvaliacoes(chave, { contaId: idGoogle, apenasSemResposta: true, limite: 50 }),
      fichaGoogle(chave, idGoogle),
      fotosGoogle(chave, idGoogle),
    ]);
    const metricas = metricasRes.status === "fulfilled" ? resumirMetricasGoogle(metricasRes.value) : null;
    const ficha = fichaRes.status === "fulfilled" ? fichaRes.value : null;
    const fotos = fotosRes.status === "fulfilled" ? fotosRes.value : null;
    const semResp = avaliacoesRes.status === "fulfilled" ? avaliacoesRes.value : null;
    siteUrl = ficha?.site ?? null;
    google = {
      verificado: ficha?.verificado ?? false,
      site: ficha?.site ?? null,
      categoriaPrincipal: ficha?.categoriaPrincipal ?? null,
      qtdCategoriasSecundarias: ficha?.qtdCategoriasSecundarias ?? 0,
      temDescricao: ficha?.temDescricao ?? false,
      descricaoLen: ficha?.descricaoLen ?? 0,
      temHorario: ficha?.temHorario ?? false,
      fotos: fotos ? `${fotos.quantidade}${fotos.temMais ? "+" : ""}` : "desconhecido",
      impressoes: metricas?.totais.impressoes ?? 0,
      ligacoes: metricas?.totais.ligacoes ?? 0,
      rotas: metricas?.totais.rotas ?? 0,
      cliquesSite: metricas?.totais.cliquesSite ?? 0,
      avaliacoesTotal: semResp?.resumo?.total ?? 0,
      avaliacoesMedia: semResp?.resumo?.media ?? 0,
      avaliacoesSemResposta: semResp ? semResp.avaliacoes.length : 0,
    };
  }

  // SEO do site (buscado pelo runtime do ERP; nunca derruba a análise).
  let seo: ContextoAnalise["seo"] = null;
  let seoPublico: { url: string; palavras: number; pareceSpa: boolean; problemas: string[] } | null = null;
  if (siteUrl) {
    const auditoria = await auditarSite(siteUrl);
    if (auditoria.ok) {
      seo = { problemas: auditoria.problemas, pareceSpa: auditoria.sinais.pareceSpa, palavras: auditoria.sinais.palavras };
      seoPublico = {
        url: auditoria.sinais.url,
        palavras: auditoria.sinais.palavras,
        pareceSpa: auditoria.sinais.pareceSpa,
        problemas: auditoria.problemas,
      };
    }
  }

  // Instagram / TikTok (resumos para o contexto).
  let instagram: ContextoAnalise["instagram"] = null;
  if (idInstagram) {
    try {
      const [tot, seg] = await Promise.all([
        insightsDaRede(chave, { plataforma: "instagram", contaId: idInstagram, de, ate, tipo: "total_value", metricas: "reach,total_interactions" }),
        historicoSeguidoresInstagram(chave, { contaId: idInstagram, de, ate }),
      ]);
      const mt = (tot.metrics ?? {}) as MetricasBrutas;
      const ms = (seg.metrics ?? {}) as MetricasBrutas;
      instagram = { seguidores: totalMetrica(ms, "follower_count"), alcance: totalMetrica(mt, "reach"), interacoes: totalMetrica(mt, "total_interactions") };
    } catch {
      instagram = null;
    }
  }
  let tiktok: ContextoAnalise["tiktok"] = null;
  if (idTiktok) {
    try {
      const resp = await insightsDaRede(chave, {
        plataforma: "tiktok",
        contaId: idTiktok,
        de,
        ate,
        tipo: "time_series",
        metricas: "follower_count,video_views,likes",
      });
      const m = (resp.metrics ?? {}) as MetricasBrutas;
      tiktok = { seguidores: totalMetrica(m, "follower_count"), visualizacoes: totalMetrica(m, "video_views"), curtidas: totalMetrica(m, "likes") };
    } catch {
      tiktok = null;
    }
  }

  const ctx: ContextoAnalise = {
    loja: {
      nome: config?.nomeFantasia?.trim() || "a loja",
      cidade: config?.cidade?.trim() || null,
      segmento: "Assistência técnica de celulares: conserto, troca de tela, bateria, venda de acessórios e películas.",
    },
    google,
    seo,
    instagram,
    tiktok,
  };

  try {
    const resposta = await gerarComIA(montarMensagensAnalise(ctx), { maxTokens: 1500, temperatura: 0.5 });
    const recomendacoes = ordenarPorPrioridade(lerRecomendacoes(resposta));
    if (recomendacoes.length === 0) return { ok: false, erro: "A IA não devolveu recomendações desta vez. Tente de novo." };
    return { ok: true, recomendacoes, seo: seoPublico };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    console.error("[marketing] falha ao gerar análise", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível gerar a análise agora. Tente de novo." };
  }
}

// ── Ações do Perfil do Google (IA sugere, dono aplica) ────────────────────────

export type ResultadoDescricaoGoogle =
  | { ok: true; atual: string | null; sugestao: string; limite: number }
  | { ok: false; erro: string; motivo?: MotivoSemGoogle; configurar?: boolean };

export async function sugerirDescricaoGoogle(): Promise<ResultadoDescricaoGoogle> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) return { ok: false, configurar: true, erro: "A sugestão usa IA. Configure a chave de IA (IA_API_KEY)." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  const config = await contexto.prisma.configuracao.findFirst({ select: { nomeFantasia: true, cidade: true } });

  let atual: string | null = null;
  try {
    const contas = await listarContas(chave);
    const idGoogle = contas.find((c) => c.plataforma === "googlebusiness")?.id;
    if (!idGoogle) return { ok: false, motivo: "SEM_CONTA", erro: "O Perfil do Google ainda não está conectado na Zernio." };
    atual = (await fichaGoogle(chave, idGoogle)).descricao;
  } catch (erro) {
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível ler a ficha do Google agora." };
  }

  const nomeLoja = config?.nomeFantasia?.trim() || "a loja";
  const cidade = config?.cidade?.trim() || null;
  const sistema = [
    `Você escreve a descrição do Perfil da Empresa no Google de ${nomeLoja}, uma assistência técnica de celulares no Brasil${cidade ? ` em ${cidade}` : ""}.`,
    "Escreva em português do Brasil, de forma natural, confiável e amigável, pensando em SEO local.",
    "Regras:",
    `- No máximo ${LIMITE_DESCRICAO_GOOGLE} caracteres.`,
    "- Deixe claro o que a loja faz (conserto de celulares, troca de tela e bateria, acessórios), o diferencial (garantia, agilidade) e a cidade, se houver.",
    "- Sem telefone, preço, link, emojis em excesso, aspas ou colchetes. Não invente serviços.",
    "- Entregue apenas o texto final da descrição, pronto para publicar.",
  ].join("\n");
  const usuario = atual
    ? `Descrição atual (melhore-a, mantendo o que for bom):\n${atual}`
    : "Ainda não há descrição. Escreva uma do zero.";

  try {
    const resposta = await gerarComIA(
      [
        { papel: "system", conteudo: sistema },
        { papel: "user", conteudo: usuario },
      ],
      { maxTokens: 500, temperatura: 0.6 }
    );
    const sugestao = resposta.trim().slice(0, LIMITE_DESCRICAO_GOOGLE);
    if (!sugestao) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, atual, sugestao, limite: LIMITE_DESCRICAO_GOOGLE };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível sugerir agora. Tente de novo." };
  }
}

export async function aplicarDescricaoGoogle(descricao: string): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const texto = String(descricao ?? "").trim();
  if (!texto) return { ok: false, erro: "A descrição está vazia." };
  if (texto.length > LIMITE_DESCRICAO_GOOGLE) return { ok: false, erro: `A descrição pode ter até ${LIMITE_DESCRICAO_GOOGLE} caracteres.` };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    const contas = await listarContas(chave);
    const idGoogle = contas.find((c) => c.plataforma === "googlebusiness")?.id;
    if (!idGoogle) return { ok: false, erro: "O Perfil do Google não está conectado na Zernio." };
    await atualizarDescricaoGoogle(chave, idGoogle, texto);
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:aplicarDescricaoGoogle`), {
      acao: ACOES_AUDITORIA.PUBLICAR_MARKETING,
      entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
      dadosDepois: { acao: "descricao_google", tamanho: texto.length },
    });
    revalidatePath("/marketing/google");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível aplicar no Google agora. Tente de novo." };
  }
}

// ── Postar novidade no Google com IA ──────────────────────────────────────────

const LIMITE_POST_GOOGLE = 1400;

export type ResultadoNovidadeGoogle =
  | { ok: true; sugestao: string; limite: number }
  | { ok: false; erro: string; motivo?: MotivoSemGoogle; configurar?: boolean };

export async function sugerirNovidadeGoogle(tema?: string): Promise<ResultadoNovidadeGoogle> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) return { ok: false, configurar: true, erro: "A sugestão usa IA. Configure a chave de IA (IA_API_KEY)." };

  const config = await contexto.prisma.configuracao.findFirst({ select: { nomeFantasia: true, cidade: true } });
  const nomeLoja = config?.nomeFantasia?.trim() || "a loja";
  const temaLimpo = String(tema ?? "").trim().slice(0, 200);

  const sistema = [
    `Você escreve posts de "novidade" para o Perfil da Empresa no Google de ${nomeLoja}, uma assistência técnica de celulares no Brasil.`,
    "Escreva em português do Brasil, curto e direto, como um aviso ou oferta que aparece no Google.",
    "Regras:",
    `- No máximo ${LIMITE_POST_GOOGLE} caracteres (ideal bem menos, 2 a 4 frases).`,
    "- Pode usar 1 ou 2 emojis. Sem inventar preços, prazos ou serviços que não existem.",
    "- Entregue apenas o texto final, pronto para publicar; sem aspas, títulos nem colchetes.",
  ].join("\n");
  const usuario = temaLimpo ? `Tema da novidade: ${temaLimpo}` : "Escreva uma novidade útil (ex.: serviço em destaque, dica rápida ou chamada para visitar a loja).";

  try {
    const resposta = await gerarComIA(
      [
        { papel: "system", conteudo: sistema },
        { papel: "user", conteudo: usuario },
      ],
      { maxTokens: 400, temperatura: 0.8 }
    );
    const sugestao = resposta.trim().slice(0, LIMITE_POST_GOOGLE);
    if (!sugestao) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, sugestao, limite: LIMITE_POST_GOOGLE };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível sugerir agora. Tente de novo." };
  }
}

export async function publicarNovidadeGoogle(texto: string): Promise<{ ok: boolean; erro?: string; url?: string | null }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const conteudo = String(texto ?? "").trim();
  if (!conteudo) return { ok: false, erro: "Escreva a novidade antes de publicar." };
  if (conteudo.length > LIMITE_POST_GOOGLE) return { ok: false, erro: `A novidade pode ter até ${LIMITE_POST_GOOGLE} caracteres.` };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    const { randomUUID } = await import("node:crypto");
    const contas = await listarContas(chave);
    const idGoogle = contas.find((c) => c.plataforma === "googlebusiness")?.id;
    if (!idGoogle) return { ok: false, erro: "O Perfil do Google não está conectado na Zernio." };

    const resultado = await criarPost(chave, {
      conteudo,
      destinos: [{ plataforma: "googlebusiness", contaId: idGoogle }],
      idempotencia: randomUUID(),
    });
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:publicarNovidadeGoogle`), {
      acao: ACOES_AUDITORIA.PUBLICAR_MARKETING,
      entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
      dadosDepois: { acao: "post_google", zernioPostId: resultado.postId },
    });
    revalidatePath("/marketing/google");
    return { ok: true, url: resultado.porPlataforma.find((p) => p.url)?.url ?? null };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível publicar no Google agora. Tente de novo." };
  }
}

// ── Melhor horário para postar ────────────────────────────────────────────────

export type ResultadoMelhorHorario = { ok: true; slots: HorarioSlot[] } | { ok: false; motivo: MotivoSemGoogle; erro: string };

export async function obterMelhorHorario(plataforma: "INSTAGRAM" | "TIKTOK"): Promise<ResultadoMelhorHorario> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  const idZernio = plataforma === "INSTAGRAM" ? "instagram" : "tiktok";
  try {
    const contas = await listarContas(chave);
    const contaId = contas.find((c) => c.plataforma === idZernio)?.id;
    if (!contaId) return { ok: false, motivo: "SEM_CONTA", erro: "Conta não conectada na Zernio." };
    return { ok: true, slots: await melhorHorario(chave, contaId) };
  } catch (erro) {
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível obter o melhor horário agora." };
  }
}

// ── Caixa de entrada (mensagens diretas) ──────────────────────────────────────

export type ResultadoConversas =
  | { ok: true; conversas: ConversaZernio[]; proximoCursor: string | null }
  | { ok: false; motivo: MotivoSemGoogle; erro: string };

export async function obterConversas(cursor?: string | null): Promise<ResultadoConversas> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  try {
    const { conversas, proximoCursor } = await listarConversas(chave, { cursor, limite: 20 });
    return { ok: true, conversas, proximoCursor };
  } catch (erro) {
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível carregar as conversas agora." };
  }
}

export async function obterMensagens(conversaId: string, contaId: string): Promise<{ ok: true; mensagens: MensagemDireta[] } | { ok: false; erro: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  if (!conversaId || !contaId) return { ok: false, erro: "Conversa inválida." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    const mensagens = await listarMensagens(chave, { conversaId, contaId, limite: 30 });
    return { ok: true, mensagens };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível carregar a conversa agora." };
  }
}

export async function responderMensagem(conversaId: string, contaId: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const mensagem = String(texto ?? "").trim();
  if (!mensagem) return { ok: false, erro: "Escreva a mensagem." };
  if (mensagem.length > 2000) return { ok: false, erro: "A mensagem é longa demais." };
  if (!conversaId || !contaId) return { ok: false, erro: "Conversa inválida." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    await enviarMensagem(chave, { conversaId, contaId, texto: mensagem });
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:responderMensagem`), {
      acao: ACOES_AUDITORIA.PUBLICAR_MARKETING,
      entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
      entidadeId: conversaId,
      dadosDepois: { acao: "dm" },
    });
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível enviar agora. Tente de novo." };
  }
}

export async function sugerirRespostaMensagem(conversaId: string, contaId: string): Promise<ResultadoSugestao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) return { ok: false, configurar: true, erro: "O gerador por IA não está ligado. Configure a chave de IA (IA_API_KEY)." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  let mensagens: MensagemDireta[];
  try {
    mensagens = await listarMensagens(chave, { conversaId, contaId, limite: 12 });
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível ler a conversa agora." };
  }
  if (mensagens.length === 0) return { ok: false, erro: "Sem mensagens para responder." };

  const config = await contexto.prisma.configuracao.findFirst({ select: { nomeFantasia: true } });
  const nomeLoja = config?.nomeFantasia?.trim() || "a loja";

  const sistema = [
    `Você atende os clientes de ${nomeLoja}, uma assistência técnica de celulares no Brasil, pelo direct/DM.`,
    "Escreva a PRÓXIMA mensagem da loja em português do Brasil, curta, educada e prestativa.",
    "Regras:",
    "- Responda ao que o cliente perguntou; se faltar informação (modelo do aparelho, problema), pergunte de forma gentil.",
    "- Nunca invente preços, prazos ou garantias; se perguntarem preço sem dados, peça o modelo/defeito ou convide a passar na loja.",
    "- Sem colchetes, sem assinatura, sem título; entregue só o texto da mensagem.",
  ].join("\n");
  const historico = mensagens
    .map((m) => `${m.entrada ? "Cliente" : "Loja"}: ${m.texto || "[anexo]"}`)
    .join("\n");
  const usuario = `Conversa até aqui:\n${historico}\n\nEscreva a próxima mensagem da loja.`;

  try {
    const resposta = await gerarComIA(
      [
        { papel: "system", conteudo: sistema },
        { papel: "user", conteudo: usuario },
      ],
      { maxTokens: 300, temperatura: 0.6 }
    );
    const sugestao = resposta.trim();
    if (!sugestao) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, sugestao };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível sugerir agora. Tente de novo." };
  }
}

// ── Adicionar foto à ficha do Google ──────────────────────────────────────────

export async function enviarFotoGoogle(dados: FormData): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { ehTipoDeImagemAceito, TAMANHO_MAXIMO_DA_FOTO_EM_BYTES, conteudoConfereComOTipo } = await import("@/lib/dominio/os/fotos");

  const arquivo = dados.get("arquivo");
  const categoriaBruta = String(dados.get("categoria") ?? "ADDITIONAL");
  const categoria = (CATEGORIAS_FOTO_GOOGLE as readonly string[]).includes(categoriaBruta)
    ? (categoriaBruta as (typeof CATEGORIAS_FOTO_GOOGLE)[number])
    : "ADDITIONAL";

  if (!(arquivo instanceof File)) return { ok: false, erro: "Nenhuma imagem foi recebida." };
  if (!ehTipoDeImagemAceito(arquivo.type)) return { ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." };
  if (arquivo.size > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) return { ok: false, erro: "A imagem é grande demais." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (!conteudoConfereComOTipo(bytes, arquivo.type)) return { ok: false, erro: "Esse arquivo não é uma imagem válida." };

    const contas = await listarContas(chave);
    const idGoogle = contas.find((c) => c.plataforma === "googlebusiness")?.id;
    if (!idGoogle) return { ok: false, erro: "O Perfil do Google não está conectado na Zernio." };

    const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const publicUrl = await subirMidia(chave, { nome: `foto-google.${extensao}`, tipoConteudo: arquivo.type, bytes });
    await adicionarFotoGoogle(chave, idGoogle, { sourceUrl: publicUrl, categoria });

    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:enviarFotoGoogle`), {
      acao: ACOES_AUDITORIA.PUBLICAR_MARKETING,
      entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
      dadosDepois: { acao: "foto_google", categoria },
    });
    revalidatePath("/marketing/google");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível enviar a foto agora. Tente de novo." };
  }
}

export type FiltroAvaliacoes = "TODAS" | "SEM_RESPOSTA" | "BAIXAS";

export type ResultadoAvaliacoes =
  | { ok: true; conta: string; avaliacoes: AvaliacaoZernio[]; resumo: ResumoAvaliacoes | null; proximoCursor: string | null }
  | { ok: false; motivo: MotivoSemGoogle; erro: string };

export async function obterAvaliacoesGoogle(filtro: FiltroAvaliacoes = "TODAS", cursor?: string | null): Promise<ResultadoAvaliacoes> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  try {
    const contaId = await contaGoogleId(chave);
    if (!contaId) return { ok: false, motivo: "SEM_CONTA", erro: "O Perfil do Google ainda não está conectado na Zernio." };
    const pagina = await listarAvaliacoes(chave, {
      contaId,
      apenasSemResposta: filtro === "SEM_RESPOSTA",
      notaMax: filtro === "BAIXAS" ? 3 : undefined,
      limite: 15,
      cursor: cursor ?? undefined,
    });
    return { ok: true, conta: contaId, avaliacoes: pagina.avaliacoes, resumo: pagina.resumo, proximoCursor: pagina.proximoCursor };
  } catch (erro) {
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível carregar as avaliações agora." };
  }
}

export async function responderAvaliacaoGoogle(reviewId: string, contaId: string, mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const texto = String(mensagem ?? "").trim();
  if (!texto) return { ok: false, erro: "Escreva a resposta." };
  if (texto.length > 4000) return { ok: false, erro: "A resposta é longa demais (máx. 4000 caracteres)." };
  if (!reviewId || !contaId) return { ok: false, erro: "Avaliação inválida." };

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, erro: "Conecte a Zernio primeiro." };

  try {
    await responderAvaliacaoZernio(chave, { reviewId, contaId, mensagem: texto });
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:responderAvaliacaoGoogle`), {
      acao: ACOES_AUDITORIA.RESPONDER_AVALIACAO_GOOGLE,
      entidade: ENTIDADES_AUDITORIA.INTEGRACAO_MARKETING,
      entidadeId: reviewId,
    });
    revalidatePath("/marketing/google");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroZernio ? erro.message : "Não foi possível responder agora. Tente de novo." };
  }
}

export type ResultadoSugestao = { ok: true; sugestao: string } | { ok: false; erro: string; configurar?: boolean };

// Monta as mensagens (system/user) que pedem à IA a resposta de UMA avaliação,
// no tom da loja. Pura: reusada pela sugestão avulsa e pela preparação em lote.
function montarMensagensRespostaAvaliacao(
  nomeLoja: string,
  entrada: { autor: string; nota: number; texto: string }
): Array<{ papel: "system" | "user"; conteudo: string }> {
  const autor = String(entrada.autor ?? "").trim() || "cliente";
  const nota = Math.max(0, Math.min(5, Number(entrada.nota) || 0));
  const texto = String(entrada.texto ?? "").trim();

  const sistema = [
    `Você responde avaliações do Google em nome de ${nomeLoja}, uma assistência técnica de celulares no Brasil.`,
    "Escreve em português do Brasil, em primeira pessoa do plural (nós), de forma calorosa, educada e breve: 2 a 3 frases, no máximo 400 caracteres.",
    "Regras:",
    "- Agradeça pelo nome quando houver nome.",
    "- Para avaliações positivas: agradeça com simpatia e convide a voltar.",
    "- Para avaliações críticas (nota baixa): peça desculpas com empatia, sem discutir, e convide a resolver pelo WhatsApp ou na loja.",
    "- Nunca invente detalhes, nomes de funcionários, descontos ou promessas que não foram ditos.",
    "- Não use colchetes nem campos para preencher; entregue a resposta final, pronta para publicar.",
  ].join("\n");

  const usuario = [
    `Avaliação de ${autor} — ${nota} de 5 estrelas:`,
    texto || "(sem texto, apenas a nota)",
    "",
    "Escreva apenas a resposta da loja.",
  ].join("\n");

  return [
    { papel: "system", conteudo: sistema },
    { papel: "user", conteudo: usuario },
  ];
}

async function nomeDaLoja(prisma: ContextoTenantServidor["prisma"]): Promise<string> {
  const config = await prisma.configuracao.findFirst({ select: { nomeFantasia: true } });
  return config?.nomeFantasia?.trim() || "a loja";
}

/** Sugere uma resposta para a avaliação, no tom da loja, com IA. */
export async function sugerirRespostaAvaliacao(entrada: { autor: string; nota: number; texto: string }): Promise<ResultadoSugestao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) {
    return { ok: false, configurar: true, erro: "O gerador por IA não está ligado. Configure a chave de IA (IA_API_KEY)." };
  }

  const nomeLoja = await nomeDaLoja(contexto.prisma);

  try {
    const resposta = await gerarComIA(montarMensagensRespostaAvaliacao(nomeLoja, entrada), { maxTokens: 300, temperatura: 0.7 });
    const sugestao = resposta.trim();
    if (!sugestao) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, sugestao };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    console.error("[marketing] falha ao sugerir resposta", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível sugerir agora. Tente de novo." };
  }
}

export type RascunhoAvaliacao = {
  id: string;
  contaId: string;
  autor: string;
  fotoAutor: string | null;
  nota: number;
  texto: string;
  criadoEm: string;
  sugestao: string;
};

export type ResultadoPendentes =
  | { ok: true; itens: RascunhoAvaliacao[] }
  | { ok: false; erro: string; configurar?: boolean; motivo?: MotivoSemGoogle };

// Quantas avaliações sem resposta preparamos de uma vez. Cada uma é uma
// chamada de IA; mais que isso deixa o dono esperando demais numa requisição só.
const LIMITE_PREPARAR_LOTE = 6;

/**
 * Carrega as avaliações do Google ainda sem resposta e já gera, para cada uma,
 * um rascunho de resposta com IA. O dono revisa/edita e envia (uma a uma ou
 * todas) — nada é publicado aqui.
 */
export async function prepararRespostasPendentes(): Promise<ResultadoPendentes> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { iaConfigurada, gerarComIA } = await import("@/lib/ia/cliente");
  if (!iaConfigurada()) {
    return { ok: false, configurar: true, erro: "O gerador por IA não está ligado. Configure a chave de IA (IA_API_KEY)." };
  }

  const chave = await lerChaveZernio(contexto.prisma, contexto.empresaId);
  if (!chave) return { ok: false, motivo: "SEM_CHAVE", erro: "Conecte a Zernio em Marketing → Conexões." };

  try {
    const contaId = await contaGoogleId(chave);
    if (!contaId) return { ok: false, motivo: "SEM_CONTA", erro: "O Perfil do Google ainda não está conectado na Zernio." };

    const pagina = await listarAvaliacoes(chave, { contaId, apenasSemResposta: true, limite: LIMITE_PREPARAR_LOTE });
    if (pagina.avaliacoes.length === 0) return { ok: true, itens: [] };

    const nomeLoja = await nomeDaLoja(contexto.prisma);

    const itens: RascunhoAvaliacao[] = [];
    for (const a of pagina.avaliacoes) {
      let sugestao = "";
      try {
        const resposta = await gerarComIA(montarMensagensRespostaAvaliacao(nomeLoja, { autor: a.autor, nota: a.nota, texto: a.texto }), {
          maxTokens: 300,
          temperatura: 0.7,
        });
        sugestao = resposta.trim();
      } catch (erro) {
        // Uma falha de IA numa avaliação não derruba o lote: o dono recebe o
        // rascunho vazio e escreve/tenta de novo só nessa.
        console.error("[marketing] falha ao preparar resposta em lote", erro instanceof Error ? erro.message : erro);
      }
      itens.push({
        id: a.id,
        contaId: a.contaId,
        autor: a.autor,
        fotoAutor: a.fotoAutor,
        nota: a.nota,
        texto: a.texto,
        criadoEm: a.criadoEm,
        sugestao,
      });
    }

    return { ok: true, itens };
  } catch (erro) {
    return { ok: false, motivo: "ERRO", erro: erro instanceof ErroZernio ? erro.message : "Não foi possível carregar as avaliações agora." };
  }
}
