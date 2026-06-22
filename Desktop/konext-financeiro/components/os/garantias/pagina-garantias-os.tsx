"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FiltrosGarantias } from "@/components/os/garantias/filtros-garantias";
import { TabelaGarantias } from "@/components/os/garantias/tabela-garantias";
import { DashboardGarantias } from "@/components/os/garantias/dashboard-garantias";
import {
  listarGarantiasOS,
  obterDashboardGarantiasOS,
  type DashboardGarantiasOS,
  type FiltrosGarantiaInput,
  type LinhaGarantiaOS,
} from "@/app/actions/garantias";
import Link from "next/link";

const dashboardVazio: DashboardGarantiasOS = {
  garantiasAtivas: 0,
  vencemEm7Dias: 0,
  garantiasVencidas: 0,
  comRetorno: 0,
  taxaRetorno: 0,
  valorEmGarantia: 0,
  principaisServicosEmRetorno: [],
  pecasComMaisRetorno: [],
};

const filtrosIniciais: FiltrosGarantiaInput = {
  busca: "",
  status: "TODAS",
  retorno: "TODAS",
  pagina: 1,
  tamanhoPagina: 20,
};

export function PaginaGarantiasOS() {
  const [filtros, setFiltros] = useState<FiltrosGarantiaInput>(filtrosIniciais);
  const [linhas, setLinhas] = useState<LinhaGarantiaOS[]>([]);
  const [dashboard, setDashboard] = useState<DashboardGarantiasOS>(dashboardVazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const carregamentoInicialExecutado = useRef(false);

  const carregar = async (proximosFiltros: FiltrosGarantiaInput) => {
    setCarregando(true);
    setErro(null);

    try {
      const [resumo, listagem] = await Promise.all([
        obterDashboardGarantiasOS(),
        listarGarantiasOS(proximosFiltros),
      ]);

      setDashboard(resumo);

      if (!listagem.sucesso) {
        setErro(listagem.erro);
        setLinhas([]);
        return;
      }

      setLinhas(listagem.dados);
    } catch {
      setErro("Não foi possível carregar as garantias.");
      setLinhas([]);
      setDashboard(dashboardVazio);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (carregamentoInicialExecutado.current) return;
    carregamentoInicialExecutado.current = true;
    void carregar(filtrosIniciais);
  }, []);

  const aoAtualizarFiltros = (novos: FiltrosGarantiaInput) => {
    setFiltros(novos);
    void carregar(novos);
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Garantias</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Gestão de termos de garantia, vencimentos, retornos e histórico técnico.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/os">Hub Central</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/os?modo=kanban">Kanban</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/os?modo=lista">Finalizadas</Link>
            </Button>
            <Button asChild>
              <Link href="/os/garantias">Garantias</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <DashboardGarantias dados={dashboard} />
          <FiltrosGarantias filtros={filtros} onChange={aoAtualizarFiltros} />

          {erro ? (
            <Card className="p-4 border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-200">{erro}</p>
            </Card>
          ) : carregando ? (
            <Card className="p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Carregando garantias...</p>
            </Card>
          ) : (
            <TabelaGarantias linhas={linhas} onAtualizar={() => void carregar(filtros)} />
          )}
        </div>
      </div>
    </div>
  );
}
