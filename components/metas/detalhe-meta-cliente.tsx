"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  TrendingUp,
  Pause,
  CheckCircle,
  XCircle,
  Trash2,
  MessageSquarePlus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BadgeStatusMeta } from "@/components/metas/badge-status-meta";
import { BadgePrioridadeMeta } from "@/components/metas/badge-prioridade-meta";
import { BarraProgressoMeta } from "@/components/metas/barra-progresso-meta";
import { ChecklistMeta } from "@/components/metas/checklist-meta";
import { HistoricoMeta } from "@/components/metas/historico-meta";
import { ModalAtualizarProgresso } from "@/components/metas/modal-atualizar-progresso";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import {
  alterarStatusMeta,
  adicionarHistoricoMeta,
  excluirMeta,
  sincronizarMetaAutomatica,
  type DetalhesMeta,
} from "@/app/actions/metas";
import { diferencaEntreDatasDeCalendario, FUSO_HORARIO_PADRAO, hojeComoDataDeCalendario } from "@/lib/datas";

const labelCategoria: Record<string, string> = {
  FINANCEIRA: "Financeira",
  OPERACIONAL: "Operacional",
  COMERCIAL: "Comercial",
  ESTOQUE: "Estoque",
  ESTRUTURAL: "Estrutural",
  EQUIPAMENTO: "Equipamento",
  REFORMA: "Reforma",
  OUTRA: "Outra",
};

const labelTipoValor: Record<string, string> = {
  DINHEIRO: "Financeiro (R$)",
  QUANTIDADE: "Quantidade",
  PERCENTUAL: "Percentual (%)",
  CHECKLIST: "Checklist",
};

function formatarMoeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function diasRestantes(iso: string): { dias: number; atrasada: boolean } {
  // Mesma convenção de card-meta.tsx: dataPrazo é DATA DE CALENDÁRIO
  // (meia-noite UTC) — nunca setHours(0) local do navegador.
  const prazo = new Date(iso);
  const hoje = hojeComoDataDeCalendario(FUSO_HORARIO_PADRAO);
  const diff = diferencaEntreDatasDeCalendario(hoje, prazo);
  return { dias: Math.abs(diff), atrasada: diff < 0 };
}

function formatarValor(meta: DetalhesMeta): string {
  if (meta.tipoValor === "CHECKLIST") {
    return `${meta.itensConcluidos} / ${meta.totalItensChecklist} itens`;
  }
  const u = meta.unidade ?? (meta.tipoValor === "PERCENTUAL" ? "%" : "");
  if (meta.tipoValor === "DINHEIRO") {
    return `${formatarMoeda(meta.valorAtual)} / ${meta.valorAlvo ? formatarMoeda(meta.valorAlvo) : "—"}`;
  }
  return `${meta.valorAtual}${u} / ${meta.valorAlvo ?? "—"}${u}`;
}

type DetalheMetaClienteProps = {
  meta: DetalhesMeta;
};

