"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabuleiroKanban } from "@/components/os/tabuleiro-kanban";
import { ModalReabrirOS, type ConfirmacaoReaberturaPayload } from "@/components/os/modal-reabrir-os";
import type { PendenciaFinalizacao } from "@/lib/dominio/os/regras-finalizacao";
import { ModalNovaOS } from "@/components/os/modal-nova-os";
import { ModalFinalizarOS, type ConfirmacaoFinalizacaoPayload } from "@/components/os/modal-finalizar-os";
import { ModalEntregarSemServico } from "@/components/os/modal-entregar-sem-servico";
import {
  ModalFinalizarRetornoGarantia,
  type FinalizacaoRetornoGarantiaPayload,
} from "@/components/os/modal-finalizar-retorno-garantia";
import { OrdemServico, OrdemServicoExcluida, EtapaOS, SituacaoOS } from "@/types/os";
import {
  criarOrdemServico,
  finalizarOrdemServico,
  finalizarSemServico,
  reabrirOrdemServico,
  atualizarEtapaOrdemServico,
  atualizarSituacaoOrdemServico,
} from "@/app/actions/os";
import { finalizarRetornoGarantiaOS } from "@/app/actions/garantias";
import { ehResgatePendente, HEX_ETAPA_OS, ROTULOS_ETAPA_OS } from "@/lib/dominio/os/maquina-estados";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { SemPermissaoAcao } from "@/components/ui/sem-permissao-acao";
import { Search, Plus, AlertCircle, ListChecks, KanbanSquare, ArchiveX, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardOSProps {
  activeOrderServices: OrdemServico[];
  archivedOrderServices: OrdemServico[];
  deletedOrderServices: OrdemServicoExcluida[];
  /** Quando fornecido, abre o modal de nova OS automaticamente e pré-seleciona o cliente. */
  clienteIdInicial?: string | null;
  modoInicial?: "KANBAN" | "LISTA_FINALIZADAS" | "LISTA_EXCLUIDAS";
  prazoGarantiaPadraoDias?: number;
  prazoMinimoGarantiaDias?: number;
  prazoMaximoGarantiaDias?: number;
}

type DadosNovaOS = Parameters<typeof criarOrdemServico>[0];

export function DashboardOS({
  activeOrderServices,
  archivedOrderServices,
  deletedOrderServices,
  clienteIdInicial,
  modoInicial = "KANBAN",
  prazoGarantiaPadraoDias = 90,
  prazoMinimoGarantiaDias = 1,
  prazoMaximoGarantiaDias = 365,
}: DashboardOSProps) {
  const router = useRouter();
  const [modalAberta, setModalAberta] = useState(Boolean(clienteIdInicial));
  const [buscaTexto, setBuscaTexto] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"KANBAN" | "LISTA_FINALIZADAS" | "LISTA_EXCLUIDAS">(modoInicial);
  const [osParaFinalizar, setOsParaFinalizar] = useState<OrdemServico | null>(null);
  const [osFinalizandoId, setOsFinalizandoId] = useState<string | null>(null);
  const [requerGarantiaFinalizacao, setRequerGarantiaFinalizacao] = useState(false);
  const [pendenciasFinalizacao, setPendenciasFinalizacao] = useState<PendenciaFinalizacao[]>([]);
  const [osParaReabrir, setOsParaReabrir] = useState<OrdemServico | null>(null);
  const [osReabrindoId, setOsReabrindoId] = useState<string | null>(null);
  const [osParaSemServico, setOsParaSemServico] = useState<OrdemServico | null>(null);
  const [osSemServicoProcessandoId, setOsSemServicoProcessandoId] = useState<string | null>(null);
  const [somenteSemServico, setSomenteSemServico] = useState(false);
  const resolverFinalizacaoRef = useRef<((sucesso: boolean) => void) | null>(null);
  const resolverReaberturaRef = useRef<((sucesso: boolean) => void) | null>(null);
  const resolverSemServicoRef = useRef<((sucesso: boolean) => void) | null>(null);

  // Reabrir desfaz uma entrega: a mesma permissao "os.reabrir" checada no
  // servidor (por exigirPermissao). Ocultar o botao aqui e so cosmetico.
  const podeReabrirOS = useTemPermissao("os.reabrir");
  // "Arquivar OS" (resgate) chama finalizarOrdemServico, que exige os.finalizar
  // no servidor — mesma permissao usada pra Entregar e finalizar normal.
  const podeFinalizarOS = useTemPermissao("os.finalizar");

  const filteredActiveOrders = activeOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const filteredArchivedOrders = archivedOrderServices
    .filter((os) =>
      os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
      os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
      os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
    )
    .filter((os) => !somenteSemServico || os.entregueSemServico);

  const filteredDeletedOrders = deletedOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.motivoExclusao.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  // ENTREGUE sem archivedAt ("resgate") continua no quadro (ver TabuleiroKanban),
  // nunca na lista de Finalizadas — mas ja foi entregue de verdade, entao conta
  // pro card "Entregues" e alimenta o aviso acima da lista (Fase 1C-2 follow-up,
  // Parte 4: arquivar e um passo administrativo depois da entrega, nao muda se
  // ela aconteceu).
  const ordensEntreguesNaoArquivadas = filteredActiveOrders.filter(ehResgatePendente);
  const deliveredOrdersCount = ordensEntreguesNaoArquivadas.length + filteredArchivedOrders.length;

  const handleSalvarNovaOS = async (dados: DadosNovaOS) => {
    try {
      await criarOrdemServico(dados);
      toast.success("Ordem de servico criada com sucesso.");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Nao foi possivel criar a ordem de servico.";
      toast.error(mensagem);
      throw error;
    }
  };

  const handleMoverOS = async (osId: string, novaEtapa: EtapaOS): Promise<boolean> => {
    try {
      const resultado = await atualizarEtapaOrdemServico(osId, novaEtapa);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return false;
      }
      router.refresh();
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar a etapa da OS.";
      toast.error(mensagem);
      return false;
    }
  };

  /** Marca/desmarca a situacao pelo menu do card, sem mover a OS de coluna. */
  const handleAlterarSituacao = async (osId: string, situacao: SituacaoOS | null): Promise<boolean> => {
    try {
      const resultado = await atualizarSituacaoOrdemServico(osId, situacao);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return false;
      }
      router.refresh();
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar a situacao da OS.";
      toast.error(mensagem);
      return false;
    }
  };

  const concluirSolicitacaoFinalizacao = (sucesso: boolean) => {
    resolverFinalizacaoRef.current?.(sucesso);
    resolverFinalizacaoRef.current = null;
    setRequerGarantiaFinalizacao(false);
    setPendenciasFinalizacao([]);
    setOsParaFinalizar(null);
  };

  const concluirSolicitacaoSemServico = (sucesso: boolean) => {
    resolverSemServicoRef.current?.(sucesso);
    resolverSemServicoRef.current = null;
    setOsParaSemServico(null);
  };

  /**
   * Entrega de OS: abre o dialogo certo e aguarda a decisao. OS sem nenhum
   * item vai para o encerramento sem serviço (Parte 3); com item, para a
   * finalizacao normal. O Kanban usa o retorno para reverter o movimento
   * otimista quando o operador cancela ou quando o servidor devolve pendencias.
   */
  const handleEntregarOS = async (orderService: OrdemServico): Promise<boolean> => {
    if (resolverFinalizacaoRef.current || resolverSemServicoRef.current) {
      toast.error("Ja existe uma finalizacao em andamento.");
      return false;
    }

    if ((orderService.itensOrcamento?.length ?? 0) === 0) {
      setOsParaSemServico(orderService);

      return await new Promise<boolean>((resolve) => {
        resolverSemServicoRef.current = resolve;
      });
    }

    setOsParaFinalizar(orderService);
    setRequerGarantiaFinalizacao(!orderService.ehRetornoGarantia);
    setPendenciasFinalizacao([]);

    return await new Promise<boolean>((resolve) => {
      resolverFinalizacaoRef.current = resolve;
    });
  };

  const handleReabrirOS = async (orderService: OrdemServico): Promise<boolean> => {
    if (resolverReaberturaRef.current) {
      return false;
    }

    setOsParaReabrir(orderService);

    return await new Promise<boolean>((resolve) => {
      resolverReaberturaRef.current = resolve;
    });
  };

  const concluirSolicitacaoReabertura = (sucesso: boolean) => {
    resolverReaberturaRef.current?.(sucesso);
    resolverReaberturaRef.current = null;
    setOsParaReabrir(null);
  };

  const confirmarReaberturaOS = async (payload: ConfirmacaoReaberturaPayload) => {
    if (!osParaReabrir || osReabrindoId) {
      return;
    }

    try {
      setOsReabrindoId(osParaReabrir.id);

      const resultado = await reabrirOrdemServico({
        osId: osParaReabrir.id,
        motivo: payload.motivo,
        estagioDestino: payload.estagioDestino,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        concluirSolicitacaoReabertura(false);
        return;
      }

      toast.success(`OS ${osParaReabrir.numeroOS} reaberta.`);
      router.refresh();
      concluirSolicitacaoReabertura(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel reabrir a OS.");
      concluirSolicitacaoReabertura(false);
    } finally {
      setOsReabrindoId(null);
    }
  };

  const confirmarFinalizacaoOS = async (payload?: ConfirmacaoFinalizacaoPayload) => {
    if (!osParaFinalizar || osFinalizandoId) {
      return;
    }

    try {
      setOsFinalizandoId(osParaFinalizar.id);

      const resultado = await finalizarOrdemServico({
        osId: osParaFinalizar.id,
        prazoGarantiaDias: payload?.prazoGarantiaDias ?? null,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        // Mantem o dialogo aberto mostrando a lista completa de bloqueios em vez
        // de fechar com um toast solto (AUDIT_REPORT 16.7-f).
        setPendenciasFinalizacao(resultado.pendencias ?? []);
        return;
      }

      setModoVisualizacao("LISTA_FINALIZADAS");
      if (resultado.garantiaGerada) {
        toast.success(`OS ${osParaFinalizar.numeroOS} finalizada com garantia gerada.`);
      } else {
        toast.success(`OS ${osParaFinalizar.numeroOS} finalizada com sucesso.`);
      }
      router.refresh();
      concluirSolicitacaoFinalizacao(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel finalizar a ordem de servico.";
      toast.error(message);
      concluirSolicitacaoFinalizacao(false);
    } finally {
      setOsFinalizandoId(null);
    }
  };

  const confirmarSemServicoOS = async (motivo: string) => {
    if (!osParaSemServico || osSemServicoProcessandoId) {
      return;
    }

    try {
      setOsSemServicoProcessandoId(osParaSemServico.id);

      const resultado = await finalizarSemServico({ osId: osParaSemServico.id, motivo });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        concluirSolicitacaoSemServico(false);
        return;
      }

      setModoVisualizacao("LISTA_FINALIZADAS");
      toast.success(resultado.mensagem);
      router.refresh();
      concluirSolicitacaoSemServico(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel encerrar a OS sem servico.";
      toast.error(message);
      concluirSolicitacaoSemServico(false);
    } finally {
      setOsSemServicoProcessandoId(null);
    }
  };

  const cancelarSemServicoOS = () => {
    if (osSemServicoProcessandoId) {
      return;
    }

    concluirSolicitacaoSemServico(false);
  };

  const confirmarFinalizacaoRetornoOS = async (dados: FinalizacaoRetornoGarantiaPayload) => {
    if (!osParaFinalizar || osFinalizandoId) {
      return;
    }

    if (!osParaFinalizar.retornoGarantiaId) {
      toast.error("OS de retorno sem vinculo de garantia.");
      concluirSolicitacaoFinalizacao(false);
      return;
    }

    try {
      setOsFinalizandoId(osParaFinalizar.id);
      const resultado = await finalizarRetornoGarantiaOS({
        retornoGarantiaId: osParaFinalizar.retornoGarantiaId,
        ...dados,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        concluirSolicitacaoFinalizacao(false);
        return;
      }

      setModoVisualizacao("LISTA_FINALIZADAS");
      toast.success(`Retorno da ${osParaFinalizar.numeroOS} finalizado com sucesso.`);
      router.refresh();
      concluirSolicitacaoFinalizacao(true);
    } catch {
      toast.error("Nao foi possivel finalizar o retorno de garantia.");
      concluirSolicitacaoFinalizacao(false);
    } finally {
      setOsFinalizandoId(null);
    }
  };

  const handleFinalizarOS = async (orderService: OrdemServico): Promise<boolean> => {
    if (resolverFinalizacaoRef.current) {
      toast.error("Ja existe uma finalizacao em andamento.");
      return false;
    }

    setOsParaFinalizar(orderService);
    setRequerGarantiaFinalizacao(false);

    return await new Promise<boolean>((resolve) => {
      resolverFinalizacaoRef.current = resolve;
    });
  };

  const cancelarFinalizacaoOS = () => {
    if (osFinalizandoId) {
      return;
    }

    concluirSolicitacaoFinalizacao(false);
  };

  const finalizacaoEhRetornoGarantia =
    Boolean(osParaFinalizar?.ehRetornoGarantia) && osParaFinalizar?.status !== "ENTREGUE";

  const handleAbrirDetalhesOS = (os: OrdemServico) => {
    router.push(`/os/${os.id}`);
  };

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);

  const formatarDataHora = (dataISO: string) =>
    new Date(dataISO).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="w-full space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº OS, cliente ou equipamento..."
            className="pl-10 h-10"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setModalAberta(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Ordem de Serviço
        </Button>
      </div>

      {/* Modo de visualização */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={modoVisualizacao === "KANBAN" ? "default" : "outline"}
          onClick={() => {
            setModoVisualizacao("KANBAN");
            router.push("/os?modo=kanban");
          }}
          className="h-9"
        >
          <KanbanSquare className="w-4 h-4 mr-2" />
          Kanban
        </Button>
        <Button
          type="button"
          variant={modoVisualizacao === "LISTA_FINALIZADAS" ? "default" : "outline"}
          onClick={() => {
            setModoVisualizacao("LISTA_FINALIZADAS");
            router.push("/os?modo=lista");
          }}
          className="h-9"
        >
          <ListChecks className="w-4 h-4 mr-2" />
          Finalizadas e Entregues (Lista)
        </Button>
        <Button
          type="button"
          variant={modoVisualizacao === "LISTA_EXCLUIDAS" ? "default" : "outline"}
          onClick={() => {
            setModoVisualizacao("LISTA_EXCLUIDAS");
            router.push("/os?modo=excluidas");
          }}
          className="h-9"
        >
          <ArchiveX className="w-4 h-4 mr-2" />
          Excluídas
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/os/garantias")}
          className="h-9"
        >
          Garantias
        </Button>
      </div>

      {/* Statistics Cards - segue as 4 etapas (Fase 1C-3, Parte 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            {ROTULOS_ETAPA_OS.ORCAMENTO}
          </p>
          <p className="text-2xl sm:text-3xl font-bold" style={{ color: HEX_ETAPA_OS.ORCAMENTO }}>
            {filteredActiveOrders.filter((o) => o.etapa === "ORCAMENTO").length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            {ROTULOS_ETAPA_OS.CONSERTO}
          </p>
          <p className="text-2xl sm:text-3xl font-bold" style={{ color: HEX_ETAPA_OS.CONSERTO }}>
            {filteredActiveOrders.filter((o) => o.etapa === "CONSERTO").length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            {ROTULOS_ETAPA_OS.PRONTO}
          </p>
          <p className="text-2xl sm:text-3xl font-bold" style={{ color: HEX_ETAPA_OS.PRONTO }}>
            {filteredActiveOrders.filter((o) => o.etapa === "PRONTO").length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            {ROTULOS_ETAPA_OS.ENTREGUE}
          </p>
          <p className="text-2xl sm:text-3xl font-bold" style={{ color: HEX_ETAPA_OS.ENTREGUE }}>
            {deliveredOrdersCount}
          </p>
        </Card>
      </div>

      {/* Kanban Board Container */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-6">
            {modoVisualizacao === "KANBAN"
              ? "Quadro de Ordens de Serviço"
              : modoVisualizacao === "LISTA_FINALIZADAS"
                ? "Lista de Finalizadas e Entregues"
                : "Lista de Ordens de Serviço Excluídas"}
          </h2>

          {modoVisualizacao === "KANBAN" && filteredActiveOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                Nenhuma ordem de serviço encontrada
              </p>
              <p className="text-sm text-slate-400 mt-2">
                {buscaTexto
                  ? "Tente ajustar sua busca"
                  : "Clique em 'Nova Ordem de Serviço' para começar"}
              </p>
            </div>
          ) : modoVisualizacao === "KANBAN" ? (
            <div className="px-0">
                <TabuleiroKanban
                  ordensServico={filteredActiveOrders}
                  onMoverOS={handleMoverOS}
                  onAlterarSituacao={handleAlterarSituacao}
                  onCartaoClick={handleAbrirDetalhesOS}
                  onFinalizarOS={handleFinalizarOS}
                  onEntregarOS={handleEntregarOS}
                  onReabrirOS={podeReabrirOS ? handleReabrirOS : undefined}
                  podeArquivarOS={podeFinalizarOS}
                />
            </div>
          ) : modoVisualizacao === "LISTA_FINALIZADAS" ? (
            <div className="overflow-x-auto">
              {/* O filtro nunca pode depender do resultado que ele mesmo produz —
                  renderizado sempre que a lista esta ativa, nunca condicionado a
                  filteredArchivedOrders (Fase 1C-2 follow-up, Parte 3). Antes disso,
                  marcar a caixa e zerar a lista escondia a propria caixa e travava
                  o operador no filtro sem jeito de voltar. */}
              {ordensEntreguesNaoArquivadas.length > 0 && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  {ordensEntreguesNaoArquivadas.length === 1
                    ? "1 OS entregue ainda não arquivada"
                    : `${ordensEntreguesNaoArquivadas.length} OS entregues ainda não arquivadas`}
                  {" — "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300"
                    onClick={() => {
                      setModoVisualizacao("KANBAN");
                      router.push("/os?modo=kanban");
                    }}
                  >
                    veja no quadro
                  </button>
                  .
                </p>
              )}
              <label className="mb-3 flex w-fit items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={somenteSemServico}
                  onChange={(evento) => setSomenteSemServico(evento.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                Mostrar só entregues sem serviço
              </label>

              {filteredArchivedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">
                    {somenteSemServico
                      ? "Nenhuma OS entregue sem serviço neste período."
                      : "Nenhuma OS finalizada ou entregue"}
                  </p>
                  {somenteSemServico && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setSomenteSemServico(false)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar filtro
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full min-w-[840px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3 font-medium">Nº OS</th>
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 font-medium">Equipamento</th>
                      <th className="py-2 pr-3 font-medium">Orçamento</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Atualizado em</th>
                      <th className="py-2 pr-0 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchivedOrders.map((os) => (
                      <tr
                        key={os.id}
                        className="border-b border-slate-100 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        onClick={() => handleAbrirDetalhesOS(os)}
                      >
                        <td className="py-3 pr-3 font-semibold">{os.numeroOS}</td>
                        <td className="py-3 pr-3">{os.nomeCliente}</td>
                        <td className="py-3 pr-3">{os.equipamento}</td>
                        <td className="py-3 pr-3">{formatarMoeda(os.totalOrcamento)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Finalizada
                            </Badge>
                            {os.entregueSemServico && (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-700 dark:text-amber-300"
                                title={os.motivoSemServico}
                              >
                                Entregue sem serviço
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                          {formatarDataHora(os.dataAtualizacao)}
                        </td>
                        <td className="py-3 pr-0 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {podeReabrirOS ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={(evento) => {
                                  evento.stopPropagation();
                                  void handleReabrirOS(os);
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reabrir OS
                              </Button>
                            ) : (
                              <SemPermissaoAcao />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : filteredDeletedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                Nenhuma ordem de serviço excluída encontrada.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3 font-medium">Nº OS</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Equipamento</th>
                    <th className="py-2 pr-3 font-medium">Orçamento</th>
                    <th className="py-2 pr-3 font-medium">Status anterior</th>
                    <th className="py-2 pr-3 font-medium">Excluída por</th>
                    <th className="py-2 pr-3 font-medium">Motivo da exclusão</th>
                    <th className="py-2 pr-3 font-medium">Excluída em</th>
                    <th className="py-2 pr-0 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletedOrders.map((os) => (
                    <tr
                      key={os.id}
                      className="border-b border-slate-100 dark:border-slate-700/70 text-slate-700 dark:text-slate-200"
                    >
                      <td className="py-3 pr-3 font-semibold">{os.numeroOS}</td>
                      <td className="py-3 pr-3">{os.nomeCliente}</td>
                      <td className="py-3 pr-3">{os.equipamento}</td>
                      <td className="py-3 pr-3">{formatarMoeda(os.totalOrcamento)}</td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline">{os.statusAnterior}</Badge>
                      </td>
                      <td className="py-3 pr-3">{os.excluidaPor}</td>
                      <td className="py-3 pr-3 max-w-[320px] truncate" title={os.motivoExclusao}>
                        {os.motivoExclusao}
                      </td>
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                        {formatarDataHora(os.excluidaEm)}
                      </td>
                      <td className="py-3 pr-0 text-right text-xs text-slate-500">Somente leitura</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Modal Nova OS */}
      <ModalNovaOS
        aberta={modalAberta}
        onAbrirMudar={setModalAberta}
        onSalvar={handleSalvarNovaOS}
        clienteIdInicial={clienteIdInicial ?? undefined}
      />

      {finalizacaoEhRetornoGarantia ? (
        <ModalFinalizarRetornoGarantia
          key={`${osParaFinalizar?.id ?? "sem-os"}-${Boolean(osParaFinalizar)}-retorno`}
          aberta={Boolean(osParaFinalizar)}
          onAbrirMudar={(aberta) => {
            if (!aberta) {
              cancelarFinalizacaoOS();
            }
          }}
          os={osParaFinalizar}
          processando={Boolean(osFinalizandoId)}
          onConfirmar={confirmarFinalizacaoRetornoOS}
        />
      ) : (
        <ModalFinalizarOS
          key={`${osParaFinalizar?.id ?? "sem-os"}-${Boolean(osParaFinalizar)}`}
          aberta={Boolean(osParaFinalizar)}
          onAbrirMudar={(aberta) => {
            if (!aberta) {
              cancelarFinalizacaoOS();
            }
          }}
          os={osParaFinalizar}
          processando={Boolean(osFinalizandoId)}
          exigePrazoGarantia={requerGarantiaFinalizacao}
          prazoPadraoDias={prazoGarantiaPadraoDias}
          prazoMinimoDias={prazoMinimoGarantiaDias}
          prazoMaximoDias={prazoMaximoGarantiaDias}
          pendencias={pendenciasFinalizacao}
          onConfirmar={confirmarFinalizacaoOS}
        />
      )}

      <ModalEntregarSemServico
        key={`${osParaSemServico?.id ?? "sem-os"}-sem-servico`}
        aberta={Boolean(osParaSemServico)}
        onAbrirMudar={(aberta) => {
          if (!aberta) {
            cancelarSemServicoOS();
          }
        }}
        os={osParaSemServico}
        processando={Boolean(osSemServicoProcessandoId)}
        onConfirmar={confirmarSemServicoOS}
      />

      <ModalReabrirOS
        key={osParaReabrir?.id ?? "sem-os-reabrir"}
        aberta={Boolean(osParaReabrir)}
        onAbrirMudar={(aberta) => {
          if (!aberta && !osReabrindoId) {
            concluirSolicitacaoReabertura(false);
          }
        }}
        os={osParaReabrir}
        processando={Boolean(osReabrindoId)}
        onConfirmar={confirmarReaberturaOS}
      />
    </div>
  );
}
