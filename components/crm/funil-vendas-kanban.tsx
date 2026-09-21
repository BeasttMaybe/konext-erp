"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  LayoutGrid,
  Plus,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { criarOportunidade, atualizarEstagioOportunidade, type OportunidadeListagem } from "@/app/actions/oportunidades";
import type { ClienteBuscaCRM } from "@/app/actions/crm";
import { SeletorClienteCRM } from "@/components/financeiro/seletor-cliente-crm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatarMoedaBrasileira } from "@/lib/formatadores";
import {
  formOportunidadeSchema,
  estagiosFunil,
  type EstagioFunil,
  type FormOportunidade,
} from "@/lib/validations/oportunidades";

export type ClienteOpcao = {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
  telefone: string;
};

interface FunilVendasKanbanProps {
  oportunidades: OportunidadeListagem[];
  clientes: ClienteOpcao[];
}

const configuracaoEtapa: Record<
  EstagioFunil,
  {
    titulo: string;
    descricao: string;
    classe: string;
    borda: string;
    chip: string;
  }
> = {
  PROSPECCAO: {
    titulo: "Prospecção",
    descricao: "Primeiro contato e descoberta.",
    classe: "from-sky-50 via-white to-white dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-sky-200/80 dark:border-sky-900/60",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  DIAGNOSTICO: {
    titulo: "Diagnóstico",
    descricao: "Entendimento de dor e contexto.",
    classe: "from-cyan-50 via-white to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-cyan-200/80 dark:border-cyan-900/60",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  },
  PROPOSTA: {
    titulo: "Proposta",
    descricao: "Oferta comercial enviada.",
    classe: "from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-amber-200/80 dark:border-amber-900/60",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  NEGOCIACAO: {
    titulo: "Negociação",
    descricao: "Ajustes e validações finais.",
    classe: "from-orange-50 via-white to-white dark:from-orange-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-orange-200/80 dark:border-orange-900/60",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  GANHO: {
    titulo: "Ganho",
    descricao: "Oportunidades convertidas.",
    classe: "from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-emerald-200/80 dark:border-emerald-900/60",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  PERDIDO: {
    titulo: "Perdido",
    descricao: "Oportunidades sem avanço.",
    classe: "from-rose-50 via-white to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-rose-200/80 dark:border-rose-900/60",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

const etapasOrdenadas: EstagioFunil[] = ["PROSPECCAO", "DIAGNOSTICO", "PROPOSTA", "NEGOCIACAO", "GANHO", "PERDIDO"];
const etapasEncerradas: EstagioFunil[] = ["GANHO", "PERDIDO"];

const valoresPadrao: FormOportunidade = {
  titulo: "",
  valor: 0,
  clienteId: "",
  estagio: "PROSPECCAO",
  dataFechamento: "",
};

function formatarDataCurta(valorISO: string | null): string {
  if (!valorISO) return "Sem data";
  const data = new Date(valorISO);
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function classificarOportunidades(oportunidades: OportunidadeListagem[]) {
  const agrupadas = etapasOrdenadas.reduce<Record<EstagioFunil, OportunidadeListagem[]>>((acc, etapa) => {
    acc[etapa] = [];
    return acc;
  }, {
    PROSPECCAO: [],
    DIAGNOSTICO: [],
    PROPOSTA: [],
    NEGOCIACAO: [],
    GANHO: [],
    PERDIDO: [],
  });

  for (const oportunidade of oportunidades) {
    agrupadas[oportunidade.estagio].push(oportunidade);
  }

  return agrupadas;
}

function ordenarPorEtapa(agrupadas: Record<EstagioFunil, OportunidadeListagem[]>) {
  return etapasOrdenadas.flatMap((etapa) => agrupadas[etapa]);
}

function normalizarIndice(indice: number, tamanhoLista: number) {
  return Math.max(0, Math.min(indice, tamanhoLista));
}

function aplicarMovimentoOportunidade(
  listaAtual: OportunidadeListagem[],
  movimento: {
    draggableId: string;
    source: { droppableId: string; index: number };
    destination: { droppableId: string; index: number };
  }
) {
  const estagioOrigem = movimento.source.droppableId as EstagioFunil;
  const estagioDestino = movimento.destination.droppableId as EstagioFunil;

  if (!etapasOrdenadas.includes(estagioOrigem) || !etapasOrdenadas.includes(estagioDestino)) {
    return {
      proximaLista: listaAtual,
      oportunidadeMovida: null,
      estagioOrigem: null,
      estagioDestino: null,
    };
  }

  const agrupadas = classificarOportunidades(listaAtual);
  const listaOrigem = [...agrupadas[estagioOrigem]];
  const listaDestino = estagioOrigem === estagioDestino ? listaOrigem : [...agrupadas[estagioDestino]];

  const indiceOrigem = normalizarIndice(movimento.source.index, Math.max(listaOrigem.length - 1, 0));
  const [oportunidadeRetirada] = listaOrigem.splice(indiceOrigem, 1);

  if (!oportunidadeRetirada || oportunidadeRetirada.id !== movimento.draggableId) {
    const indicePorId = listaOrigem.findIndex((item) => item.id === movimento.draggableId);
    if (indicePorId < 0) {
      return {
        proximaLista: listaAtual,
        oportunidadeMovida: null,
        estagioOrigem: null,
        estagioDestino: null,
      };
    }

    const [encontradaPorId] = listaOrigem.splice(indicePorId, 1);
    if (!encontradaPorId) {
      return {
        proximaLista: listaAtual,
        oportunidadeMovida: null,
        estagioOrigem: null,
        estagioDestino: null,
      };
    }

    const alterouEtapaPorId = estagioOrigem !== estagioDestino;
    const agoraIsoPorId = new Date().toISOString();
    const oportunidadeMovidaPorId: OportunidadeListagem = alterouEtapaPorId
      ? {
          ...encontradaPorId,
          estagio: estagioDestino,
          dataFechamento: etapasEncerradas.includes(estagioDestino) ? agoraIsoPorId : null,
          atualizadoEm: agoraIsoPorId,
        }
      : encontradaPorId;

    const indiceDestinoPorId = normalizarIndice(movimento.destination.index, listaDestino.length);
    listaDestino.splice(indiceDestinoPorId, 0, oportunidadeMovidaPorId);

    const proximaLista = ordenarPorEtapa({
      ...agrupadas,
      [estagioOrigem]: listaOrigem,
      [estagioDestino]: listaDestino,
    });

    return {
      proximaLista,
      oportunidadeMovida: oportunidadeMovidaPorId,
      estagioOrigem,
      estagioDestino,
    };
  }

  const alterouEtapa = estagioOrigem !== estagioDestino;
  const agoraIso = new Date().toISOString();
  const oportunidadeMovida: OportunidadeListagem = alterouEtapa
    ? {
        ...oportunidadeRetirada,
        estagio: estagioDestino,
        dataFechamento: etapasEncerradas.includes(estagioDestino) ? agoraIso : null,
        atualizadoEm: agoraIso,
      }
    : oportunidadeRetirada;

  const indiceDestino = normalizarIndice(movimento.destination.index, listaDestino.length);
  listaDestino.splice(indiceDestino, 0, oportunidadeMovida);

  const proximaLista = ordenarPorEtapa({
    ...agrupadas,
    [estagioOrigem]: listaOrigem,
    [estagioDestino]: listaDestino,
  });

  return {
    proximaLista,
    oportunidadeMovida,
    estagioOrigem,
    estagioDestino,
  };
}

function encontrarEtapaAnterior(etapa: EstagioFunil): EstagioFunil | null {
  const indice = etapasOrdenadas.indexOf(etapa);
  return indice > 0 ? etapasOrdenadas[indice - 1] : null;
}

function encontrarEtapaSeguinte(etapa: EstagioFunil): EstagioFunil | null {
  const indice = etapasOrdenadas.indexOf(etapa);
  return indice >= 0 && indice < etapasOrdenadas.length - 1 ? etapasOrdenadas[indice + 1] : null;
}

function CartaoOportunidade({
  oportunidade,
  aoMover,
  isDragging,
}: {
  oportunidade: OportunidadeListagem;
  aoMover: (oportunidadeId: string, estagio: EstagioFunil) => void;
  isDragging: boolean;
}) {
  const etapaAnterior = encontrarEtapaAnterior(oportunidade.estagio);
  const etapaSeguinte = encontrarEtapaSeguinte(oportunidade.estagio);

  return (
    <Card
      className={`group border border-border bg-background/90 p-4 shadow-sm transition-all duration-200 ${
        isDragging
          ? "rotate-1 scale-[1.01] shadow-2xl ring-2 ring-primary/30"
          : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground opacity-70" />
              <h3 className="font-semibold text-foreground leading-tight">{oportunidade.titulo}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{oportunidade.clienteFantasia || oportunidade.clienteNome}</p>
          </div>

          <Badge className={configuracaoEtapa[oportunidade.estagio].chip} variant="secondary">
            {configuracaoEtapa[oportunidade.estagio].titulo}
          </Badge>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Valor</span>
            <span className="font-semibold text-foreground">{formatarMoedaBrasileira(oportunidade.valor)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Fechamento</span>
            <span className="text-sm text-foreground">{formatarDataCurta(oportunidade.dataFechamento)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Documento</span>
            <span className="text-sm text-foreground">{oportunidade.clienteDocumento}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => etapaAnterior && aoMover(oportunidade.id, etapaAnterior)}
            disabled={!etapaAnterior}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => etapaSeguinte && aoMover(oportunidade.id, etapaSeguinte)}
            disabled={!etapaSeguinte}
          >
            Próxima
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function FunilVendasKanban({ oportunidades, clientes }: FunilVendasKanbanProps) {
  const router = useRouter();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [contatoSelecionado, setContatoSelecionado] = useState<ClienteBuscaCRM | null>(null);
  const [oportunidadesEstado, setOportunidadesEstado] = useState<OportunidadeListagem[]>(oportunidades);
  const [isPending, startTransition] = useTransition();
  const totalContatosDisponiveis = clientes.length;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormOportunidade>({
    resolver: zodResolver(formOportunidadeSchema) as unknown as Resolver<FormOportunidade>,
    defaultValues: valoresPadrao,
  });

  const oportunidadesPorEtapa = useMemo(() => classificarOportunidades(oportunidadesEstado), [oportunidadesEstado]);

  const resumo = useMemo(() => {
    const abertas = oportunidadesEstado.filter((item) => !etapasEncerradas.includes(item.estagio));
    const ganhos = oportunidadesEstado.filter((item) => item.estagio === "GANHO");
    const perdidos = oportunidadesEstado.filter((item) => item.estagio === "PERDIDO");

    return {
      abertas: abertas.length,
      valorAberto: abertas.reduce((total, item) => total + item.valor, 0),
      ganhos: ganhos.length,
      perdidos: perdidos.length,
    };
  }, [oportunidadesEstado]);

  const limparFormulario = () => {
    reset(valoresPadrao);
    setContatoSelecionado(null);
    setDialogAberto(false);
  };

  const aoCriar = async (dados: FormOportunidade) => {
    const resultado = await criarOportunidade(dados);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return;
    }

    toast.success(resultado.mensagem);
    setOportunidadesEstado((anterior) => [resultado.oportunidade, ...anterior]);
    limparFormulario();
  };

  const persistirMovimento = (
    oportunidadeId: string,
    estagioOrigem: EstagioFunil,
    estagioDestino: EstagioFunil,
    estadoAnterior: OportunidadeListagem[]
  ) => {
    if (estagioOrigem === estagioDestino) return;

    startTransition(async () => {
      const resultado = await atualizarEstagioOportunidade(oportunidadeId, estagioDestino);

      if (!resultado.sucesso) {
        setOportunidadesEstado(estadoAnterior);
        toast.error("Erro ao mover oportunidade.");
        return;
      }

      setOportunidadesEstado((estadoAtual) =>
        estadoAtual.map((item) => (item.id === resultado.oportunidade.id ? resultado.oportunidade : item))
      );
      toast.success("Estágio atualizado com sucesso!");
    });
  };

  const moverOportunidadePorBotao = (oportunidadeId: string, estagioDestino: EstagioFunil) => {
    let snapshotAnterior: OportunidadeListagem[] = [];
    let estagioOrigemMovimento: EstagioFunil | null = null;
    let oportunidadeMovidaId: string | null = null;

    setOportunidadesEstado((anterior) => {
      snapshotAnterior = anterior;

      const agrupadas = classificarOportunidades(anterior);
      let origemEncontrada: { estagio: EstagioFunil; index: number } | null = null;

      for (const etapa of etapasOrdenadas) {
        const index = agrupadas[etapa].findIndex((item) => item.id === oportunidadeId);
        if (index >= 0) {
          origemEncontrada = { estagio: etapa, index };
          break;
        }
      }

      if (!origemEncontrada) return anterior;

      const movimento = aplicarMovimentoOportunidade(anterior, {
        draggableId: oportunidadeId,
        source: { droppableId: origemEncontrada.estagio, index: origemEncontrada.index },
        destination: { droppableId: estagioDestino, index: 0 },
      });

      if (!movimento.oportunidadeMovida || !movimento.estagioOrigem || !movimento.estagioDestino) {
        return anterior;
      }

      estagioOrigemMovimento = movimento.estagioOrigem;
      oportunidadeMovidaId = movimento.oportunidadeMovida.id;
      return movimento.proximaLista;
    });

    if (!estagioOrigemMovimento || !oportunidadeMovidaId) return;
    persistirMovimento(oportunidadeMovidaId, estagioOrigemMovimento, estagioDestino, snapshotAnterior);
  };

  const aoFinalizarDrag = (resultado: DropResult) => {
    const { destination, source, draggableId } = resultado;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    let snapshotAnterior: OportunidadeListagem[] = [];
    let estagioOrigemMovimento: EstagioFunil | null = null;
    let estagioDestinoMovimento: EstagioFunil | null = null;
    let oportunidadeMovidaId: string | null = null;

    setOportunidadesEstado((anterior) => {
      snapshotAnterior = anterior;

      const movimento = aplicarMovimentoOportunidade(anterior, {
        draggableId,
        source,
        destination,
      });

      if (!movimento.oportunidadeMovida || !movimento.estagioOrigem || !movimento.estagioDestino) {
        return anterior;
      }

      estagioOrigemMovimento = movimento.estagioOrigem;
      estagioDestinoMovimento = movimento.estagioDestino;
      oportunidadeMovidaId = movimento.oportunidadeMovida.id;
      return movimento.proximaLista;
    });

    if (!estagioOrigemMovimento || !estagioDestinoMovimento || !oportunidadeMovidaId) return;
    persistirMovimento(oportunidadeMovidaId, estagioOrigemMovimento, estagioDestinoMovimento, snapshotAnterior);
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border bg-background/85 p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" />
                Funil de Vendas
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Kanban comercial com visão de receita</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Arraste oportunidades entre as etapas ou avance com um clique. O fechamento fica visível em tempo real
                  para manter prospecção, proposta e negociação sob controle.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Base conectada: {totalContatosDisponiveis} contatos.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap xl:justify-end">
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[140px]">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Abertas</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{resumo.abertas}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[140px]">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor aberto</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatarMoedaBrasileira(resumo.valorAberto)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[140px]">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ganhos</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resumo.ganhos}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[140px]">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Perdidos</p>
                <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{resumo.perdidos}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setDialogAberto(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova oportunidade
            </Button>
            <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Atualizar quadro
            </Button>
          </div>
        </Card>

        <DragDropContext onDragEnd={aoFinalizarDrag}>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {etapasOrdenadas.map((estagio) => {
                const configuracao = configuracaoEtapa[estagio];
                const itens = oportunidadesPorEtapa[estagio];
                const valorTotal = itens.reduce((total, item) => total + item.valor, 0);

                return (
                  <Droppable key={estagio} droppableId={estagio}>
                    {(dropProvided, dropSnapshot) => (
                      <div
                        className={`w-[340px] shrink-0 rounded-2xl border bg-gradient-to-b ${configuracao.classe} ${configuracao.borda} shadow-sm transition-all ${
                          dropSnapshot.isDraggingOver ? "ring-2 ring-primary/30 shadow-lg" : ""
                        }`}
                      >
                        <div className="border-b border-border/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{configuracao.titulo}</h3>
                              <p className="text-xs text-muted-foreground">{configuracao.descricao}</p>
                            </div>
                            <Badge className={configuracao.chip} variant="secondary">
                              {itens.length}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatarMoedaBrasileira(valorTotal)}</span>
                            <span>Arraste para esta etapa</span>
                          </div>
                        </div>

                        <ScrollArea className="max-h-[640px]">
                          <div
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className={`space-y-3 p-4 transition-colors ${dropSnapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                          >
                            {itens.length === 0 ? (
                              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-foreground">Sem oportunidades</p>
                                  <p className="text-xs text-muted-foreground">Solte um card aqui ou crie uma nova oportunidade.</p>
                                </div>
                              </div>
                            ) : (
                              itens.map((oportunidade, index) => (
                                <Draggable key={oportunidade.id} draggableId={oportunidade.id} index={index}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      style={dragProvided.draggableProps.style as CSSProperties}
                                    >
                                      <CartaoOportunidade
                                        oportunidade={oportunidade}
                                        aoMover={moverOportunidadePorBotao}
                                        isDragging={dragSnapshot.isDragging}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))
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
          </div>
        </DragDropContext>
      </div>

      <Dialog
        open={dialogAberto}
        onOpenChange={(aberto) => {
          if (!aberto) limparFormulario();
          setDialogAberto(aberto);
        }}
      >
        <DialogContent className="max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle>Nova oportunidade</DialogTitle>
            <DialogDescription>
              Cadastre um negócio no funil e acompanhe a evolução comercial por etapa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(aoCriar)} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="titulo">Titulo da oportunidade</Label>
                <Controller
                  name="titulo"
                  control={control}
                  render={({ field }) => (
                    <Input id="titulo" {...field} className={errors.titulo ? "border-destructive" : ""} />
                  )}
                />
                {errors.titulo?.message && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
              </div>

              <div className="space-y-2">
                <Controller
                  name="clienteId"
                  control={control}
                  render={({ field }) => (
                    <SeletorClienteCRM
                      label="Contato"
                      clienteSelecionado={contatoSelecionado}
                      onSelecionarCliente={(cliente) => {
                        setContatoSelecionado(cliente);
                        field.onChange(cliente.id);
                      }}
                      onLimparCliente={() => {
                        setContatoSelecionado(null);
                        field.onChange("");
                      }}
                      papelFiltro="CLIENTE"
                    />
                  )}
                />
                {errors.clienteId?.message && <p className="text-xs text-destructive">{errors.clienteId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Controller
                  name="valor"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="valor"
                      type="number"
                      min={0}
                      step="0.01"
                      value={field.value || ""}
                      onChange={(evento) => field.onChange(Number(evento.target.value) || 0)}
                      className={errors.valor ? "border-destructive" : ""}
                    />
                  )}
                />
                {errors.valor?.message && <p className="text-xs text-destructive">{errors.valor.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estagio">Etapa inicial</Label>
                <Controller
                  name="estagio"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="estagio">
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {estagiosFunil.map((estagio) => (
                          <SelectItem key={estagio} value={estagio}>
                            {configuracaoEtapa[estagio].titulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataFechamento">Data de fechamento</Label>
                <Controller
                  name="dataFechamento"
                  control={control}
                  render={({ field }) => <Input id="dataFechamento" type="date" {...field} value={field.value || ""} />}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Se a oportunidade estiver em Ganho ou Perdido, a data pode ser preenchida automaticamente.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={limparFormulario}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Criar oportunidade"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
