"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Table, TableBody, TabelaCarregando } from "@/components/ui/table";
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
        <Aviso variante="erro">{erro}</Aviso>
      ) : carregando ? (
        <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-cartao">
          <Table className="min-w-[1600px]">
            <TableBody>
              <TabelaCarregando colunas={19} />
            </TableBody>
          </Table>
        </div>
      ) : (
        <TabelaGarantias linhas={linhas} onAtualizar={() => void carregar(filtros)} />
      )}
    </div>
  );
}
