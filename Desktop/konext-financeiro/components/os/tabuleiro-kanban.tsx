"use client";

import { useMemo, useOptimistic, useState, useTransition, type CSSProperties } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { OrdemServico, StatusOS } from "@/types/os";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartaoOS } from "./cartao-os";

interface TabuleiroKanbanProps {
  ordensServico: OrdemServico[];
  onCartaoClick?: (os: OrdemServico) => void;
  onMoverOS?: (osId: string, novoStatus: StatusOS) => Promise<boolean>;
  onFinalizarOS?: (os: OrdemServico) => Promise<boolean>;
}

type AcaoOtimistaOS =
  | {
      tipo: "REORGANIZAR";
      movimento: {
        draggableId: string;
        source: { droppableId: string; index: number };
        destination: { droppableId: string; index: number };
      };
    }
  | {
      tipo: "SUBSTITUIR";
      ordens: OrdemServico[];
    };

const STATUS_SEQUENCIA = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "PRONTO",
  "ENTREGUE",
] as const;

type StatusKanban = (typeof STATUS_SEQUENCIA)[number];

function isStatusKanban(status: StatusOS): status is StatusKanban {
  return (STATUS_SEQUENCIA as readonly string[]).includes(status);
}

const configuracaoStatus: Record<
  StatusKanban,
  {
    titulo: string;
    descricao: string;
    classe: string;
    borda: string;
    chip: string;
  }
