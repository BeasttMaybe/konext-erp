"use client";

import {
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { OrdemServico, EtapaOS, SituacaoOS } from "@/types/os";
import {
  CLASSES_ETAPA_OS,
  DESCRICOES_ETAPA_OS,
  ETAPA_OS_SEQUENCIA,
  ROTULOS_ETAPA_OS,
  destinosPermitidosEtapa,
  ehEtapaOS,
  ehResgatePendente,
  type VarianteEtapaOS,
} from "@/lib/dominio/os/maquina-estados";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { useTelaDeCelular } from "@/lib/dispositivo/tela-de-celular";
import { CartaoOS } from "./cartao-os";
import { ListaColunaKanban } from "./lista-coluna-kanban";

interface TabuleiroKanbanProps {
  ordensServico: OrdemServico[];
  onCartaoClick?: (os: OrdemServico) => void;
  onMoverOS?: (osId: string, novaEtapa: EtapaOS) => Promise<boolean>;
  /** Marca/limpa a situacao pelo menu do card, sem mover a OS de coluna. */
  onAlterarSituacao?: (osId: string, situacao: SituacaoOS | null) => Promise<boolean>;
  onFinalizarOS?: (os: OrdemServico) => Promise<boolean>;
  /** Abre o fluxo de entrega. Recebe a OS e devolve true quando concluiu. Tambem usado para o resgate (ver onArquivar abaixo) — mesmo caminho, nunca um segundo. */
  onEntregarOS?: (os: OrdemServico) => Promise<boolean>;
  /** Abre o fluxo de reabertura. Só é passado para ADMIN/GESTOR. */
  onReabrirOS?: (os: OrdemServico) => Promise<boolean>;
  /** Permissao os.finalizar do usuario logado — controla so o botao "Arquivar OS" do resgate. */
  podeArquivarOS?: boolean;
  /** Permissao os.editar do usuario logado — controla so a acao rapida "Técnicos..." do card (Fase 1D-2). */
  podeEditarTecnicos?: boolean;
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

// Sequencia, rotulos e cores vem do dominio (fonte unica).
const ETAPA_SEQUENCIA = ETAPA_OS_SEQUENCIA;
/**
 * Colunas do quadro. ENTREGUE nao e coluna: entregar ja finaliza e arquiva a
 * OS (ela vai para "Finalizadas"), entao a coluna ficava sempre vazia. A
 * entrega sai pelo botao "Entregar" do cartao. A OS entregue que ainda falta
 * arquivar (resgate, ver ehResgatePendente) aparece no fim da coluna PRONTO.
 */
const COLUNAS_DO_QUADRO = ETAPA_SEQUENCIA.filter((etapa) => etapa !== "ENTREGUE");

function ordensDaColuna(agrupadas: Record<EtapaKanban, OrdemServico[]>, etapa: EtapaKanban): OrdemServico[] {
  return etapa === "PRONTO" ? [...agrupadas.PRONTO, ...agrupadas.ENTREGUE] : agrupadas[etapa];
}

/** Quantos cartoes o celular mostra por vez, antes de "Mostrar mais". */
const LOTE_NO_CELULAR = 20;

type EtapaKanban = EtapaOS;

function isEtapaKanban(etapa: EtapaOS): etapa is EtapaKanban {
  return ehEtapaOS(etapa);
}

type ConfiguracaoColuna = { titulo: string; descricao: string; faixaTopo: string; variante: VarianteEtapaOS };

const configuracaoEtapa: Record<EtapaKanban, ConfiguracaoColuna> = Object.fromEntries(
  ETAPA_OS_SEQUENCIA.map((etapa) => [
    etapa,
    {
      titulo: ROTULOS_ETAPA_OS[etapa],
      descricao: DESCRICOES_ETAPA_OS[etapa],
      faixaTopo: CLASSES_ETAPA_OS[etapa].faixaTopo,
      variante: CLASSES_ETAPA_OS[etapa].variante,
    },
  ])
) as Record<EtapaKanban, ConfiguracaoColuna>;

function classificarOrdens(ordens: OrdemServico[]) {
  const agrupadas = ETAPA_SEQUENCIA.reduce<Record<EtapaKanban, OrdemServico[]>>((acc, etapa) => {
    acc[etapa] = [];
    return acc;
  }, {
    ORCAMENTO: [],
    CONSERTO: [],
    PRONTO: [],
    ENTREGUE: [],
  });

  for (const os of ordens) {
    if (!isEtapaKanban(os.etapa)) continue;
    agrupadas[os.etapa].push(os);
  }

  return agrupadas;
}

function ordenarPorEtapa(agrupadas: Record<EtapaKanban, OrdemServico[]>) {
  return ETAPA_SEQUENCIA.flatMap((etapa) => agrupadas[etapa]);
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
  const etapaOrigem = movimento.source.droppableId as EtapaKanban;
  const etapaDestino = movimento.destination.droppableId as EtapaKanban;

  if (!ETAPA_SEQUENCIA.includes(etapaOrigem) || !ETAPA_SEQUENCIA.includes(etapaDestino)) {
    return {
      proximaLista: listaAtual,
      osMovida: null,
      etapaOrigem: null,
      etapaDestino: null,
    };
  }

  const agrupadas = classificarOrdens(listaAtual);
  const listaOrigem = [...agrupadas[etapaOrigem]];
  const listaDestino = etapaOrigem === etapaDestino ? listaOrigem : [...agrupadas[etapaDestino]];

  const indiceOrigem = normalizarIndice(movimento.source.index, Math.max(listaOrigem.length - 1, 0));
  let [ordemSelecionada] = listaOrigem.splice(indiceOrigem, 1);

  if (!ordemSelecionada || ordemSelecionada.id !== movimento.draggableId) {
    const indicePorId = listaOrigem.findIndex((item) => item.id === movimento.draggableId);
    if (indicePorId < 0) {
      return {
        proximaLista: listaAtual,
        osMovida: null,
        etapaOrigem: null,
        etapaDestino: null,
      };
    }

    const extraida = listaOrigem.splice(indicePorId, 1)[0];
    if (!extraida) {
      return {
        proximaLista: listaAtual,
        osMovida: null,
        etapaOrigem: null,
        etapaDestino: null,
      };
    }
    ordemSelecionada = extraida;
  }

  const agoraIso = new Date().toISOString();
  const osMovida: OrdemServico = {
    ...ordemSelecionada,
    etapa: etapaDestino,
    // Trocar de etapa sempre zera a situacao (Fase 1C-3, Parte 3) — o preview
    // otimista precisa bater com o que o servidor vai gravar.
    situacao: etapaOrigem === etapaDestino ? ordemSelecionada.situacao : null,
    dataAtualizacao: agoraIso,
  };

  const indiceDestino = normalizarIndice(movimento.destination.index, listaDestino.length);
  listaDestino.splice(indiceDestino, 0, osMovida);

  const proximaLista = ordenarPorEtapa({
    ...agrupadas,
    [etapaOrigem]: listaOrigem,
    [etapaDestino]: listaDestino,
  });

  return {
    proximaLista,
    osMovida,
    etapaOrigem,
    etapaDestino,
  };
}

export function TabuleiroKanban({
  ordensServico,
  onCartaoClick,
  onMoverOS,
  onAlterarSituacao,
  onFinalizarOS,
  onEntregarOS,
  onReabrirOS,
  podeArquivarOS = false,
  podeEditarTecnicos = false,
}: TabuleiroKanbanProps) {
  const [, startTransition] = useTransition();
  // Celular: em vez de colunas lado a lado com arrastar (que no toque briga
  // com a rolagem da pagina), uma etapa por vez, escolhida no topo, e os
  // cartoes mudam de etapa pelos botoes deles.
  const telaDeCelular = useTelaDeCelular();
  const [etapaNoCelular, setEtapaNoCelular] = useState<EtapaKanban>(
    () => COLUNAS_DO_QUADRO.find((etapa) => ordensServico.some((os) => os.etapa === etapa)) ?? COLUNAS_DO_QUADRO[0]!
  );
  const [limiteNoCelular, setLimiteNoCelular] = useState(LOTE_NO_CELULAR);
  // Guarda a OS em arraste para bloquear colunas invalidas em tempo real.
  const [osEmArraste, setOsEmArraste] = useState<OrdemServico | null>(null);

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

  const ordensPorEtapa = useMemo(() => classificarOrdens(ordensEstado), [ordensEstado]);

  /**
   * Colunas validas para a OS que esta sendo arrastada agora.
   */
  const destinosDoArraste = useMemo<ReadonlySet<EtapaOS> | null>(() => {
    if (!osEmArraste || !isEtapaKanban(osEmArraste.etapa)) return null;

    const contexto = { ehRetornoGarantia: Boolean(osEmArraste.ehRetornoGarantia) };
    return new Set<EtapaOS>(destinosPermitidosEtapa(osEmArraste.etapa, contexto));
  }, [osEmArraste]);

  const colunaBloqueada = (etapa: EtapaKanban): boolean => {
    if (!destinosDoArraste) return false;
    if (osEmArraste && osEmArraste.etapa === etapa) return false;
    return !destinosDoArraste.has(etapa);
  };

  const persistirMovimento = async (
    osId: string,
    etapaOrigem: EtapaOS,
    etapaDestino: EtapaOS,
    snapshotAnterior: OrdemServico[]
  ) => {
    if (etapaOrigem === etapaDestino) return;
    if (!onMoverOS) return;

    const sucesso = await onMoverOS(osId, etapaDestino);
    if (!sucesso) {
      startTransition(() => {
        setOrdensEstado({ tipo: "SUBSTITUIR", ordens: snapshotAnterior });
      });
    }
  };

  const moverPorBotao = async (osId: string, etapaDestino: EtapaOS) => {
    const snapshotAnterior = ordensEstado;
    const agrupadas = classificarOrdens(snapshotAnterior);

    let origem: { etapa: EtapaKanban; index: number } | null = null;
    for (const etapa of ETAPA_SEQUENCIA) {
      const index = agrupadas[etapa].findIndex((item) => item.id === osId);
      if (index >= 0) {
        origem = { etapa, index };
        break;
      }
    }

    if (!origem) return;

    const movimento = {
      draggableId: osId,
      source: { droppableId: origem.etapa, index: origem.index },
      destination: { droppableId: etapaDestino, index: 0 },
    };

    const preVisualizacao = aplicarMovimentoOS(snapshotAnterior, movimento);
    if (!preVisualizacao.osMovida || !preVisualizacao.etapaOrigem || !preVisualizacao.etapaDestino) {
      return;
    }

    startTransition(() => {
      setOrdensEstado({ tipo: "REORGANIZAR", movimento });
    });

    await persistirMovimento(
      preVisualizacao.osMovida.id,
      preVisualizacao.etapaOrigem,
      preVisualizacao.etapaDestino,
      snapshotAnterior
    );
  };

  const alterarSituacao = async (osId: string, situacao: SituacaoOS | null) => {
    if (!onAlterarSituacao) return;

    const snapshotAnterior = ordensEstado;
    const sucesso = await onAlterarSituacao(osId, situacao);

    if (sucesso) {
      startTransition(() => {
        setOrdensEstado({
          tipo: "SUBSTITUIR",
          ordens: snapshotAnterior.map((item) =>
            item.id === osId ? { ...item, situacao, dataAtualizacao: new Date().toISOString() } : item
          ),
        });
      });
    }
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

  /**
   * Resgate: OS ja ENTREGUE, so falta archivedAt (e a garantia, se faltar).
   * Reusa onEntregarOS de proposito — o mesmo finalizarOrdemServico que uma
   * entrega normal chama, nunca um segundo caminho de arquivamento. So a
   * origem do clique (botao "Arquivar OS", nao "Entregar e finalizar") e o
   * card de onde sai (removido do quadro ao suceder, como finalizarOS acima)
   * sao diferentes.
   */
  const arquivarOS = async (os: OrdemServico) => {
    if (!onEntregarOS) {
      return;
    }

    const snapshotAnterior = ordensEstado;
    const sucesso = await onEntregarOS(os);

    if (sucesso) {
      startTransition(() => {
        setOrdensEstado({
          tipo: "SUBSTITUIR",
          ordens: snapshotAnterior.filter((item) => item.id !== os.id),
        });
      });
    }
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
    if (!preVisualizacao.osMovida || !preVisualizacao.etapaOrigem || !preVisualizacao.etapaDestino) {
      return;
    }

    // Sem coluna ENTREGUE (ver COLUNAS_DO_QUADRO): a entrega so sai pelo
    // botao do cartao, que abre o dialogo de finalizacao.
    if (preVisualizacao.etapaDestino === "ENTREGUE") return;

    startTransition(() => {
      setOrdensEstado({ tipo: "REORGANIZAR", movimento });
    });

    await persistirMovimento(
      preVisualizacao.osMovida.id,
      preVisualizacao.etapaOrigem,
      preVisualizacao.etapaDestino,
      snapshotAnterior
    );
  };

  /**
   * O cartao com os botoes que a maquina de estados permite. Uma funcao so,
   * usada pelo quadro do computador (arrastavel) e pela lista do celular (sem
   * arrastar), para as duas nunca divergirem.
   */
  const renderizarCartaoOS = (os: OrdemServico, extras: { isDragging?: boolean; semArraste?: boolean } = {}) => {
    if (!isEtapaKanban(os.etapa)) return null;

    const contextoOS = { ehRetornoGarantia: Boolean(os.ehRetornoGarantia) };
    const permitidos = destinosPermitidosEtapa(os.etapa, contextoOS);

    // Os botoes de avancar/voltar seguem a maquina de estados,
    // nao a ordem crua do quadro.
    const indiceAtual = ETAPA_SEQUENCIA.indexOf(os.etapa);
    const etapaAnterior =
      [...permitidos].reverse().find((item) => ETAPA_SEQUENCIA.indexOf(item) < indiceAtual) ??
      null;
    const etapaSeguinte =
      permitidos.find((item) => ETAPA_SEQUENCIA.indexOf(item) > indiceAtual) ?? null;

    const retornoJaFinalizado = Boolean(os.retornoGarantiaFinalizadoEm);
    const ehEntregue = os.etapa === "ENTREGUE";
    // Resgate: ENTREGUE sem archivedAt — a OS entregue que ainda aparece
    // no quadro porque falta so completar o arquivamento (e a garantia,
    // se faltar). Ver comentario de arquivarOS acima e de ehResgatePendente
    // em lib/dominio/os/maquina-estados.ts — mesma regra usada pelo aviso
    // em dashboard-os.tsx, nunca reimplementada duas vezes.
    const precisaArquivar = ehResgatePendente(os);
    const podeFinalizarRetorno =
      Boolean(os.ehRetornoGarantia) && !retornoJaFinalizado && !ehEntregue;
    // A entrega sai pelo dialogo de finalizacao; o botao do
    // cartao so trata o fluxo de retorno de garantia.
    const podeFinalizar = podeFinalizarRetorno;
    const textoBotaoFinalizar = "Finalizar retorno";

    return (
      <CartaoOS
        os={os}
        onClick={() => onCartaoClick?.(os)}
        onMoverAnterior={
          ehEntregue || !etapaAnterior
            ? undefined
            : () => moverPorBotao(os.id, etapaAnterior)
        }
        onMoverProxima={
          ehEntregue || !etapaSeguinte
            ? undefined
            : () => moverPorBotao(os.id, etapaSeguinte)
        }
        onFinalizar={podeFinalizar ? () => finalizarOS(os) : undefined}
        podeFinalizar={podeFinalizar}
        textoBotaoFinalizar={textoBotaoFinalizar}
        desabilitarMoverAnterior={ehEntregue || !etapaAnterior}
        desabilitarMoverProxima={ehEntregue || !etapaSeguinte}
        esconderMoverAnterior={ehEntregue}
        onEntregar={
          ehEntregue || !onEntregarOS ? undefined : () => void onEntregarOS(os)
        }
        onReabrir={
          ehEntregue && onReabrirOS ? () => void onReabrirOS(os) : undefined
        }
        onArquivar={
          precisaArquivar && podeArquivarOS && onEntregarOS
            ? () => void arquivarOS(os)
            : undefined
        }
        estadoExplicacao={precisaArquivar ? "Entregue, falta arquivar" : undefined}
        onAlterarSituacao={
          ehEntregue || !onAlterarSituacao
            ? undefined
            : (situacao) => void alterarSituacao(os.id, situacao)
        }
        podeEditarTecnicos={podeEditarTecnicos}
        isDragging={extras.isDragging}
        semArraste={extras.semArraste}
        rotuloAnterior={etapaAnterior ? configuracaoEtapa[etapaAnterior as EtapaKanban]?.titulo : undefined}
        rotuloProxima={etapaSeguinte ? configuracaoEtapa[etapaSeguinte as EtapaKanban]?.titulo : undefined}
      />
    );
  };

  const aoIniciarDrag = (inicio: { draggableId: string }) => {
    const os = ordensEstado.find((item) => item.id === inicio.draggableId) ?? null;
    setOsEmArraste(os);
  };

  // O board tem altura própria e fixa — nao mede nem preenche o que sobra da
  // viewport (esse era o padrao de artboard fixo copiado pro app). Cada
  // coluna rola por dentro (Kanban é um "canvas" com colunas de altura
  // própria, não uma lista de página) e a página inteira continua rolando
  // normalmente ao redor do quadro.
  // Ate o navegador dizer a largura (no servidor nao se sabe), so o espaco
  // do quadro: desenhar as colunas e troca-las no celular seria um piscar.
  if (telaDeCelular === null) {
    return <div className="min-h-[420px]" aria-busy="true" />;
  }

  if (telaDeCelular) {
    const ordensDaEtapa = ordensDaColuna(ordensPorEtapa, etapaNoCelular);
    const visiveis = ordensDaEtapa.slice(0, limiteNoCelular);
    return (
      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Etapa do quadro" className="grid grid-cols-3 gap-2">
          {COLUNAS_DO_QUADRO.map((etapa) => {
            const ativa = etapa === etapaNoCelular;
            return (
              <button
                key={etapa}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => {
                  setEtapaNoCelular(etapa);
                  setLimiteNoCelular(LOTE_NO_CELULAR);
                }}
                className={`flex h-14 flex-col items-center justify-center rounded-kx-botao border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco ${
                  ativa
                    ? "border-transparent bg-kx-primaria text-primary-foreground"
                    : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2"
                }`}
              >
                <span className="text-lg font-extrabold leading-none tabular-nums">{ordensDaColuna(ordensPorEtapa, etapa).length}</span>
                <span className="mt-1 leading-none">{configuracaoEtapa[etapa].titulo}</span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-kx-legenda">{configuracaoEtapa[etapaNoCelular].descricao}</p>

        {ordensDaEtapa.length === 0 ? (
          <div className="rounded-kx-cartao border border-dashed border-kx-campo-borda px-4 py-8 text-center text-sm text-kx-legenda">
            Nenhuma OS em {configuracaoEtapa[etapaNoCelular].titulo.toLowerCase()}.
          </div>
        ) : (
          <div role="tabpanel" className="flex flex-col gap-3">
            {visiveis.map((os) => (
              <div key={os.id}>{renderizarCartaoOS(os, { semArraste: true })}</div>
            ))}
            {ordensDaEtapa.length > visiveis.length ? (
              <button
                type="button"
                className="h-11 rounded-kx-botao border border-kx-painel-borda text-sm font-semibold text-kx-texto-2"
                onClick={() => setLimiteNoCelular((atual) => atual + LOTE_NO_CELULAR)}
              >
                Mostrar mais {Math.min(LOTE_NO_CELULAR, ordensDaEtapa.length - visiveis.length)} de{" "}
                {ordensDaEtapa.length - visiveis.length}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
      <DragDropContext onDragStart={aoIniciarDrag} onDragEnd={aoFinalizarDrag}>
        <div className="flex min-h-[420px] gap-4 overflow-x-auto pb-4">
        {COLUNAS_DO_QUADRO.map((etapa) => {
          const ordensFiltradas = ordensDaColuna(ordensPorEtapa, etapa);
          const configuracao = configuracaoEtapa[etapa];

          return (
            <Droppable key={etapa} droppableId={etapa} isDropDisabled={colunaBloqueada(etapa)}>
              {(dropProvided, dropSnapshot) => (
                <div
                  className={`flex max-h-[640px] min-w-[300px] flex-1 flex-col overflow-hidden rounded-kx-cartao border-x border-b border-x-kx-painel-borda border-b-kx-painel-borda bg-kx-painel shadow-sm transition-all ${configuracao.faixaTopo} ${
                    dropSnapshot.isDraggingOver ? "ring-2 ring-primary/30 shadow-lg" : ""
                  } ${colunaBloqueada(etapa) ? "opacity-40 saturate-50" : ""}`}
                >
                  <div className="shrink-0 border-b border-border/60 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{configuracao.titulo}</h3>
                        <p className="text-xs text-muted-foreground">{configuracao.descricao}</p>
                      </div>
                      <PilulaStatus variante={configuracao.variante} comPonto>
                        {ordensFiltradas.length}
                      </PilulaStatus>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{ordensFiltradas.length === 1 ? "1 OS" : `${ordensFiltradas.length} OS`}</span>
                      <span>
                        {colunaBloqueada(etapa) ? "Etapa indisponível para esta OS" : "Arraste para esta etapa"}
                      </span>
                    </div>
                  </div>

                  <ListaColunaKanban
                    ordens={ordensFiltradas}
                    dropProvided={dropProvided}
                    dropSnapshot={dropSnapshot}
                    vazio={
                      <div className="flex min-h-40 items-center justify-center rounded-kx-cartao border border-dashed border-border/70 bg-background/60 px-4 text-center">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">Sem ordens de serviço</p>
                          <p className="text-xs text-muted-foreground">Solte um card aqui para atualizar a etapa.</p>
                        </div>
                      </div>
                    }
                    renderizarCartao={(os, index) => {
                      if (!isEtapaKanban(os.etapa)) return null;
                      const ehEntregue = os.etapa === "ENTREGUE";

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
                              {renderizarCartaoOS(os, { isDragging: dragSnapshot.isDragging })}
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
  );
}
