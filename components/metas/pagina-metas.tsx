"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DashboardMetas } from "@/components/metas/dashboard-metas";
import { CardMeta } from "@/components/metas/card-meta";
import { FiltrosMetas } from "@/components/metas/filtros-metas";
import { ModalNovaMeta } from "@/components/metas/modal-nova-meta";
import {
  listarMetas,
  obterDashboardMetas,
  sincronizarTodasMetasAutomaticas,
  type LinhaMetaLista,
  type DashboardMetasResult,
  type FiltrosMetasInput,
} from "@/app/actions/metas";

const dashboardVazio: DashboardMetasResult = {
  totalMetas: 0,
  metasManuais: 0,
  metasAutomaticas: 0,
  emAndamento: 0,
  concluidas: 0,
  atrasadas: 0,
  emAtencao: 0,
  pausadas: 0,
  canceladas: 0,
  automaticasComErroSincronizacao: 0,
  valorTotalPlanejado: 0,
  valorAlcancado: 0,
  proximasVencer: 0,
};

const filtrosIniciais: FiltrosMetasInput = {
  busca: "",
  categoria: "TODAS",
  status: "TODAS",
  prioridade: "TODAS",
  pagina: 1,
  tamanhoPagina: 24,
};

export function PaginaMetas() {
  const router = useRouter();
  const [filtros, setFiltros] = useState<FiltrosMetasInput>(filtrosIniciais);
  const [metas, setMetas] = useState<LinhaMetaLista[]>([]);
  const [dashboard, setDashboard] = useState<DashboardMetasResult>(dashboardVazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [sincronizandoAutomaticas, setSincronizandoAutomaticas] = useState(false);
  const inicializado = useRef(false);

  const carregar = async (f: FiltrosMetasInput) => {
    setCarregando(true);
    setErro(null);
    try {
      const [resumo, lista] = await Promise.all([
        obterDashboardMetas(),
        listarMetas(f),
      ]);
      setDashboard(resumo);
      if (!lista.sucesso) {
        setErro(lista.erro);
        setMetas([]);
        return;
      }
      setMetas(lista.dados);
    } catch {
      setErro("Não foi possível carregar as metas.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;
    void carregar(filtrosIniciais);
  }, []);

  const aoAtualizarFiltros = (f: FiltrosMetasInput) => {
    setFiltros(f);
    void carregar(f);
  };

  const aoMetaCriada = (id: string) => {
    setModalAberto(false);
    void carregar(filtros);
    router.push(`/metas/${id}`);
  };

  const atualizarMetasAutomaticas = async () => {
    setSincronizandoAutomaticas(true);
    try {
      const res = await sincronizarTodasMetasAutomaticas();
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }

      toast.success(res.mensagem);
      await carregar(filtros);
      router.refresh();
    } catch {
      toast.error("Não foi possível sincronizar as metas automáticas.");
    } finally {
      setSincronizandoAutomaticas(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard */}
      <DashboardMetas dados={dashboard} />

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltrosMetas filtros={filtros} onChange={aoAtualizarFiltros} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={atualizarMetasAutomaticas}
            disabled={sincronizandoAutomaticas}
          >
            {sincronizandoAutomaticas ? "Sincronizando..." : "Atualizar metas automáticas"}
          </Button>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova meta
          </Button>
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : erro ? (
        <div className="text-center py-16 text-slate-500">
          <p>{erro}</p>
          <Button variant="outline" className="mt-4" onClick={() => carregar(filtros)}>
            Tentar novamente
          </Button>
        </div>
      ) : metas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="h-14 w-14 text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">
            Nenhuma meta encontrada
          </h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Crie a primeira meta da empresa para começar a acompanhar os objetivos.
          </p>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova meta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {metas.map((m) => (
            <CardMeta key={m.id} meta={m} />
          ))}
        </div>
      )}

      <ModalNovaMeta
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoConcluir={aoMetaCriada}
      />
    </div>
  );
}
