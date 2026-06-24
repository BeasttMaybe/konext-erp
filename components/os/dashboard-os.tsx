"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { TabuleiroKanban } from "@/components/os/tabuleiro-kanban";
import { ModalNovaOS } from "@/components/os/modal-nova-os";
import { ModalFinalizarOS, type ConfirmacaoFinalizacaoPayload } from "@/components/os/modal-finalizar-os";
import {
  ModalFinalizarRetornoGarantia,
  type FinalizacaoRetornoGarantiaPayload,
} from "@/components/os/modal-finalizar-retorno-garantia";
import { OrdemServico, OrdemServicoExcluida, StatusOS } from "@/types/os";
import {
  archiveDeliveredOrderService,
  criarOrdemServico,
  excluirOrdemServico,
  gerarGarantiaEFinalizarOS,
  atualizarStatusOrdemServico,
} from "@/app/actions/os";
import { finalizarRetornoGarantiaOS } from "@/app/actions/garantias";
import { Search, Plus, AlertCircle, ListChecks, KanbanSquare, Trash2, ArchiveX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DashboardOSProps {
  activeOrderServices: OrdemServico[];
  archivedOrderServices: OrdemServico[];
  deletedOrderServices: OrdemServicoExcluida[];
  /** Quando fornecido, abre o modal de nova OS automaticamente e pré-seleciona o cliente. */
  clienteIdInicial?: string | null;
  modoInicial?: "KANBAN" | "LISTA_FINALIZADAS" | "LISTA_EXCLUIDAS";
}

type DadosNovaOS = Parameters<typeof criarOrdemServico>[0];

export function DashboardOS({
  activeOrderServices,
  archivedOrderServices,
  deletedOrderServices,
  clienteIdInicial,
  modoInicial = "KANBAN",
}: DashboardOSProps) {
  const router = useRouter();
  const [modalAberta, setModalAberta] = useState(Boolean(clienteIdInicial));
  const [buscaTexto, setBuscaTexto] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"KANBAN" | "LISTA_FINALIZADAS" | "LISTA_EXCLUIDAS">(modoInicial);
  const [osParaExcluir, setOsParaExcluir] = useState<OrdemServico | null>(null);
  const [osExcluindoId, setOsExcluindoId] = useState<string | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [osParaFinalizar, setOsParaFinalizar] = useState<OrdemServico | null>(null);
  const [osFinalizandoId, setOsFinalizandoId] = useState<string | null>(null);
  const [requerGarantiaFinalizacao, setRequerGarantiaFinalizacao] = useState(false);
  const resolverFinalizacaoRef = useRef<((sucesso: boolean) => void) | null>(null);

  const filteredActiveOrders = activeOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const filteredArchivedOrders = archivedOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const filteredDeletedOrders = deletedOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.motivoExclusao.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const totalAbertas = filteredActiveOrders.filter((orderService) => orderService.status !== "ENTREGUE").length;
  const deliveredOrdersCount = filteredArchivedOrders.length;

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

  const handleMoverOS = async (osId: string, novoStatus: StatusOS): Promise<boolean> => {
    try {
      await atualizarStatusOrdemServico(osId, novoStatus);
      router.refresh();
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar o status da OS.";
      toast.error(mensagem);
      return false;
    }
  };

  const concluirSolicitacaoFinalizacao = (sucesso: boolean) => {
    resolverFinalizacaoRef.current?.(sucesso);
    resolverFinalizacaoRef.current = null;
    setRequerGarantiaFinalizacao(false);
    setOsParaFinalizar(null);
  };

  const confirmarFinalizacaoOS = async (payload?: ConfirmacaoFinalizacaoPayload) => {
    if (!osParaFinalizar || osFinalizandoId) {
      return;
    }

    try {
      setOsFinalizandoId(osParaFinalizar.id);

      const resultado = requerGarantiaFinalizacao
        ? await gerarGarantiaEFinalizarOS({
            osId: osParaFinalizar.id,
            prazoGarantiaDias: Number(payload?.prazoGarantiaDias ?? 0),
          })
        : await archiveDeliveredOrderService({
            osId: osParaFinalizar.id,
          });

      if (!resultado.sucesso) {
        if (resultado.requerGarantia) {
          setRequerGarantiaFinalizacao(true);
        }
        toast.error(resultado.erro);
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

  const handleAbrirDetalhesOS = (os: OrdemServico) => {
    router.push(`/os/${os.id}`);
  };

  const handleExcluirOS = async () => {
    if (!osParaExcluir || osExcluindoId) {
      return;
    }

    try {
      setOsExcluindoId(osParaExcluir.id);

      const motivoNormalizado = motivoExclusao.trim();

      if (motivoNormalizado.length < 5) {
        toast.error("Informe o motivo da exclusão.");
        return;
      }

      const resultado = await excluirOrdemServico({
        osId: osParaExcluir.id,
        motivoExclusao: motivoNormalizado,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem);
      setOsParaExcluir(null);
      setMotivoExclusao("");
      router.push("/os?modo=excluidas");
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir a OS. Tente novamente.");
    } finally {
      setOsExcluindoId(null);
    }
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

      {/* Statistics Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            OS Abertas
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            {totalAbertas}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Aguardando Orçamento
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
            {filteredActiveOrders.filter((o) => o.status === "AGUARDANDO_ORCAMENTO").length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Em Progresso
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
            {
              filteredActiveOrders.filter(
                (o) =>
                  o.status === "EM_MANUTENCAO" ||
                  o.status === "AGUARDANDO_PECA" ||
                  o.status === "GARANTIA_RETORNO"
              ).length
            }
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Entregues
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
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
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <div className="px-4 sm:px-6">
                <TabuleiroKanban
                  ordensServico={filteredActiveOrders}
                  onMoverOS={handleMoverOS}
                  onCartaoClick={handleAbrirDetalhesOS}
                  onFinalizarOS={handleFinalizarOS}
                />
              </div>
            </div>
          ) : modoVisualizacao === "LISTA_FINALIZADAS" && filteredArchivedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                Nenhuma OS finalizada ou entregue
              </p>
            </div>
          ) : modoVisualizacao === "LISTA_FINALIZADAS" ? (
            <div className="overflow-x-auto">
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
                        <Badge
                          className={
                            os.status === "ENTREGUE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          }
                        >
                          Finalizada
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                        {formatarDataHora(os.dataAtualizacao)}
                      </td>
                      <td className="py-3 pr-0 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                          title="Excluir OS"
                          aria-label="Excluir OS"
                          disabled={Boolean(osExcluindoId)}
                          onClick={(evento) => {
                            evento.stopPropagation();
                            setOsParaExcluir(os);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {osParaFinalizar?.ehRetornoGarantia ? (
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
          requerGarantia={requerGarantiaFinalizacao}
          onConfirmar={confirmarFinalizacaoOS}
        />
      )}

      <AlertDialog
        open={Boolean(osParaExcluir)}
        onOpenChange={(aberto) => {
          if (!aberto && !osExcluindoId) {
            setOsParaExcluir(null);
            setMotivoExclusao("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              {`Tem certeza que deseja excluir a OS ${osParaExcluir?.numeroOS ?? "selecionada"}? Essa ação não poderá ser desfeita pela tela atual.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-exclusao">Motivo da exclusão</Label>
            <Textarea
              id="motivo-exclusao"
              value={motivoExclusao}
              onChange={(evento) => setMotivoExclusao(evento.target.value)}
              placeholder="Ex: OS criada em duplicidade, cliente cancelou, erro no cadastro..."
              minLength={5}
              maxLength={500}
              disabled={Boolean(osExcluindoId)}
            />
            <p className="text-xs text-slate-500">
              {motivoExclusao.trim().length}/500 caracteres
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(osExcluindoId)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(osExcluindoId) || motivoExclusao.trim().length < 5}
              onClick={(evento) => {
                evento.preventDefault();
                void handleExcluirOS();
              }}
            >
              {osExcluindoId ? "Excluindo..." : "Excluir OS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
