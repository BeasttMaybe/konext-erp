"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrdemServico, SituacaoOS } from "@/types/os";
import { ROTULOS_SITUACAO_OS } from "@/lib/dominio/os/maquina-estados";
import { SITUACOES_VALIDAS_POR_ETAPA } from "@/lib/dominio/os/etapas";
import { Card } from "@/components/ui/card";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Smartphone,
  DollarSign,
  Clock,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  PackageCheck,
  RotateCcw,
  Archive,
  MoreVertical,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResumoTecnicosOS, iniciais } from "./resumo-tecnicos-os";
import { ModalTecnicosOS } from "./modal-tecnicos-os";

/** Acima disso, o tempo na etapa vira --kx-alerta — mesmo limiar de "parado" do dashboard (app/actions/dashboard.ts). */
const DIAS_LIMITE_ETAPA = 7;

function diasDesde(dataISO: string): number {
  const diffMs = Date.now() - new Date(dataISO).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

interface CartaoOSProps {
  os: OrdemServico;
  onClick?: () => void;
  isDragging?: boolean;
  onMoverAnterior?: () => void;
  onMoverProxima?: () => void;
  onFinalizar?: () => void;
  podeFinalizar?: boolean;
  textoBotaoFinalizar?: string;
  desabilitarMoverAnterior?: boolean;
  desabilitarMoverProxima?: boolean;
  /** Some o botao "Anterior" de vez (nao so desabilitado) — caso da OS ENTREGUE, que so sai pelo "Reabrir OS". */
  esconderMoverAnterior?: boolean;
  /** Abre o dialogo de entrega (finalizacao). Ausente em OS ja entregue. */
  onEntregar?: () => void;
  /** Abre o dialogo de reabertura. Presente so em OS entregue e para ADMIN/GESTOR. */
  onReabrir?: () => void;
  /** Completa o resgate (arquivar + garantia pendente) de uma OS ja ENTREGUE sem archivedAt. */
  onArquivar?: () => void;
  /** Linha curta explicando por que o cartao esta num estado incomum, ex.: "Entregue, falta arquivar". */
  estadoExplicacao?: string;
  /** Marca/limpa a situacao sem mover o card de coluna (Fase 1C-3, Parte 4). Ausente esconde o menu. */
  onAlterarSituacao?: (situacao: SituacaoOS | null) => void;
  /** Permissao os.editar do usuario logado — controla so a acao rapida "Técnicos..." (Fase 1D-2). Ausente esconde a opção, nunca desabilita. */
  podeEditarTecnicos?: boolean;
}

export function CartaoOS({
  os,
  onClick,
  isDragging = false,
  onMoverAnterior,
  onMoverProxima,
  onFinalizar,
  podeFinalizar = false,
  textoBotaoFinalizar = "Finalizar OS",
  desabilitarMoverAnterior = false,
  desabilitarMoverProxima = false,
  esconderMoverAnterior = false,
  onEntregar,
  onReabrir,
  onArquivar,
  estadoExplicacao,
  onAlterarSituacao,
  podeEditarTecnicos = false,
}: CartaoOSProps) {
  const router = useRouter();
  const [modalTecnicosAberto, setModalTecnicosAberto] = useState(false);
  const situacoesDisponiveis = SITUACOES_VALIDAS_POR_ETAPA[os.etapa];
  const mostrarMenu = Boolean(onAlterarSituacao && situacoesDisponiveis.length > 0) || podeEditarTecnicos;
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (dataISO: string) => {
    return new Date(dataISO).toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    });
  };

  // "Tempo na etapa": proxy de dataAtualizacao, o unico carimbo de tempo que a
  // OS tem hoje — nao e literalmente "desde que entrou nesta etapa" (qualquer
  // edicao toca esse campo), mas e o melhor sinal disponivel sem mudar o schema.
  // Confirmado pelo dono (Fase 3-2B): aproximacao aceita por enquanto — uma
  // fase futura adiciona um carimbo de "entrou nesta etapa em".
  const diasNaEtapa = diasDesde(os.dataAtualizacao);
  const etapaEmAlerta = diasNaEtapa >= DIAS_LIMITE_ETAPA;

  return (
    <Card
      className={`group p-4 cursor-pointer transition-all duration-200 border border-border bg-background/90 ${
        isDragging
          ? "rotate-1 scale-[1.01] shadow-2xl ring-2 ring-primary/30"
          : "hover:shadow-md hover:-translate-y-0.5"
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header: Order Number & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-kx-legenda" />
            <h3 className="text-sm font-bold text-kx-texto transition-colors group-hover:text-kx-link">
              {os.numeroOS}
            </h3>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {os.situacao ? (
              <PilulaStatus variante="alerta" className="whitespace-nowrap">
                {ROTULOS_SITUACAO_OS[os.situacao]}
              </PilulaStatus>
            ) : null}
            {os.entregueSemServico ? (
              <PilulaStatus variante="neutro" className="whitespace-nowrap" title={os.motivoSemServico}>
                Sem serviço
              </PilulaStatus>
            ) : null}
            {mostrarMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Mais ações</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  {onAlterarSituacao && situacoesDisponiveis.length > 0 && (
                    <>
                      {situacoesDisponiveis.map((situacao) => (
                        <DropdownMenuItem
                          key={situacao}
                          disabled={os.situacao === situacao}
                          onClick={() => onAlterarSituacao(situacao)}
                        >
                          Marcar {ROTULOS_SITUACAO_OS[situacao].toLowerCase()}
                        </DropdownMenuItem>
                      ))}
                      {os.situacao ? (
                        <DropdownMenuItem onClick={() => onAlterarSituacao(null)}>
                          Limpar situação
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  )}
                  {podeEditarTecnicos && (
                    <>
                      {onAlterarSituacao && situacoesDisponiveis.length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem onClick={() => setModalTecnicosAberto(true)}>
                        <Users className="mr-2 h-4 w-4" />
                        Técnicos...
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {os.tecnicos.length > 0 && (
          <ResumoTecnicosOS tecnicos={os.tecnicos} className="justify-end" />
        )}

        {/* Client */}
        <div className="text-sm border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground font-medium mb-1">Cliente</p>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
              aria-hidden="true"
            >
              {iniciais(os.nomeCliente)}
            </span>
            <p className="font-medium text-foreground truncate">{os.nomeCliente}</p>
          </div>
          {os.ehRetornoGarantia && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PilulaStatus variante="garantia">Garantia</PilulaStatus>
              {os.retornoGarantiaFinalizadoEm && (
                <PilulaStatus variante="sucesso">Retorno finalizado</PilulaStatus>
              )}
              {os.numeroOSOrigemGarantia && (
                <span className="text-xs text-muted-foreground">Origem: {os.numeroOSOrigemGarantia}</span>
              )}
            </div>
          )}
        </div>

        {/* Equipment */}
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Equipamento</p>
            <p className="font-medium text-foreground truncate">
              {os.equipamento}
            </p>
            {os.marca && (
              <p className="text-xs text-muted-foreground truncate">{os.marca}</p>
            )}
            {os.ehRetornoGarantia && os.observacoesInternas && (
              <p className="text-xs text-muted-foreground truncate" title={os.observacoesInternas}>
                {os.observacoesInternas}
              </p>
            )}
          </div>
        </div>

        {/* Budget Value - If Available */}
        {os.totalOrcamento > 0 && (
          <div className="flex items-center justify-between p-2 rounded border border-kx-sucesso/30 bg-kx-sucesso-fundo">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-kx-sucesso-texto" />
              <div>
                <p className="text-xs text-kx-sucesso-texto font-medium">Orçamento</p>
                <p className="font-bold text-kx-sucesso-texto text-sm">
                  {formatarMoeda(os.totalOrcamento)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer: tempo na etapa */}
        <div
          className={`flex items-center gap-2 text-xs pt-2 border-t border-border/60 ${
            etapaEmAlerta ? "font-medium text-kx-alerta" : "text-muted-foreground"
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>{formatarData(os.dataAtualizacao)}</span>
          <span aria-hidden="true">·</span>
          <span>{diasNaEtapa === 0 ? "hoje" : diasNaEtapa === 1 ? "1 dia nesta etapa" : `${diasNaEtapa} dias nesta etapa`}</span>
        </div>

        {/* Ações rápidas de movimentação */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onMoverAnterior?.();
            }}
            disabled={desabilitarMoverAnterior}
            hidden={esconderMoverAnterior}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              if (podeFinalizar) {
                onFinalizar?.();
                return;
              }

              onMoverProxima?.();
            }}
            disabled={podeFinalizar ? !onFinalizar : desabilitarMoverProxima}
            hidden={!podeFinalizar && desabilitarMoverProxima}
          >
            {podeFinalizar ? textoBotaoFinalizar : "Proxima"}
            {!podeFinalizar && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {estadoExplicacao ? (
          <p className="text-xs font-medium text-kx-alerta">{estadoExplicacao}</p>
        ) : null}

        {onArquivar ? (
          <Button
            type="button"
            size="sm"
            className="w-full border border-kx-alerta/40 bg-kx-alerta-fundo text-kx-alerta-texto hover:opacity-90"
            onClick={(event) => {
              event.stopPropagation();
              onArquivar();
            }}
          >
            <Archive className="mr-2 h-4 w-4" />
            Arquivar OS
          </Button>
        ) : null}

        {onEntregar ? (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onEntregar();
            }}
          >
            <PackageCheck className="mr-2 h-4 w-4" />
            Entregar e finalizar
          </Button>
        ) : null}

        {onReabrir ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onReabrir();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reabrir OS
          </Button>
        ) : null}
      </div>

      {podeEditarTecnicos && (
        <ModalTecnicosOS
          key={modalTecnicosAberto ? `aberto-${os.id}` : `fechado-${os.id}`}
          aberta={modalTecnicosAberto}
          onAbrirMudar={setModalTecnicosAberto}
          osId={os.id}
          numeroOs={os.numeroOS}
          tecnicosAtuais={os.tecnicos}
          onSalvo={() => router.refresh()}
        />
      )}
    </Card>
  );
}
