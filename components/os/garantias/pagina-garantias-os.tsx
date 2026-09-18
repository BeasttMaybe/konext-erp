"use client";

import { useState } from "react";
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

const filtrosIniciais: FiltrosGarantiaInput = {
  busca: "",
  status: "TODAS",
  retorno: "TODAS",
  pagina: 1,
  tamanhoPagina: 20,
};

type PropsPaginaGarantiasOS = {
  /** Carregado no servidor junto com a pagina /os (Fase 1C-3, Parte 5) — nunca busca no cliente no primeiro render. */
  dashboardInicial: DashboardGarantiasOS;
  linhasIniciais: LinhaGarantiaOS[];
  erroInicial?: string | null;
};

export function PaginaGarantiasOS({ dashboardInicial, linhasIniciais, erroInicial = null }: PropsPaginaGarantiasOS) {
  const [filtros, setFiltros] = useState<FiltrosGarantiaInput>(filtrosIniciais);
  const [linhas, setLinhas] = useState<LinhaGarantiaOS[]>(linhasIniciais);
  const [dashboard, setDashboard] = useState<DashboardGarantiasOS>(dashboardInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial);

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
    } finally {
      setCarregando(false);
    }
  };

  const aoAtualizarFiltros = (novos: FiltrosGarantiaInput) => {
    setFiltros(novos);
    void carregar(novos);
  };

  return (
    <div className="space-y-4">
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
  );
}
