"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TabuleiroKanban } from "@/components/os/tabuleiro-kanban";
import { ModalNovaOS } from "@/components/os/modal-nova-os";
import { OrdemServico, Cliente, StatusOS } from "@/types/os";
import { Search, Plus, AlertCircle, ListChecks, KanbanSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardOSProps {
  ordensServico: OrdemServico[];
  clientes: Cliente[];
}

export function DashboardOS({ ordensServico, clientes }: DashboardOSProps) {
  const [modalAberta, setModalAberta] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [ordens, setOrdens] = useState(ordensServico);
  const [modoVisualizacao, setModoVisualizacao] = useState<"KANBAN" | "LISTA_FINALIZADAS">("KANBAN");
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);

  // Filtrar ordens por busca
  const ordensFiltradas = ordens.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  const ordensFinalizadasEntregues = ordens.filter(
    (os) => os.status === "PRONTO" || os.status === "ENTREGUE"
  );

  const handleSalvarNovaOS = (dados: any) => {
    // Simular criação de nova OS
    const novaOS: OrdemServico = {
      id: `os-${Date.now()}`,
      numeroOS: `OS-2026-${String(ordens.length + 1).padStart(3, "0")}`,
      clienteId: dados.clienteId,
      nomeCliente:
        clientes.find((c) => c.id === dados.clienteId)?.nome || "Cliente",
      equipamento: dados.equipamento,
      marca: dados.marca,
      modelo: dados.modelo,
      numeroSerieImei: dados.numeroSerieImei,
      senhaAcesso: dados.senhaAcesso,
      checklist: {
        relatoCliente: dados.relatoCliente,
        condicaoFisica: dados.condicaoFisica || "",
        acessoriosDeixados: dados.acessoriosDeixados || "",
      },
      itensOrcamento: dados.itensOrcamento || [],
      totalOrcamento:
        dados.itensOrcamento?.reduce(
          (total: number, item: any) => total + (item.valorCobrado || 0),
          0
        ) || 0,
      status: dados.status,
      observacoesInternas: dados.observacoesInternas,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    };

    setOrdens([...ordens, novaOS]);
    console.log("Nova OS criada:", novaOS);
  };

  const handleMoverOS = (osId: string, novoStatus: StatusOS) => {
    setOrdens((prev) =>
      prev.map((os) =>
        os.id === osId
          ? {
              ...os,
              status: novoStatus,
              dataAtualizacao: new Date().toISOString(),
            }
          : os
      )
    );
  };

  const handleAbrirDetalhesOS = (os: OrdemServico) => {
    setOsSelecionada(os);
    setModalDetalhesAberto(true);
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
                      className="border-b border-slate-100 dark:border-slate-700/70 text-slate-700 dark:text-slate-200"
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
        clientes={clientes}
        onSalvar={handleSalvarNovaOS}
      />

      {/* Modal Detalhes da OS */}
      <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
        <DialogContent className="max-w-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Detalhes da OS</DialogTitle>
            <DialogDescription>
              Resumo da ordem de serviço selecionada.
            </DialogDescription>
          </DialogHeader>

          {osSelecionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cliente</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {osSelecionada.nomeCliente}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Equipamento</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {osSelecionada.equipamento}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800 md:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Relato do Cliente</p>
                  <p className="text-sm text-slate-900 dark:text-slate-100 mt-1 whitespace-pre-wrap">
                    {osSelecionada.checklist.relatoCliente || "Sem relato informado."}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {osSelecionada.status.replaceAll("_", " ")}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Valor Total</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {formatarMoeda(osSelecionada.totalOrcamento || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
