"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CartaoKPIFinanceiro } from "@/components/financeiro/cartao-kpi-financeiro";
import { TabelaContasAPagar } from "@/components/financeiro/tabela-contas-a-pagar";
import { ModalNovaContaAPagar } from "@/components/financeiro/modal-nova-conta-a-pagar";
import { ModalNovoRecebimento } from "@/components/financeiro/modal-novo-recebimento";
import { mockContasAPagar } from "@/dados/mock-contas-a-pagar";
import { ContaAPagar, StatusConta } from "@/types/financeiro";
import type {
  FormContaAPagar,
  FormContaAReceber,
} from "@/lib/validations/financeiro";

/**
 * Página do módulo Financeiro
 * Gestão de Contas a Pagar e Contas a Receber
 */
export default function FinanceiroPage() {
  const [contas, setContas] = useState<ContaAPagar[]>(mockContasAPagar);
  const [recebimentos, setRecebimentos] = useState<
    Array<{
      id: string;
      valor: number;
      dataVencimento: string;
      status: "PENDENTE" | "RECEBIDO" | "ATRASADO";
    }>
  >([]);
  const [abaAtiva, setAbaAtiva] = useState<"contas-a-pagar" | "contas-a-receber">(
    "contas-a-pagar"
  );
  const [modalContaAberta, setModalContaAberta] = useState(false);
  const [modalRecebimentoAberta, setModalRecebimentoAberta] = useState(false);

  // Cálculo dos KPIs
  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];

    const totalPendente = contas
      .filter((c) => c.status === "PENDENTE")
      .reduce((acc, c) => acc + c.valor, 0);

    const venceHoje = contas
      .filter((c) => c.status === "PENDENTE" && c.dataVencimento === hoje)
      .reduce((acc, c) => acc + c.valor, 0);

    const totalAtrasado = contas
      .filter((c) => c.status === "ATRASADO")
      .reduce((acc, c) => acc + c.valor, 0);

    return { totalPendente, venceHoje, totalAtrasado };
  }, [contas]);

  const kpisRecebimentos = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];

    const totalAReceber = recebimentos
      .filter((r) => r.status === "PENDENTE")
      .reduce((acc, r) => acc + r.valor, 0);

    const venceHoje = recebimentos
      .filter((r) => r.status === "PENDENTE" && r.dataVencimento === hoje)
      .reduce((acc, r) => acc + r.valor, 0);

    const totalAtrasado = recebimentos
      .filter((r) => r.status === "ATRASADO")
      .reduce((acc, r) => acc + r.valor, 0);

    return { totalAReceber, venceHoje, totalAtrasado };
  }, [recebimentos]);

  // Marcar conta como paga
  const aoMarcarPago = (id: string, status: string) => {
    setContas((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: status as StatusConta,
              dataPagamento: new Date().toISOString().split("T")[0],
            }
          : c
      )
    );
  };

  // Deletar conta
  const aoDeletar = (id: string) => {
    setContas((prev) => prev.filter((c) => c.id !== id));
  };

  // Salvar nova conta a pagar
  const aoSalvarConta = (dados: FormContaAPagar) => {
    const novaConta: ContaAPagar = {
      id: `conta-${Date.now()}`,
      descricao: dados.descricao,
      fornecedor: dados.fornecedorId || "Fornecedor não identificado",
      valor: Number(dados.valor),
      dataVencimento:
        dados.dataVencimento instanceof Date
          ? dados.dataVencimento.toISOString().split("T")[0]
          : String(dados.dataVencimento),
      status: "PENDENTE",
      categoria: dados.planoContaId || "Geral",
    };
    setContas((prev) => [novaConta, ...prev]);
    setModalContaAberta(false);
  };

  // Salvar novo recebimento
  const aoSalvarRecebimento = (dados: FormContaAReceber) => {
    const hoje = new Date().toISOString().split("T")[0];
    const dataVencimento =
      dados.dataVencimento instanceof Date
        ? dados.dataVencimento.toISOString().split("T")[0]
        : String(dados.dataVencimento);

    const status: "PENDENTE" | "ATRASADO" =
      dataVencimento < hoje ? "ATRASADO" : "PENDENTE";

    setRecebimentos((prev) => [
      {
        id: `rec-${Date.now()}`,
        valor: Number(dados.valor),
        dataVencimento,
        status,
      },
      ...prev,
    ]);

    setModalRecebimentoAberta(false);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Cabeçalho */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Financeiro
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Gestão de contas a pagar, recebimentos e fluxo de caixa
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary">
              <Link href="/financeiro/avancado">
                <BarChart3 className="h-4 w-4 mr-2" />
                Inteligencia Financeira
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalRecebimentoAberta(true)}
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Novo Recebimento
            </Button>
            <Button onClick={() => setModalContaAberta(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta a Pagar
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* KPIs por aba */}
            {abaAtiva === "contas-a-pagar" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CartaoKPIFinanceiro
                  titulo="Total Pendente"
                  valor={kpis.totalPendente}
                  icone="relogio"
                  cor="azul"
                />
                <CartaoKPIFinanceiro
                  titulo="Vence Hoje"
                  valor={kpis.venceHoje}
                  icone="alerta"
                  cor="laranja"
                />
                <CartaoKPIFinanceiro
                  titulo="Atrasado"
                  valor={kpis.totalAtrasado}
                  icone="x"
                  cor="vermelho"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CartaoKPIFinanceiro
                  titulo="Total a Receber"
                  valor={kpisRecebimentos.totalAReceber}
                  icone="relogio"
                  cor="azul"
                />
                <CartaoKPIFinanceiro
                  titulo="Vence Hoje"
                  valor={kpisRecebimentos.venceHoje}
                  icone="alerta"
                  cor="laranja"
                />
                <CartaoKPIFinanceiro
                  titulo="Atrasado"
                  valor={kpisRecebimentos.totalAtrasado}
                  icone="x"
                  cor="vermelho"
                />
              </div>
            )}

            {/* Abas */}
            <Tabs
              value={abaAtiva}
              onValueChange={(v) =>
                setAbaAtiva(v as "contas-a-pagar" | "contas-a-receber")
              }
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="contas-a-pagar">
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Contas a Pagar
                </TabsTrigger>
                <TabsTrigger value="contas-a-receber">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Contas a Receber
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contas-a-pagar" className="mt-6">
                <TabelaContasAPagar
                  contas={contas}
                  aoMarcarPago={aoMarcarPago}
                  aoDeletar={aoDeletar}
                />
              </TabsContent>

              <TabsContent value="contas-a-receber" className="mt-6">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                  <DollarSign className="h-10 w-10 mx-auto text-zinc-400 mb-3" />
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Use o botão <strong>Novo Recebimento</strong> para registrar
                    contas a receber.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Modais */}
      <ModalNovaContaAPagar
        aberto={modalContaAberta}
        aoFechar={() => setModalContaAberta(false)}
        aoSalvar={aoSalvarConta}
      />
      <ModalNovoRecebimento
        aberto={modalRecebimentoAberta}
        aoFechar={() => setModalRecebimentoAberta(false)}
        aoSalvar={aoSalvarRecebimento}
      />
    </div>
  );
}
