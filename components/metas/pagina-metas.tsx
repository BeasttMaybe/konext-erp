"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResumoMetas } from "@/components/metas/resumo-metas";
import { LinhaMeta } from "@/components/metas/linha-meta";
import { pesoDeUrgencia, calcularRitmo } from "@/lib/dominio/metas/ritmo";
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
import { useTemPermissao } from "@/contextos/contexto-permissoes";

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

  /**
   * "Agora" fixado por montagem, e nao lido a cada render: o ritmo de cada
   * linha depende dele, e um `new Date()` dentro do render daria um instante
   * diferente por linha e por renderizacao — duas metas identicas poderiam
   * mostrar dias restantes diferentes.
   */
  const agora = useMemo(() => new Date(), []);

  /**
   * Ordem por URGENCIA, nao por data de criacao. A lista tem que responder
   * "o que eu faco agora": sincronizacao quebrada primeiro (o numero nao e
   * confiavel), depois prazo vencido, depois fora do ritmo com prazo mais
   * curto, e o que esta em ordem no fim.
   */
  const metasOrdenadas = useMemo(() => {
    return [...metas]
      .map((meta) => {
        const ritmo = calcularRitmo({
          progresso: meta.progresso,
          inicio: meta.dataInicio ? new Date(meta.dataInicio) : null,
          prazo: meta.dataPrazo ? new Date(meta.dataPrazo) : null,
          agora,
        });

        return {
          meta,
          peso: pesoDeUrgencia({
            situacao: ritmo.situacao,
            status: meta.status,
            folga: ritmo.folga,
            diasRestantes: ritmo.diasRestantes,
            temErroSincronizacao: Boolean(meta.erroSincronizacao),
          }),
        };
      })
      .sort((a, b) => a.peso - b.peso)
      .map((item) => item.meta);
  }, [metas, agora]);
  const [dashboard, setDashboard] = useState<DashboardMetasResult>(dashboardVazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const podeEditarMetas = useTemPermissao("metas.editar");
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
      <ResumoMetas dados={dashboard} />

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltrosMetas filtros={filtros} onChange={aoAtualizarFiltros} />
        {podeEditarMetas ? (
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
        ) : null}
      </div>

      {/* Lista */}
      {carregando ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="h-[66px] rounded-kx-botao bg-kx-superficie animate-pulse" />
          ))}
        </ul>
      ) : erro ? (
        <div className="text-center py-16 text-kx-legenda">
          <p>{erro}</p>
          <Button variant="outline" className="mt-4" onClick={() => carregar(filtros)}>
            Tentar novamente
          </Button>
        </div>
      ) : metas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="h-14 w-14 text-kx-texto-2 mb-4" />
          <h3 className="text-lg font-semibold text-kx-texto-2">
            Nenhuma meta encontrada
          </h3>
          <p className="text-sm text-kx-legenda mt-1 mb-6">
            Crie a primeira meta da empresa para começar a acompanhar os objetivos.
          </p>
          {podeEditarMetas ? (
            <Button onClick={() => setModalAberto(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova meta
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {metasOrdenadas.map((m) => (
            <LinhaMeta key={m.id} meta={m} agora={agora} />
          ))}
        </ul>
      )}

      <ModalNovaMeta
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoConcluir={aoMetaCriada}
      />
    </div>
  );
}
