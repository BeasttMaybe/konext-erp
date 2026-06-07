"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabuleiroKanban } from "@/components/os/tabuleiro-kanban";
import { ModalNovaOS } from "@/components/os/modal-nova-os";
import { OrdemServico, StatusOS } from "@/types/os";
import { criarOrdemServico, atualizarStatusOrdemServico } from "@/app/actions/os";
import { Search, Plus, AlertCircle, ListChecks, KanbanSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardOSProps {
  ordensServico: OrdemServico[];
}

export function DashboardOS({ ordensServico }: DashboardOSProps) {
  const router = useRouter();
  const [modalAberta, setModalAberta] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"KANBAN" | "LISTA_FINALIZADAS">("KANBAN");

  // Filtrar ordens por busca
  const ordensFiltradas = ordensServico.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const ordensFinalizadasEntregues = ordensServico.filter(
    (os) => os.status === "PRONTO" || os.status === "ENTREGUE"
  );

  const handleSalvarNovaOS = async (dados: any) => {
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

  const handleMoverOS = async (osId: string, novoStatus: StatusOS) => {
    try {
      await atualizarStatusOrdemServico(osId, novoStatus);
      router.refresh();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar o status da OS.";
      toast.error(mensagem);
    }
  };

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
          onClick={() => setModoVisualizacao("KANBAN")}
          className="h-9"
        >
          <KanbanSquare className="w-4 h-4 mr-2" />
          Kanban
        </Button>
        <Button
          type="button"
          variant={modoVisualizacao === "LISTA_FINALIZADAS" ? "default" : "outline"}
          onClick={() => setModoVisualizacao("LISTA_FINALIZADAS")}
          className="h-9"
        >
          <ListChecks className="w-4 h-4 mr-2" />
          Finalizadas e Entregues (Lista)
        </Button>
      </div>

      {/* Statistics Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Total de OS
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            {ordensFiltradas.length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Aguardando Orçamento
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
            {ordensFiltradas.filter((o) => o.status === "AGUARDANDO_ORCAMENTO").length}
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Em Progresso
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
            {
              ordensFiltradas.filter(
                (o) =>
                  o.status === "EM_MANUTENCAO" ||
                  o.status === "AGUARDANDO_PECA"
              ).length
            }
          </p>
        </Card>

        <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            Entregues
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {ordensFiltradas.filter((o) => o.status === "ENTREGUE").length}
          </p>
        </Card>
      </div>

      {/* Kanban Board Container */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-6">
            {modoVisualizacao === "KANBAN"
              ? "Quadro de Ordens de Serviço"
              : "Lista de Finalizadas e Entregues"}
          </h2>

          {modoVisualizacao === "KANBAN" && ordensFiltradas.length === 0 ? (
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
                  ordensServico={ordensFiltradas}
                  onMoverOS={handleMoverOS}
                  onCartaoClick={handleAbrirDetalhesOS}
                />
              </div>
            </div>
          ) : ordensFinalizadasEntregues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                Nenhuma OS finalizada ou entregue
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3 font-medium">Nº OS</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Equipamento</th>
                    <th className="py-2 pr-3 font-medium">Orçamento</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-0 font-medium">Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {ordensFinalizadasEntregues.map((os) => (
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
                          {os.status === "ENTREGUE" ? "Entregue" : "Finalizada"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-0 text-slate-500 dark:text-slate-400">
                        {formatarDataHora(os.dataAtualizacao)}
                      </td>
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
      />
    </div>
  );
}
