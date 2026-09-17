"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { OrdemServico, StatusOS } from "@/types/os";
import {
  CLASSES_STATUS_OS,
  DESCRICOES_STATUS_OS,
  ROTULOS_STATUS_OS,
  STATUS_OS_SEQUENCIA,
  destinosPermitidos,
  ehStatusOS,
} from "@/lib/dominio/os/maquina-estados";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CartaoOS } from "./cartao-os";
import { ListaColunaKanban } from "./lista-coluna-kanban";

interface TabuleiroKanbanProps {
  ordensServico: OrdemServico[];
  onCartaoClick?: (os: OrdemServico) => void;
  onMoverOS?: (osId: string, novoStatus: StatusOS) => Promise<boolean>;
  onFinalizarOS?: (os: OrdemServico) => Promise<boolean>;
  /** Abre o fluxo de entrega. Recebe a OS e devolve true quando concluiu. */
  onEntregarOS?: (os: OrdemServico) => Promise<boolean>;
  /** Abre o fluxo de reabertura. Só é passado para ADMIN/GESTOR. */
  onReabrirOS?: (os: OrdemServico) => Promise<boolean>;
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

type ConfirmacaoEntregaSemItens = {
  snapshotAnterior: OrdemServico[];
  movimento: {
    draggableId: string;
    source: { droppableId: string; index: number };
    destination: { droppableId: string; index: number };
  };
  osId: string;
  statusOrigem: StatusOS;
  statusDestino: StatusOS;
};

// Sequencia, rotulos e cores vem do dominio (fonte unica).
const STATUS_SEQUENCIA = STATUS_OS_SEQUENCIA;

type StatusKanban = StatusOS;

function isStatusKanban(status: StatusOS): status is StatusKanban {
  return ehStatusOS(status);
}

const configuracaoStatus: Record<
  StatusKanban,
  { titulo: string; descricao: string; classe: string; borda: string; chip: string }
> = Object.fromEntries(
  STATUS_OS_SEQUENCIA.map((status) => [
    status,
    {
      titulo: ROTULOS_STATUS_OS[status],
      descricao: DESCRICOES_STATUS_OS[status],
      classe: CLASSES_STATUS_OS[status].coluna,
      borda: CLASSES_STATUS_OS[status].borda,
      chip: CLASSES_STATUS_OS[status].chip,
    },
  ])
) as Record<StatusKanban, { titulo: string; descricao: string; classe: string; borda: string; chip: string }>;

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
    GARANTIA_RETORNO: [],
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
  onEntregarOS,
  onReabrirOS,
}: TabuleiroKanbanProps) {
  const [, startTransition] = useTransition();
  // Guarda a OS em arraste para bloquear colunas invalidas em tempo real.
  const [osEmArraste, setOsEmArraste] = useState<OrdemServico | null>(null);
  const [confirmacaoEntregaSemItens, setConfirmacaoEntregaSemItens] =
    useState<ConfirmacaoEntregaSemItens | null>(null);

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

  const osSemItens = (os: OrdemServico): boolean => {
    return (os.itensOrcamento?.length ?? 0) === 0;
  };

  /**
   * Colunas validas para a OS que esta sendo arrastada agora.
   * ENTREGUE entra na lista porque a entrega e permitida pela UI — ela apenas
   * nao passa pela mudanca generica de status, e sim pelo dialogo de
   * finalizacao (ver aoFinalizarDrag).
   */
  const destinosDoArraste = useMemo<ReadonlySet<StatusOS> | null>(() => {
    if (!osEmArraste || !isStatusKanban(osEmArraste.status)) return null;

    const contexto = { ehRetornoGarantia: Boolean(osEmArraste.ehRetornoGarantia) };
    const permitidos = new Set<StatusOS>(destinosPermitidos(osEmArraste.status, contexto));

    if (osEmArraste.status !== "ENTREGUE") {
      permitidos.add("ENTREGUE");
    }

    return permitidos;
  }, [osEmArraste]);

  const colunaBloqueada = (status: StatusKanban): boolean => {
    if (!destinosDoArraste) return false;
    if (osEmArraste && osEmArraste.status === status) return false;
    return !destinosDoArraste.has(status);
  };

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

    if (preVisualizacao.statusDestino === "ENTREGUE" && osSemItens(preVisualizacao.osMovida)) {
      setConfirmacaoEntregaSemItens({
        snapshotAnterior,
        movimento,
        osId: preVisualizacao.osMovida.id,
        statusOrigem: preVisualizacao.statusOrigem,
        statusDestino: preVisualizacao.statusDestino,
      });
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
    if (!onFinalizarOS) {
      return;
    }

    const snapshotAnterior = ordensEstado;

    const success = await onFinalizarOS(os);
    if (!success) {
      startTransition(() => {
        setOrdensEstado({ tipo: "SUBSTITUIR", ordens: snapshotAnterior });
      });
      return;
    }

    startTransition(() => {
      setOrdensEstado({
        tipo: "SUBSTITUIR",
        ordens: snapshotAnterior.filter((item) => item.id !== os.id),
      });
    });
  };

  const aoFinalizarDrag = async (resultado: DropResult) => {
    setOsEmArraste(null);

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

    // Soltar em ENTREGUE NAO muda status: abre o dialogo de finalizacao, que
    // emite a garantia e arquiva na mesma transacao. Antes da Fase 1A este drop
    // chamava a mudanca generica de status e produzia OS entregue porem nao
    // arquivada (AUDIT_REPORT 16.7-e).
    if (preVisualizacao.statusDestino === "ENTREGUE") {
      const osAlvo = snapshotAnterior.find((item) => item.id === preVisualizacao.osMovida?.id);
      if (!osAlvo || !onEntregarOS) return;

      startTransition(() => {
        setOrdensEstado({ tipo: "REORGANIZAR", movimento });
      });

      const entregue = await onEntregarOS(osAlvo);

      if (!entregue) {
        startTransition(() => {
          setOrdensEstado({ tipo: "SUBSTITUIR", ordens: snapshotAnterior });
        });
      }

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

  const aoIniciarDrag = (inicio: { draggableId: string }) => {
    const os = ordensEstado.find((item) => item.id === inicio.draggableId) ?? null;
    setOsEmArraste(os);
  };

  const confirmarEntregaSemItens = async () => {
    if (!confirmacaoEntregaSemItens) return;

    const pendente = confirmacaoEntregaSemItens;
    setConfirmacaoEntregaSemItens(null);

    startTransition(() => {
      setOrdensEstado({ tipo: "REORGANIZAR", movimento: pendente.movimento });
    });

    await persistirMovimento(
      pendente.osId,
      pendente.statusOrigem,
      pendente.statusDestino,
      pendente.snapshotAnterior
    );
  };

  // O board ocupa o que sobra da viewport, medido do layout real: sem numero magico,
  // e correto em qualquer largura ou altura de janela.
  const boardRef = useRef<HTMLDivElement>(null);
  const [alturaBoard, setAlturaBoard] = useState<number | null>(null);

  const medirAltura = useCallback(() => {
    const elemento = boardRef.current;
    if (!elemento) return;

    const topo = elemento.getBoundingClientRect().top;
    const FOLGA = 16;
    setAlturaBoard(Math.max(420, window.innerHeight - topo - FOLGA));
  }, []);

  useEffect(() => {
    medirAltura();
    window.addEventListener("resize", medirAltura);
    return () => window.removeEventListener("resize", medirAltura);
  }, [medirAltura]);

  return (
    <>
      <DragDropContext onDragStart={aoIniciarDrag} onDragEnd={aoFinalizarDrag}>
        <div
          ref={boardRef}
          className="flex min-h-[420px] gap-4 overflow-x-auto pb-4"
          style={alturaBoard === null ? undefined : { height: alturaBoard }}
        >
        {STATUS_SEQUENCIA.map((status) => {
          const ordensFiltradas = ordensPorStatus[status];
          const configuracao = configuracaoStatus[status];

          return (
            <Droppable key={status} droppableId={status} isDropDisabled={colunaBloqueada(status)}>
              {(dropProvided, dropSnapshot) => (
                <div
                  className={`flex h-full min-h-0 w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-gradient-to-b shadow-sm transition-all ${configuracao.classe} ${configuracao.borda} ${
                    dropSnapshot.isDraggingOver ? "ring-2 ring-primary/30 shadow-lg" : ""
                  } ${colunaBloqueada(status) ? "opacity-40 saturate-50" : ""}`}
                >
                  <div className="shrink-0 border-b border-border/60 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{configuracao.titulo}</h3>
                        <p className="text-xs text-muted-foreground">{configuracao.descricao}</p>
                      </div>
                      <Badge className={configuracao.chip} variant="secondary">{ordensFiltradas.length}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{ordensFiltradas.length === 1 ? "1 OS" : `${ordensFiltradas.length} OS`}</span>
                      <span>
                        {colunaBloqueada(status)
                          ? "Etapa indisponível para esta OS"
                          : "Arraste para esta etapa"}
                      </span>
                    </div>
                  </div>

                  <ListaColunaKanban
                    ordens={ordensFiltradas}
                    dropProvided={dropProvided}
                    dropSnapshot={dropSnapshot}
                    vazio={
                      <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">Sem ordens de serviço</p>
                          <p className="text-xs text-muted-foreground">Solte um card aqui para atualizar a etapa.</p>
                        </div>
                      </div>
                    }
                    renderizarCartao={(os, index) => {
                      if (!isStatusKanban(os.status)) return null;

                      const contextoOS = { ehRetornoGarantia: Boolean(os.ehRetornoGarantia) };
                      const permitidos = destinosPermitidos(os.status, contextoOS);

                      // Os botoes de avancar/voltar seguem a maquina de estados,
                      // nao a ordem crua do quadro. Antes eles passavam por
                      // GARANTIA_RETORNO em toda OS normal a caminho de PRONTO
                      // (AUDIT_REPORT 16.7-d).
                      const indiceAtual = STATUS_SEQUENCIA.indexOf(os.status);
                      const statusAnterior =
                        [...permitidos].reverse().find((item) => STATUS_SEQUENCIA.indexOf(item) < indiceAtual) ??
                        null;
                      const statusSeguinte =
                        permitidos.find((item) => STATUS_SEQUENCIA.indexOf(item) > indiceAtual) ?? null;

                      const retornoJaFinalizado = Boolean(os.retornoGarantiaFinalizadoEm);
                      const ehEntregue = os.status === "ENTREGUE";
                      const podeFinalizarRetorno =
                        Boolean(os.ehRetornoGarantia) && !retornoJaFinalizado && !ehEntregue;
                      // A entrega sai pelo dialogo de finalizacao; o botao do
                      // cartao so trata o fluxo de retorno de garantia.
                      const podeFinalizar = podeFinalizarRetorno;
                      const textoBotaoFinalizar = "Finalizar retorno";

                      return (
                        <Draggable
                          key={os.id}
                          draggableId={os.id}
                          index={index}
                          isDragDisabled={ehEntregue}
                        >
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
                                statusDaColuna={status}
                                onMoverAnterior={
                                  ehEntregue || !statusAnterior
                                    ? undefined
                                    : () => moverPorBotao(os.id, statusAnterior)
                                }
                                onMoverProxima={
                                  ehEntregue || !statusSeguinte
                                    ? undefined
                                    : () => moverPorBotao(os.id, statusSeguinte)
                                }
                                onFinalizar={podeFinalizar ? () => finalizarOS(os) : undefined}
                                podeFinalizar={podeFinalizar}
                                textoBotaoFinalizar={textoBotaoFinalizar}
                                desabilitarMoverAnterior={ehEntregue || !statusAnterior}
                                desabilitarMoverProxima={ehEntregue || !statusSeguinte}
                                onEntregar={
                                  ehEntregue || !onEntregarOS ? undefined : () => void onEntregarOS(os)
                                }
                                onReabrir={
                                  ehEntregue && onReabrirOS ? () => void onReabrirOS(os) : undefined
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    }}
                  />
                </div>
              )}
            </Droppable>
          );
        })}
        </div>
      </DragDropContext>

      <AlertDialog
        open={Boolean(confirmacaoEntregaSemItens)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setConfirmacaoEntregaSemItens(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entregar OS sem peça/serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta OS não possui nenhuma peça ou serviço cadastrado. Você ainda pode entregá-la,
              mas ela ficará sem itens vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEntregaSemItens}>Entregar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