export function DetalheMetaCliente({ meta: metaInicial }: DetalheMetaClienteProps) {
  const router = useRouter();
  const meta = metaInicial;
  const [modalProgressoAberto, setModalProgressoAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [novaObs, setNovaObs] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [sincronizandoAutomatica, setSincronizandoAutomatica] = useState(false);

  const temPermissaoEditarMeta = useTemPermissao("metas.editar");
  const temPermissaoExcluirMeta = useTemPermissao("metas.excluir");
  const prazoInfo = meta.dataPrazo ? diasRestantes(meta.dataPrazo) : null;
  const podeConcluir = temPermissaoEditarMeta && meta.status !== "CONCLUIDA" && meta.status !== "CANCELADA";
  const podePausar =
    temPermissaoEditarMeta &&
    (meta.status === "EM_ANDAMENTO" || meta.status === "ATENCAO" || meta.status === "ATRASADA");
  const podeReabrir = temPermissaoEditarMeta && (meta.status === "PAUSADA" || meta.status === "CONCLUIDA");
  const podeCancelar = temPermissaoEditarMeta && meta.status !== "CANCELADA";
  const ehMetaAutomatica = meta.origemProgresso === "AUTOMATICA";
  const podeAtualizar =
    temPermissaoEditarMeta &&
    !ehMetaAutomatica &&
    meta.status !== "CONCLUIDA" &&
    meta.status !== "CANCELADA" &&
    meta.tipoValor !== "CHECKLIST";

  const alterarStatus = async (status: "CONCLUIDA" |"PAUSADA" |"CANCELADA" |"EM_ANDAMENTO") => {
    setProcessando(true);
    try {
      const res = await alterarStatusMeta({ id: meta.id, status });
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem);
      router.refresh();
    } catch {
      toast.error("Erro ao alterar status.");
    } finally {
      setProcessando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirm(`Deseja excluir a meta"${meta.titulo}"? Esta ação não pode ser desfeita.`)) return;
    setProcessando(true);
    try {
      const res = await excluirMeta(meta.id);
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem);
      router.push("/metas");
    } catch {
      toast.error("Erro ao excluir meta.");
    } finally {
      setProcessando(false);
    }
  };

  const salvarObservacao = async () => {
    const texto = novaObs.trim();
    if (texto.length < 2) {
      toast.error("Observação muito curta.");
      return;
    }
    setSalvandoObs(true);
    try {
      const res = await adicionarHistoricoMeta(meta.id, texto);
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem);
      setNovaObs("");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar observação.");
    } finally {
      setSalvandoObs(false);
    }
  };

  const sincronizarAutomaticamente = async () => {
    setSincronizandoAutomatica(true);
    try {
      const res = await sincronizarMetaAutomatica(meta.id);
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }

      toast.success(res.mensagem);
      router.refresh();
    } catch {
      toast.error("Erro ao sincronizar meta automática.");
    } finally {
      setSincronizandoAutomatica(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/metas"
            className="inline-flex items-center text-sm text-kx-legenda hover:text-kx-texto dark:hover:text-kx-texto-2 mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para metas
          </Link>
          <h1 className="text-2xl font-bold text-kx-texto">{meta.titulo}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-kx-legenda bg-kx-superficie px-2 py-0.5 rounded">
              {labelCategoria[meta.categoria] ?? meta.categoria}
            </span>
            <span className="text-xs text-kx-legenda bg-kx-superficie px-2 py-0.5 rounded">
              {labelTipoValor[meta.tipoValor] ?? meta.tipoValor}
            </span>
            <Badge variant="outline" className="text-xs">
              {ehMetaAutomatica ? "Automática" : "Manual"}
            </Badge>
            <BadgeStatusMeta status={meta.status} />
            <BadgePrioridadeMeta prioridade={meta.prioridade} />
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {podeAtualizar && (
            <Button size="sm" onClick={() => setModalProgressoAberto(true)} disabled={processando}>
              <TrendingUp className="h-4 w-4 mr-1" />
              Atualizar progresso
            </Button>
          )}
          {ehMetaAutomatica && temPermissaoEditarMeta && (
            <Button
              size="sm"
              onClick={sincronizarAutomaticamente}
              disabled={sincronizandoAutomatica || processando}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              {sincronizandoAutomatica ? "Atualizando..." : "Atualizar agora"}
            </Button>
          )}
          {podePausar && (
            <Button size="sm" variant="outline" onClick={() => alterarStatus("PAUSADA")} disabled={processando}>
              <Pause className="h-4 w-4 mr-1" />
              Pausar
            </Button>
          )}
          {podeReabrir && (
            <Button size="sm" variant="outline" onClick={() => alterarStatus("EM_ANDAMENTO")} disabled={processando}>
              Reabrir
            </Button>
          )}
          {podeConcluir && (
            <Button
              size="sm"
              variant="outline"
              className="border-kx-sucesso text-kx-sucesso hover:bg-kx-sucesso-fundo dark:hover:bg-kx-sucesso-fundo"
              onClick={() => alterarStatus("CONCLUIDA")}
              disabled={processando}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Concluir
            </Button>
          )}
          {podeCancelar && (
            <Button
              size="sm"
              variant="outline"
              className="border-kx-erro-borda text-kx-erro-texto hover:bg-kx-erro-fundo dark:hover:bg-kx-erro-fundo"
              onClick={() => alterarStatus("CANCELADA")}
              disabled={processando}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          )}
          {temPermissaoExcluirMeta && (
            <Button size="sm" variant="ghost" className="text-kx-erro-texto hover:text-kx-erro-texto" onClick={handleExcluir} disabled={processando}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progresso e detalhes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 p-5 border border-kx-painel-borda bg-kx-painel space-y-4">
          <div>
            <p className="text-sm text-kx-legenda mb-2">Progresso</p>
            <BarraProgressoMeta progresso={meta.progresso} status={meta.status} showLabel />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-kx-legenda">Valor atual</p>
              <p className="font-semibold text-kx-texto mt-0.5">{formatarValor(meta)}</p>
            </div>
            {meta.dataPrazo && (
              <div>
                <p className="text-kx-legenda">Prazo</p>
                <p className={`font-semibold mt-0.5 ${prazoInfo?.atrasada ? "text-kx-erro-texto" : "text-kx-texto"}`}>
                  {formatarData(meta.dataPrazo)}
                  {prazoInfo && (
                    <span className="ml-1 text-xs font-normal">
                      ({prazoInfo.atrasada ? `-${prazoInfo.dias}d` : `+${prazoInfo.dias}d`})
                    </span>
                  )}
                </p>
              </div>
            )}
            {meta.dataInicio && (
              <div>
                <p className="text-kx-legenda">Início</p>
                <p className="font-semibold text-kx-texto mt-0.5">{formatarData(meta.dataInicio)}</p>
              </div>
            )}
            {meta.concluidaEm && (
              <div>
                <p className="text-kx-legenda">Concluída em</p>
                <p className="font-semibold text-kx-sucesso mt-0.5">{formatarData(meta.concluidaEm)}</p>
              </div>
            )}
          </div>

          {meta.descricao && (
            <div>
              <p className="text-xs text-kx-legenda mb-1">Descrição</p>
              <p className="text-sm text-kx-texto whitespace-pre-wrap">{meta.descricao}</p>
            </div>
          )}

          {ehMetaAutomatica && (
            <div className="rounded-md border border-kx-info bg-kx-info-fundo p-3 space-y-2">
              <p className="text-xs font-semibold text-kx-info-texto">Configuração automática</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-kx-texto-2">
                <p>Fonte: {meta.fonteAutomatica ?? "—"}</p>
                <p>Métrica: {meta.metricaAutomatica ?? "—"}</p>
                <p>Direção: {meta.direcao === "MENOR_MELHOR" ? "Quanto menor, melhor" : "Quanto maior, melhor"}</p>
                <p>Última atualização: {meta.ultimaSincronizacaoEm ? formatarData(meta.ultimaSincronizacaoEm) : "Nunca"}</p>
              </div>
              {meta.erroSincronizacao && (
                <p className="text-xs text-kx-erro-texto">
                  Erro de sincronização: {meta.erroSincronizacao}
                </p>
              )}
              {meta.direcao === "MENOR_MELHOR" && meta.valorAlvo !== null && (
                <p className="text-xs text-kx-texto-2">
                  {meta.estaDentroMeta
                    ? `Dentro da meta. Limite: ${meta.valorAlvo}. Valor atual: ${meta.valorAtual}.`
                    : `Acima da meta. Limite: ${meta.valorAlvo}. Valor atual: ${meta.valorAtual}.`}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Adicionar observação */}
        <Card className="p-4 border border-kx-painel-borda bg-kx-painel space-y-3">
          <p className="text-sm font-semibold text-kx-texto">Adicionar observação</p>
          <div className="space-y-2">
            <Label htmlFor="obs-nova" className="sr-only">Observação</Label>
            <Textarea
              id="obs-nova"
              value={novaObs}
              onChange={(e) => setNovaObs(e.target.value)}
              placeholder="Registre uma anotação, decisão ou contexto..."
              maxLength={500}
              className="resize-none h-24 text-sm"
              disabled={salvandoObs}
            />
            <p className="text-xs text-kx-legenda">{novaObs.length}/500</p>
            <Button
              size="sm"
              className="w-full"
              onClick={salvarObservacao}
              disabled={salvandoObs || novaObs.trim().length < 2}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
              Registrar
            </Button>
          </div>
        </Card>
      </div>

      {/* Checklist */}
      {meta.tipoValor === "CHECKLIST" && (
        <Card className="p-5 border border-kx-painel-borda bg-kx-painel">
          <ChecklistMeta
            metaId={meta.id}
            itens={meta.itensChecklist}
            somenteLeitura={meta.status === "CANCELADA"}
            aoAtualizar={() => router.refresh()}
          />
        </Card>
      )}

      {/* Histórico */}
      <Card className="p-5 border border-kx-painel-borda bg-kx-painel">
        <h2 className="text-sm font-semibold text-kx-texto mb-4">Histórico</h2>
        <HistoricoMeta entradas={meta.historicos} />
      </Card>

      {/* Modal de progresso */}
      <ModalAtualizarProgresso
        aberto={modalProgressoAberto}
        metaId={meta.id}
        titulo={meta.titulo}
        valorAtual={meta.valorAtual}
        valorAlvo={meta.valorAlvo}
        tipoValor={meta.tipoValor}
        unidade={meta.unidade}
        origemProgresso={meta.origemProgresso}
        aoFechar={() => setModalProgressoAberto(false)}
        aoConcluir={() => {
          setModalProgressoAberto(false);
          router.refresh();
        }}
      />
    </div>
  );
}