> = {
  AGUARDANDO_ORCAMENTO: {
    titulo: "Aguardando Orçamento",
    descricao: "Entrada inicial e diagnóstico.",
    classe: "from-sky-50 via-white to-white dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-sky-200/80 dark:border-sky-900/60",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  AGUARDANDO_APROVACAO: {
    titulo: "Aguardando Aprovação",
    descricao: "Proposta enviada ao cliente.",
    classe: "from-cyan-50 via-white to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-cyan-200/80 dark:border-cyan-900/60",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  },
  APROVADO: {
    titulo: "Aprovado",
    descricao: "OS pronta para execução.",
    classe: "from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-amber-200/80 dark:border-amber-900/60",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  AGUARDANDO_PECA: {
    titulo: "Aguardando Peça",
    descricao: "Dependência de fornecedor.",
    classe: "from-orange-50 via-white to-white dark:from-orange-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-orange-200/80 dark:border-orange-900/60",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  EM_MANUTENCAO: {
    titulo: "Em Manutenção",
    descricao: "Trabalho técnico em andamento.",
    classe: "from-violet-50 via-white to-white dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-violet-200/80 dark:border-violet-900/60",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  PRONTO: {
    titulo: "Pronto",
    descricao: "Aguardando retirada.",
    classe: "from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-emerald-200/80 dark:border-emerald-900/60",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  ENTREGUE: {
    titulo: "Entregue",
    descricao: "Fluxo concluído com sucesso.",
    classe: "from-rose-50 via-white to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-rose-200/80 dark:border-rose-900/60",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

function classificarOrdens(ordens: OrdemServico[]) {
  const agrupadas = STATUS_SEQUENCIA.reduce<Record<StatusKanban, OrdemServico[]>>((acc, status) => {
    acc[status] = [];
    return acc;
  }, {
    AGUARDANDO_ORCAMENTO: [],
    AGUARDANDO_APROVACAO: [],
    APROVADO: [],
    AGUARDANDO_PECA: [],
    EM_MANUTENCAO: [],
    PRONTO: [],
    ENTREGUE: [],
  });

  for (const os of ordens) {
    if (!isStatusKanban(os.status)) continue;
    agrupadas[os.status].push(os);
  }

  return agrupadas;
}

function ordenarPorStatus(agrupadas: Record<StatusKanban, OrdemServico[]>) {
  return STATUS_SEQUENCIA.flatMap((status) => agrupadas[status]);
}

function encontrarStatusAnterior(status: StatusKanban): StatusKanban | null {
  const indice = STATUS_SEQUENCIA.indexOf(status);
  return indice > 0 ? STATUS_SEQUENCIA[indice - 1] : null;
}

function encontrarStatusSeguinte(status: StatusKanban): StatusKanban | null {
  const indice = STATUS_SEQUENCIA.indexOf(status);
  return indice >= 0 && indice < STATUS_SEQUENCIA.length - 1 ? STATUS_SEQUENCIA[indice + 1] : null;
}

function normalizarIndice(indice: number, tamanhoLista: number) {
  return Math.max(0, Math.min(indice, tamanhoLista));
}

function aplicarMovimentoOS(
  listaAtual: OrdemServico[],
  movimento: {
    draggableId: string;
    source: { droppableId: string; index: number };
    destination: { droppableId: string; index: number };
  }
) {
  const statusOrigem = movimento.source.droppableId as StatusKanban;
  const statusDestino = movimento.destination.droppableId as StatusKanban;

  if (!STATUS_SEQUENCIA.includes(statusOrigem) || !STATUS_SEQUENCIA.includes(statusDestino)) {
    return {
      proximaLista: listaAtual,
      osMovida: null,
      statusOrigem: null,
      statusDestino: null,
    };
  }

  const agrupadas = classificarOrdens(listaAtual);
  const listaOrigem = [...agrupadas[statusOrigem]];
  const listaDestino = statusOrigem === statusDestino ? listaOrigem : [...agrupadas[statusDestino]];

  const indiceOrigem = normalizarIndice(movimento.source.index, Math.max(listaOrigem.length - 1, 0));
  let [ordemSelecionada] = listaOrigem.splice(indiceOrigem, 1);

  if (!ordemSelecionada || ordemSelecionada.id !== movimento.draggableId) {
    const indicePorId = listaOrigem.findIndex((item) => item.id === movimento.draggableId);
    if (indicePorId < 0) {
      return {
        proximaLista: listaAtual,
        osMovida: null,
        statusOrigem: null,
        statusDestino: null,
      };
    }

    const extraida = listaOrigem.splice(indicePorId, 1)[0];
    if (!extraida) {
      return {
        proximaLista: listaAtual,
        osMovida: null,
        statusOrigem: null,
        statusDestino: null,
      };
    }
    ordemSelecionada = extraida;
  }

  const agoraIso = new Date().toISOString();
  const osMovida: OrdemServico = {
    ...ordemSelecionada,
    status: statusDestino,
    dataAtualizacao: agoraIso,
  };

  const indiceDestino = normalizarIndice(movimento.destination.index, listaDestino.length);
  listaDestino.splice(indiceDestino, 0, osMovida);

  const proximaLista = ordenarPorStatus({
    ...agrupadas,
    [statusOrigem]: listaOrigem,
    [statusDestino]: listaDestino,
  });

  return {
    proximaLista,
    osMovida,
    statusOrigem,
    statusDestino,
  };
}

export function TabuleiroKanban({
  ordensServico,
  onCartaoClick,
  onMoverOS,
  onFinalizarOS,
}: TabuleiroKanbanProps) {
  const [, startTransition] = useTransition();

  const [ordensEstado, setOrdensEstado] = useOptimistic(
    ordensServico,
    (estadoAnterior, acao: AcaoOtimistaOS) => {
      if (acao.tipo === "SUBSTITUIR") {
        return acao.ordens;
      }

      const movimento = aplicarMovimentoOS(estadoAnterior, acao.movimento);
      return movimento.proximaLista;
    }
  );

  const ordensPorStatus = useMemo(() => classificarOrdens(ordensEstado), [ordensEstado]);

  const persistirMovimento = async (
    osId: string,
    statusOrigem: StatusOS,
    statusDestino: StatusOS,
    snapshotAnterior: OrdemServico[]
  ) => {
    if (statusOrigem === statusDestino) return;
    if (!onMoverOS) return;

    const sucesso = await onMoverOS(osId, statusDestino);
    if (!sucesso) {
      startTransition(() => {
        setOrdensEstado({ tipo: "SUBSTITUIR", ordens: snapshotAnterior });
      });
    }
  };

  const moverPorBotao = async (osId: string, statusDestino: StatusOS) => {
    const snapshotAnterior = ordensEstado;
    const agrupadas = classificarOrdens(snapshotAnterior);

    let origem: { status: StatusKanban; index: number } | null = null;
    for (const status of STATUS_SEQUENCIA) {
      const index = agrupadas[status].findIndex((item) => item.id === osId);
      if (index >= 0) {
        origem = { status, index };
        break;
      }
    }

    if (!origem) return;

    const movimento = {
      draggableId: osId,
      source: { droppableId: origem.status, index: origem.index },
      destination: { droppableId: statusDestino, index: 0 },
    };

    const preVisualizacao = aplicarMovimentoOS(snapshotAnterior, movimento);
    if (!preVisualizacao.osMovida || !preVisualizacao.statusOrigem || !preVisualizacao.statusDestino) {
      return;
    }

    startTransition(() => {
      setOrdensEstado({ tipo: "REORGANIZAR", movimento });
    });

    await persistirMovimento(
      preVisualizacao.osMovida.id,
      preVisualizacao.statusOrigem,
      preVisualizacao.statusDestino,
      snapshotAnterior
    );
  };

  const finalizarOS = async (os: OrdemServico) => {
    const snapshotAnterior = ordensEstado;

    startTransition(() => {
      setOrdensEstado({
        tipo: "SUBSTITUIR",
        ordens: snapshotAnterior.filter((item) => item.id !== os.id),
      });
    });

    if (!onFinalizarOS) {
      return;
    }

    const success = await onFinalizarOS(os);
    if (!success) {
      startTransition(() => {
        setOrdensEstado({ tipo: "SUBSTITUIR", ordens: snapshotAnterior });
      });
    }
  };

  const aoFinalizarDrag = async (resultado: DropResult) => {
    const { destination, source, draggableId } = resultado;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const snapshotAnterior = ordensEstado;
    const movimento = {
      draggableId,
      source,
      destination,
    };

    const preVisualizacao = aplicarMovimentoOS(snapshotAnterior, movimento);
    if (!preVisualizacao.osMovida || !preVisualizacao.statusOrigem || !preVisualizacao.statusDestino) {
      return;
    }

    startTransition(() => {
      setOrdensEstado({ tipo: "REORGANIZAR", movimento });
    });

    await persistirMovimento(
      preVisualizacao.osMovida.id,
      preVisualizacao.statusOrigem,
      preVisualizacao.statusDestino,
      snapshotAnterior
    );
  };

  return (
    <DragDropContext onDragEnd={aoFinalizarDrag}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_SEQUENCIA.map((status) => {
          const ordensFiltradas = ordensPorStatus[status];
          const configuracao = configuracaoStatus[status];

          return (
            <Droppable key={status} droppableId={status}>
              {(dropProvided, dropSnapshot) => (
                <div
                  className={`flex-1 flex flex-col min-w-[320px] rounded-2xl border bg-gradient-to-b shadow-sm transition-all ${configuracao.classe} ${configuracao.borda} ${
                    dropSnapshot.isDraggingOver
                      ? "ring-2 ring-primary/30 shadow-lg"
                      : ""
                  }`}
                >
                  <div className="px-4 py-4 border-b border-border/60">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{configuracao.titulo}</h3>
                        <p className="text-xs text-muted-foreground">{configuracao.descricao}</p>
                      </div>
                      <Badge className={configuracao.chip} variant="secondary">{ordensFiltradas.length}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{ordensFiltradas.length === 1 ? "1 OS" : `${ordensFiltradas.length} OS`}</span>
                      <span>Arraste para esta etapa</span>
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className={`p-4 space-y-3 min-h-[220px] transition-colors ${dropSnapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                    >
                      {ordensFiltradas.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Sem ordens de serviço</p>
                            <p className="text-xs text-muted-foreground">Solte um card aqui para atualizar a etapa.</p>
                          </div>
                        </div>
                      ) : (
                        ordensFiltradas.map((os, index) => {
                          if (!isStatusKanban(os.status)) return null;

                          const statusAnterior = encontrarStatusAnterior(os.status);
                          const statusSeguinte = encontrarStatusSeguinte(os.status);

                          return (
                            <Draggable key={os.id} draggableId={os.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={dragProvided.draggableProps.style as CSSProperties}
                                >
                                  <CartaoOS
                                    os={os}
                                    onClick={() => onCartaoClick?.(os)}
                                    isDragging={dragSnapshot.isDragging}
                                    statusChipClass={configuracao.chip}
                                    onMoverAnterior={() => statusAnterior && moverPorBotao(os.id, statusAnterior)}
                                    onMoverProxima={() => statusSeguinte && moverPorBotao(os.id, statusSeguinte)}
                                    onFinalizar={() => finalizarOS(os)}
                                    ultimoEstagio={os.status === "ENTREGUE"}
                                    desabilitarMoverAnterior={!statusAnterior}
                                    desabilitarMoverProxima={!statusSeguinte}
                                  />
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {dropProvided.placeholder}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
