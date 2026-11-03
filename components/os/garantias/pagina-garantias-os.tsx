"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Aviso } from "@/components/ui/aviso";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TabelaCarregando } from "@/components/ui/table";
import { FiltrosGarantias } from "@/components/os/garantias/filtros-garantias";
import { TabelaGarantias } from "@/components/os/garantias/tabela-garantias";
import { DashboardGarantias } from "@/components/os/garantias/dashboard-garantias";
import { dataDeCalendario, FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { calcularPresetEsteMes, validarIntervalo } from "@/lib/filtro-periodo";
import {
  listarGarantiasOS,
  obterDashboardGarantiasOS,
  type DashboardGarantiasOS,
  type FiltrosGarantiaInput,
  type LinhaGarantiaOS,
} from "@/app/actions/garantias";

const TAMANHO_DA_PAGINA = 20;

/**
 * A aba "VIGENTES" é o padrão, e não "TODAS".
 *
 * Quem abre Garantias está quase sempre atrás de uma garantia que ainda vale —
 * é a pergunta que o cliente faz no balcão. Abrir em "todas" mistura o que
 * expirou há meses no meio, que é exatamente o que fazia a tela ser difícil de
 * usar. O que expirou tem aba própria.
 */
const filtrosIniciais: FiltrosGarantiaInput = {
  busca: "",
  situacao: "VIGENTES",
  retorno: "TODAS",
  pagina: 1,
  tamanhoPagina: TAMANHO_DA_PAGINA,
};

type PropsPaginaGarantiasOS = {
  /** Carregado no servidor junto com a pagina /os (Fase 1C-3, Parte 5) — nunca busca no cliente no primeiro render. */
  dashboardInicial: DashboardGarantiasOS;
  linhasIniciais: LinhaGarantiaOS[];
  erroInicial?: string | null;
  fusoHorario?: string;
};

function ConteudoGarantias({
  dashboardInicial,
  linhasIniciais,
  erroInicial = null,
  fusoHorario = FUSO_HORARIO_PADRAO,
}: PropsPaginaGarantiasOS) {
  const parametrosDaUrl = useSearchParams();

  const [filtros, setFiltros] = useState<FiltrosGarantiaInput>(filtrosIniciais);
  const [linhas, setLinhas] = useState<LinhaGarantiaOS[]>(linhasIniciais);
  const [dashboard, setDashboard] = useState<DashboardGarantiasOS>(dashboardInicial);
  const [total, setTotal] = useState<number | null>(null);
  const [totalDePaginas, setTotalDePaginas] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const filtrosRef = useRef<FiltrosGarantiaInput>(filtrosIniciais);
  const [erro, setErro] = useState<string | null>(erroInicial);

  // O período vem da URL, gravado pelo `FiltroPeriodoPagina` — a mesma
  // convenção `?inicio=&fim=` das outras telas que usam o filtro.
  const intervaloPadrao = useMemo(() => calcularPresetEsteMes(fusoHorario), [fusoHorario]);
  const periodo = useMemo(() => {
    const inicioTexto = parametrosDaUrl.get("inicio");
    const fimTexto = parametrosDaUrl.get("fim");
    const inicio = inicioTexto ? dataDeCalendario(inicioTexto) : null;
    const fim = fimTexto ? dataDeCalendario(fimTexto) : null;

    if (inicio && fim && validarIntervalo(inicio, fim).valido) return { inicio, fim };

    return intervaloPadrao;
  }, [parametrosDaUrl, intervaloPadrao]);

  const carregar = useCallback(
    async (proximosFiltros: FiltrosGarantiaInput) => {
      setCarregando(true);
      setErro(null);

      try {
        const [resumo, listagem] = await Promise.all([
          obterDashboardGarantiasOS(),
          listarGarantiasOS({
            ...proximosFiltros,
            dataInicio: periodo.inicio.toISOString(),
            dataFim: periodo.fim.toISOString(),
          }),
        ]);

        setDashboard(resumo);

        if (!listagem.sucesso) {
          setErro(listagem.erro);
          setLinhas([]);
          setTotal(0);
          setTotalDePaginas(1);
          return;
        }

        setLinhas(listagem.dados);
        setTotal(listagem.total);
        setTotalDePaginas(listagem.totalPaginas);
      } catch {
        setErro("Não foi possível carregar as garantias.");
        setLinhas([]);
        setTotal(0);
      } finally {
        setCarregando(false);
      }
    },
    [periodo]
  );

  // Recarrega quando o período da URL muda (o filtro grava e navega) e no
  // primeiro render — as linhas iniciais vieram sem recorte de aba nem de
  // período, então a primeira carga alinha a tela com os filtros padrão.
  useEffect(() => {
    let ativo = true;

    void (async () => {
      // `filtros` é lido por referência fresca em vez de entrar nas
      // dependências: toda mudança de filtro já chama `carregar` direto em
      // `aoAtualizarFiltros`, e incluí-lo aqui faria duas buscas por clique.
      if (!ativo) return;
      await carregar(filtrosRef.current);
    })();

    return () => {
      ativo = false;
    };
  }, [carregar]);

  const aoAtualizarFiltros = (novos: FiltrosGarantiaInput) => {
    filtrosRef.current = novos;
    setFiltros(novos);
    void carregar(novos);
  };

  const irParaPagina = (pagina: number) => {
    const novos = { ...filtros, pagina };
    filtrosRef.current = novos;
    setFiltros(novos);
    void carregar(novos);
  };

  return (
    <div className="space-y-4">
      <DashboardGarantias dados={dashboard} />

      <FiltrosGarantias
        filtros={filtros}
        onChange={aoAtualizarFiltros}
        fusoHorario={fusoHorario}
        totalEncontrado={carregando ? null : total}
      />

      {erro ? (
        <Aviso variante="erro">{erro}</Aviso>
      ) : carregando ? (
        <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-cartao">
          <Table className="min-w-[900px]">
            <TableBody>
              <TabelaCarregando colunas={7} />
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <TabelaGarantias linhas={linhas} onAtualizar={() => void carregar(filtros)} />

          {/* A tela não tinha paginação nenhuma: o `total` e o `totalPaginas`
              que a action já devolvia eram descartados, então só as 20
              primeiras garantias eram alcançáveis. */}
          <PaginationControls
            currentPage={filtros.pagina ?? 1}
            totalPages={totalDePaginas}
            onPageChange={irParaPagina}
            disabled={carregando}
          />
        </>
      )}
    </div>
  );
}

/** `useSearchParams` exige Suspense no App Router. */
export function PaginaGarantiasOS(props: PropsPaginaGarantiasOS) {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-kx-painel border border-kx-painel-borda bg-kx-cartao" />
      }
    >
      <ConteudoGarantias {...props} />
    </Suspense>
  );
}
