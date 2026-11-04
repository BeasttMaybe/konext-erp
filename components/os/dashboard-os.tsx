"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { calcularPresetEsteMes, validarIntervalo } from "@/lib/filtro-periodo";
import { dataDeCalendario, fimDoDia, FUSO_HORARIO_PADRAO, inicioDoDia } from "@/lib/datas";
import { TabuleiroKanban } from "@/components/os/tabuleiro-kanban";
import { ModalReabrirOS, type ConfirmacaoReaberturaPayload } from "@/components/os/modal-reabrir-os";
import type { PendenciaFinalizacao } from "@/lib/dominio/os/regras-finalizacao";
import { ModalNovaOS } from "@/components/os/modal-nova-os";
import { PainelLinkDoCelular } from "@/components/os/fotos/painel-link-do-celular";
import { ModalFinalizarOS, type ConfirmacaoFinalizacaoPayload } from "@/components/os/modal-finalizar-os";
import {
  ModalTermoGerado,
  type TermoGeradoNaFinalizacao,
} from "@/components/os/modal-termo-gerado";
import { ModalEntregarSemServico } from "@/components/os/modal-entregar-sem-servico";
import {
  ModalFinalizarRetornoGarantia,
  type FinalizacaoRetornoGarantiaPayload,
} from "@/components/os/modal-finalizar-retorno-garantia";
import { OrdemServico, OrdemServicoExcluida, EtapaOS, SituacaoOS } from "@/types/os";
import {
  criarOrdemServico,
  finalizarOrdemServico,
  finalizarSemServico,
  reabrirOrdemServico,
  atualizarEtapaOrdemServico,
  atualizarSituacaoOrdemServico,
} from "@/app/actions/os";
import { finalizarRetornoGarantiaOS, type DashboardGarantiasOS, type LinhaGarantiaOS } from "@/app/actions/garantias";
import { PaginaGarantiasOS } from "@/components/os/garantias/pagina-garantias-os";
import { ehResgatePendente, ROTULOS_ETAPA_OS } from "@/lib/dominio/os/maquina-estados";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import {
  Search,
  Plus,
  AlertCircle,
  ListChecks,
  KanbanSquare,
  ArchiveX,
  RotateCcw,
  X,
  ClipboardList,
  Wrench,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TabelaVazia } from "@/components/ui/table";

interface DashboardOSProps {
  activeOrderServices: OrdemServico[];
  archivedOrderServices: OrdemServico[];
  deletedOrderServices: OrdemServicoExcluida[];
  /** Quando fornecido, abre o modal de nova OS automaticamente e pré-seleciona o cliente. */
  clienteIdInicial?: string | null;
  modoInicial?: "KANBAN" | "LISTA_FINALIZADAS" | "GARANTIA";
  /** Liga o filtro de excluidas ja na primeira renderizacao (link antigo /os?modo=excluidas). */
  mostrarExcluidasInicial?: boolean;
  prazoGarantiaPadraoDias?: number;
  prazoMinimoGarantiaDias?: number;
  prazoMaximoGarantiaDias?: number;
  /** Carregados no servidor junto com a pagina /os — a aba Garantia nunca busca no cliente no primeiro render (Fase 1C-3, Parte 5). */
  dashboardGarantiasInicial: DashboardGarantiasOS;
  linhasGarantiasIniciais: LinhaGarantiaOS[];
  erroGarantiasInicial?: string | null;
  /** Fuso horário da loja — usado pelo `FiltroPeriodo` da lista de Finalizadas (Fase 2A-1). */
  fusoHorario?: string;
}

type DadosNovaOS = Parameters<typeof criarOrdemServico>[0];

export function DashboardOS({
  activeOrderServices,
  archivedOrderServices,
  deletedOrderServices,
  clienteIdInicial,
  modoInicial = "KANBAN",
  mostrarExcluidasInicial = false,
  prazoGarantiaPadraoDias = 90,
  prazoMinimoGarantiaDias = 1,
  prazoMaximoGarantiaDias = 365,
  dashboardGarantiasInicial,
  linhasGarantiasIniciais,
  erroGarantiasInicial = null,
  fusoHorario = FUSO_HORARIO_PADRAO,
}: DashboardOSProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalAberta, setModalAberta] = useState(Boolean(clienteIdInicial));
  const [buscaTexto, setBuscaTexto] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"KANBAN" | "LISTA_FINALIZADAS" | "GARANTIA">(modoInicial);
  const [mostrarExcluidas, setMostrarExcluidas] = useState(mostrarExcluidasInicial);
  const [osParaFinalizar, setOsParaFinalizar] = useState<OrdemServico | null>(null);
  const [termoGerado, setTermoGerado] = useState<TermoGeradoNaFinalizacao | null>(null);

  /**
   * A OS recém-criada cujo QR code de envio de fotos está aberto.
   *
   * Mora AQUI e não dentro do assistente porque o assistente fecha no mesmo
   * instante em que a OS nasce — um painel renderizado por dentro dele
   * desmontaria junto, e o QR code sumiria antes de alguém apontar a câmera.
   */
  const [osParaLinkDeFotos, setOsParaLinkDeFotos] = useState<string | null>(null);
  const [osFinalizandoId, setOsFinalizandoId] = useState<string | null>(null);
  const [requerGarantiaFinalizacao, setRequerGarantiaFinalizacao] = useState(false);
  const [pendenciasFinalizacao, setPendenciasFinalizacao] = useState<PendenciaFinalizacao[]>([]);
  const [osParaReabrir, setOsParaReabrir] = useState<OrdemServico | null>(null);
  const [osReabrindoId, setOsReabrindoId] = useState<string | null>(null);
  const [osParaSemServico, setOsParaSemServico] = useState<OrdemServico | null>(null);
  const [osSemServicoProcessandoId, setOsSemServicoProcessandoId] = useState<string | null>(null);
  const [somenteSemServico, setSomenteSemServico] = useState(false);
  const resolverFinalizacaoRef = useRef<((sucesso: boolean) => void) | null>(null);
  const resolverReaberturaRef = useRef<((sucesso: boolean) => void) | null>(null);
  const resolverSemServicoRef = useRef<((sucesso: boolean) => void) | null>(null);

  // Reabrir desfaz uma entrega: a mesma permissao "os.reabrir" checada no
  // servidor (por exigirPermissao). Ocultar o botao aqui e so cosmetico.
  const podeReabrirOS = useTemPermissao("os.reabrir");
  // "Arquivar OS" (resgate) chama finalizarOrdemServico, que exige os.finalizar
  // no servidor — mesma permissao usada pra Entregar e finalizar normal.
  const podeFinalizarOS = useTemPermissao("os.finalizar");
  // Atribuir tecnicos (Fase 1D-2) exige os.editar no servidor (definirTecnicosOS).
  const podeEditarTecnicos = useTemPermissao("os.editar");

  const filteredActiveOrders = activeOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  // Período de "Finalizadas" (Fase 2A-1, `FiltroPeriodo`) — filtra por
  // `archivedAt` (INSTANTE: quando a OS foi de fato arquivada na entrega).
  // Esta lista nunca tinha filtro de período: carregava TUDO de uma vez, sem
  // paginação nem corte de data (ver `app/actions/os.ts`, `obterDadosDashboardOS`).
  // Filtragem aqui é client-side, sobre a lista já carregada — mesmo padrão
  // já usado por busca/"somenteSemServico"/"mostrarExcluidas" nesta tela, não
  // uma mudança de arquitetura pontual só pra este filtro.
  const intervaloPadraoFinalizadas = useMemo(() => calcularPresetEsteMes(fusoHorario), [fusoHorario]);
  const periodoFinalizadas = useMemo(() => {
    const inicioTexto = searchParams.get("inicio");
    const fimTexto = searchParams.get("fim");
    const inicio = inicioTexto ? dataDeCalendario(inicioTexto) : null;
    const fim = fimTexto ? dataDeCalendario(fimTexto) : null;
    if (inicio && fim && validarIntervalo(inicio, fim).valido) {
      return { inicio, fim };
    }
    return intervaloPadraoFinalizadas;
  }, [searchParams, intervaloPadraoFinalizadas]);

  const filteredArchivedOrders = archivedOrderServices
    .filter((os) =>
      os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
      os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
      os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase())
    )
    .filter((os) => !somenteSemServico || os.entregueSemServico)
    .filter((os) => {
      if (!os.archivedAt) return true; // defensivo — a lista já vem só com arquivadas
      const instanteArquivamento = new Date(os.archivedAt).getTime();
      const inicioInstante = inicioDoDia(periodoFinalizadas.inicio, fusoHorario).getTime();
      const fimInstante = fimDoDia(periodoFinalizadas.fim, fusoHorario).getTime();
      return instanteArquivamento >= inicioInstante && instanteArquivamento <= fimInstante;
    });

  const filteredDeletedOrders = deletedOrderServices.filter((os) =>
    os.numeroOS.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.nomeCliente.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.equipamento.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    os.motivoExclusao.toLowerCase().includes(buscaTexto.toLowerCase())
  );

  // ENTREGUE sem archivedAt ("resgate") continua no quadro (ver TabuleiroKanban),
  // nunca na lista de Finalizadas — mas ja foi entregue de verdade, entao conta
  // pro card "Entregues" e alimenta o aviso acima da lista (Fase 1C-2 follow-up,
  // Parte 4: arquivar e um passo administrativo depois da entrega, nao muda se
  // ela aconteceu).
  const ordensEntreguesNaoArquivadas = filteredActiveOrders.filter(ehResgatePendente);
  const deliveredOrdersCount = ordensEntreguesNaoArquivadas.length + filteredArchivedOrders.length;

  const handleSalvarNovaOS = async (dados: DadosNovaOS) => {
    try {
      const criada = await criarOrdemServico(dados);
      toast.success("Ordem de servico criada com sucesso.");
      router.refresh();
      // O id volta pro modal: e com ele que as fotos tiradas no cadastro sobem.
      return criada.id;
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Nao foi possivel criar a ordem de servico.";
      toast.error(mensagem);
      throw error;
    }
  };

  const handleMoverOS = async (osId: string, novaEtapa: EtapaOS): Promise<boolean> => {
    try {
      const resultado = await atualizarEtapaOrdemServico(osId, novaEtapa);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return false;
      }
      router.refresh();
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar a etapa da OS.";
      toast.error(mensagem);
      return false;
    }
  };

  /** Marca/desmarca a situacao pelo menu do card, sem mover a OS de coluna. */
  const handleAlterarSituacao = async (osId: string, situacao: SituacaoOS | null): Promise<boolean> => {
    try {
      const resultado = await atualizarSituacaoOrdemServico(osId, situacao);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return false;
      }
      router.refresh();
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel atualizar a situacao da OS.";
      toast.error(mensagem);
      return false;
    }
  };

  const concluirSolicitacaoFinalizacao = (sucesso: boolean) => {
    resolverFinalizacaoRef.current?.(sucesso);
    resolverFinalizacaoRef.current = null;
    setRequerGarantiaFinalizacao(false);
    setPendenciasFinalizacao([]);
    setOsParaFinalizar(null);
  };

  const concluirSolicitacaoSemServico = (sucesso: boolean) => {
    resolverSemServicoRef.current?.(sucesso);
    resolverSemServicoRef.current = null;
    setOsParaSemServico(null);
  };

  /**
   * Entrega de OS: abre o dialogo certo e aguarda a decisao. OS sem nenhum
   * item vai para o encerramento sem serviço (Parte 3); com item, para a
   * finalizacao normal. O Kanban usa o retorno para reverter o movimento
   * otimista quando o operador cancela ou quando o servidor devolve pendencias.
   */
  const handleEntregarOS = async (orderService: OrdemServico): Promise<boolean> => {
    if (resolverFinalizacaoRef.current || resolverSemServicoRef.current) {
      toast.error("Ja existe uma finalizacao em andamento.");
      return false;
    }

    if ((orderService.itensOrcamento?.length ?? 0) === 0) {
      setOsParaSemServico(orderService);

      return await new Promise<boolean>((resolve) => {
        resolverSemServicoRef.current = resolve;
      });
    }

    setOsParaFinalizar(orderService);
    setRequerGarantiaFinalizacao(!orderService.ehRetornoGarantia);
    setPendenciasFinalizacao([]);

    return await new Promise<boolean>((resolve) => {
      resolverFinalizacaoRef.current = resolve;
    });
  };

  const handleReabrirOS = async (orderService: OrdemServico): Promise<boolean> => {
    if (resolverReaberturaRef.current) {
      return false;
    }

    setOsParaReabrir(orderService);

    return await new Promise<boolean>((resolve) => {
      resolverReaberturaRef.current = resolve;
    });
  };

  const concluirSolicitacaoReabertura = (sucesso: boolean) => {
    resolverReaberturaRef.current?.(sucesso);
    resolverReaberturaRef.current = null;
    setOsParaReabrir(null);
  };

  const confirmarReaberturaOS = async (payload: ConfirmacaoReaberturaPayload) => {
    if (!osParaReabrir || osReabrindoId) {
      return;
    }

    try {
      setOsReabrindoId(osParaReabrir.id);

      const resultado = await reabrirOrdemServico({
        osId: osParaReabrir.id,
        motivo: payload.motivo,
        estagioDestino: payload.estagioDestino,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        concluirSolicitacaoReabertura(false);
        return;
      }

      toast.success(`OS ${osParaReabrir.numeroOS} reaberta.`);
      router.refresh();
      concluirSolicitacaoReabertura(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel reabrir a OS.");
      concluirSolicitacaoReabertura(false);
    } finally {
      setOsReabrindoId(null);
    }
  };

  const confirmarFinalizacaoOS = async (payload?: ConfirmacaoFinalizacaoPayload) => {
    if (!osParaFinalizar || osFinalizandoId) {
      return;
    }

    try {
      setOsFinalizandoId(osParaFinalizar.id);

      const resultado = await finalizarOrdemServico({
        osId: osParaFinalizar.id,
        prazoGarantiaDias: payload?.prazoGarantiaDias ?? null,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        // Mantem o dialogo aberto mostrando a lista completa de bloqueios em vez
        // de fechar com um toast solto (AUDIT_REPORT 16.7-f).
        setPendenciasFinalizacao(resultado.pendencias ?? []);
        return;
      }

      setModoVisualizacao("LISTA_FINALIZADAS");
      if (resultado.garantiaGerada) {
        // O termo acabou de nascer e o cliente está no balcão: oferecer a
        // impressão aqui evita a viagem até a aba Garantias para procurar a
        // linha e clicar em imprimir.
        setTermoGerado({
          osId: osParaFinalizar.id,
          numeroOS: osParaFinalizar.numeroOS,
          prazoGarantiaDias: payload?.prazoGarantiaDias ?? null,
        });
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

  const confirmarSemServicoOS = async (motivo: string) => {
    if (!osParaSemServico || osSemServicoProcessandoId) {
      return;
    }

    try {
      setOsSemServicoProcessandoId(osParaSemServico.id);

      const resultado = await finalizarSemServico({ osId: osParaSemServico.id, motivo });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        concluirSolicitacaoSemServico(false);
        return;
      }

      setModoVisualizacao("LISTA_FINALIZADAS");
      toast.success(resultado.mensagem);
      router.refresh();
      concluirSolicitacaoSemServico(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel encerrar a OS sem servico.";
      toast.error(message);
      concluirSolicitacaoSemServico(false);
    } finally {
      setOsSemServicoProcessandoId(null);
    }
  };

  const cancelarSemServicoOS = () => {
    if (osSemServicoProcessandoId) {
      return;
    }

    concluirSolicitacaoSemServico(false);
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

  const finalizacaoEhRetornoGarantia =
    Boolean(osParaFinalizar?.ehRetornoGarantia) && osParaFinalizar?.status !== "ENTREGUE";

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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-kx-legenda" />
          <Input
            placeholder="Buscar por nº OS, cliente ou equipamento..."
            className="pl-10 h-10"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
          />
        </div>
        <Button onClick={() => setModalAberta(true)} className="h-10 px-6 whitespace-nowrap">
          <Plus className="w-4 h-4 mr-2" />
          Nova Ordem de Serviço
        </Button>
      </div>

      {/* Abas: Kanban | Finalizadas | Garantia — Excluidas virou filtro (Fase 1C-3, Parte 5) */}
      <Tabs
        value={modoVisualizacao}
        onValueChange={(valor) => {
          const modo = valor as "KANBAN" | "LISTA_FINALIZADAS" | "GARANTIA";
          setModoVisualizacao(modo);
          // Preserva os demais params (inclusive inicio/fim do FiltroPeriodo
          // da lista de Finalizadas) — trocar de aba e voltar não pode
          // resetar um filtro que o usuário já tinha escolhido.
          const params = new URLSearchParams(searchParams.toString());
          params.set("modo", modo === "KANBAN" ? "kanban" : modo === "LISTA_FINALIZADAS" ? "lista" : "garantia");
          router.push(`/os?${params.toString()}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="KANBAN">
            <KanbanSquare className="w-4 h-4 mr-2" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="LISTA_FINALIZADAS">
            <ListChecks className="w-4 h-4 mr-2" />
            Finalizadas e Entregues (Lista)
          </TabsTrigger>
          <TabsTrigger value="GARANTIA">Garantia</TabsTrigger>
        </TabsList>

        {/* Statistics Cards - segue as 4 etapas (Fase 1C-3, Parte 4) */}
        <div className="mt-kx-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-kx-4">
          <CartaoIndicador
            variante="alerta"
            titulo={ROTULOS_ETAPA_OS.ORCAMENTO}
            valor={filteredActiveOrders.filter((o) => o.etapa === "ORCAMENTO").length}
            icone={<ClipboardList />}
          />
          <CartaoIndicador
            variante="azul"
            titulo={ROTULOS_ETAPA_OS.CONSERTO}
            valor={filteredActiveOrders.filter((o) => o.etapa === "CONSERTO").length}
            icone={<Wrench />}
          />
          <CartaoIndicador
            variante="sucesso"
            titulo={ROTULOS_ETAPA_OS.PRONTO}
            valor={filteredActiveOrders.filter((o) => o.etapa === "PRONTO").length}
            icone={<PackageCheck />}
          />
          <CartaoIndicador
            variante="entregue"
            titulo={ROTULOS_ETAPA_OS.ENTREGUE}
            valor={deliveredOrdersCount}
            icone={<CheckCircle2 />}
          />
        </div>

        {/* Conteúdo da aba ativa */}
        <Card className="mt-kx-4 border border-kx-painel-borda bg-kx-cartao overflow-hidden">
          <div className="p-4 sm:p-6">
            <TabsContent value="KANBAN" className="mt-0">
              <h2 className="text-lg sm:text-xl font-bold text-kx-texto mb-6">Quadro de Ordens de Serviço</h2>

              {filteredActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-kx-legenda mb-4" />
                  <p className="text-kx-texto-2 font-medium">
                    Nenhuma ordem de serviço encontrada
                  </p>
                  <p className="text-sm text-kx-legenda mt-2">
                    {buscaTexto
                      ? "Tente ajustar sua busca"
                      : "Clique em 'Nova Ordem de Serviço' para começar"}
                  </p>
                </div>
              ) : (
                <div className="px-0">
                <TabuleiroKanban
                  ordensServico={filteredActiveOrders}
                  onMoverOS={handleMoverOS}
                  onAlterarSituacao={handleAlterarSituacao}
                  onCartaoClick={handleAbrirDetalhesOS}
                  onFinalizarOS={handleFinalizarOS}
                  onEntregarOS={handleEntregarOS}
                  onReabrirOS={podeReabrirOS ? handleReabrirOS : undefined}
                  podeArquivarOS={podeFinalizarOS}
                  podeEditarTecnicos={podeEditarTecnicos}
                />
                </div>
              )}
            </TabsContent>

            <TabsContent value="LISTA_FINALIZADAS" className="mt-0">
              <h2 className="text-lg sm:text-xl font-bold text-kx-texto mb-6">
                {mostrarExcluidas ? "Lista de Ordens de Serviço Excluídas" : "Lista de Finalizadas e Entregues"}
              </h2>

              {/* O filtro nunca pode depender do resultado que ele mesmo produz —
                  renderizado sempre que a lista esta ativa, nunca condicionado a
                  filteredArchivedOrders (Fase 1C-2 follow-up, Parte 3). Antes disso,
                  marcar a caixa e zerar a lista escondia a propria caixa e travava
                  o operador no filtro sem jeito de voltar. */}
              {ordensEntreguesNaoArquivadas.length > 0 && (
                <p className="mb-3 text-sm text-kx-alerta">
                  {ordensEntreguesNaoArquivadas.length === 1
                    ? "1 OS entregue ainda não arquivada"
                    : `${ordensEntreguesNaoArquivadas.length} OS entregues ainda não arquivadas`}
                  {" — "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:opacity-80"
                    onClick={() => {
                      setModoVisualizacao("KANBAN");
                      router.push("/os?modo=kanban");
                    }}
                  >
                    veja no quadro
                  </button>
                  .
                </p>
              )}
              <div className="mb-3 flex flex-wrap items-center gap-4">
                {!mostrarExcluidas && (
                  <FiltroPeriodoPagina
                    campos={[{ valor: "finalizadas-em", rotulo: "Finalizadas em" }]}
                    fusoHorario={fusoHorario}
                  />
                )}
                <label className="flex w-fit items-center gap-2 text-sm text-kx-texto-2">
                  <input
                    type="checkbox"
                    checked={mostrarExcluidas}
                    onChange={(evento) => setMostrarExcluidas(evento.target.checked)}
                    className="h-4 w-4 rounded border-kx-campo-borda"
                  />
                  <ArchiveX className="h-4 w-4" />
                  Mostrar excluídas
                </label>
                {!mostrarExcluidas && (
                  <label className="flex w-fit items-center gap-2 text-sm text-kx-texto-2">
                    <input
                      type="checkbox"
                      checked={somenteSemServico}
                      onChange={(evento) => setSomenteSemServico(evento.target.checked)}
                      className="h-4 w-4 rounded border-kx-campo-borda"
                    />
                    Mostrar só entregues sem serviço
                  </label>
                )}
              </div>

              {mostrarExcluidas ? (
                <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda">
                  <Table className="min-w-[1120px]">
                    <TableHeader className="sticky top-0 z-kx-sticky bg-kx-cartao">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nº OS</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead className="text-right">Orçamento</TableHead>
                        <TableHead>Status anterior</TableHead>
                        <TableHead>Excluída por</TableHead>
                        <TableHead>Motivo da exclusão</TableHead>
                        <TableHead>Excluída em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody zebra>
                      {filteredDeletedOrders.length === 0 ? (
                        <TabelaVazia
                          colSpan={9}
                          titulo="Nenhuma ordem de serviço excluída encontrada"
                          icone={<ArchiveX className="h-8 w-8" aria-hidden="true" />}
                        />
                      ) : (
                        filteredDeletedOrders.map((os) => (
                          <TableRow key={os.id}>
                            <TableCell className="font-semibold">{os.numeroOS}</TableCell>
                            <TableCell>{os.nomeCliente}</TableCell>
                            <TableCell>{os.equipamento}</TableCell>
                            <TableCell numerico>{formatarMoeda(os.totalOrcamento)}</TableCell>
                            <TableCell>
                              <PilulaStatus variante="neutro">{os.statusAnterior}</PilulaStatus>
                            </TableCell>
                            <TableCell>{os.excluidaPor}</TableCell>
                            <TableCell className="max-w-[320px] truncate" title={os.motivoExclusao}>
                              {os.motivoExclusao}
                            </TableCell>
                            <TableCell className="text-kx-legenda">{formatarDataHora(os.excluidaEm)}</TableCell>
                            <TableCell className="text-right text-xs text-kx-legenda">Somente leitura</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : filteredArchivedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-kx-legenda mb-4" />
                  <p className="text-kx-texto-2 font-medium">
                    {somenteSemServico
                      ? "Nenhuma OS entregue sem serviço neste período."
                      : "Nenhuma OS finalizada ou entregue"}
                  </p>
                  {somenteSemServico && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setSomenteSemServico(false)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar filtro
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda">
                  <Table className="min-w-[840px]">
                    <TableHeader className="sticky top-0 z-kx-sticky bg-kx-cartao">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nº OS</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead className="text-right">Orçamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Atualizado em</TableHead>
                        {podeReabrirOS && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody zebra>
                      {filteredArchivedOrders.map((os) => (
                        <TableRow
                          key={os.id}
                          className="cursor-pointer"
                          onClick={() => handleAbrirDetalhesOS(os)}
                        >
                          <TableCell className="font-semibold">{os.numeroOS}</TableCell>
                          <TableCell>{os.nomeCliente}</TableCell>
                          <TableCell>{os.equipamento}</TableCell>
                          <TableCell numerico>{formatarMoeda(os.totalOrcamento)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <PilulaStatus variante="sucesso">Finalizada</PilulaStatus>
                              {os.entregueSemServico && (
                                <PilulaStatus variante="neutro" title={os.motivoSemServico}>
                                  Entregue sem serviço
                                </PilulaStatus>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-kx-legenda">{formatarDataHora(os.dataAtualizacao)}</TableCell>
                          {podeReabrirOS && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    void handleReabrirOS(os);
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reabrir OS
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="GARANTIA" className="mt-0">
              <h2 className="text-lg sm:text-xl font-bold text-kx-texto mb-6">Garantias</h2>
              <PaginaGarantiasOS
                fusoHorario={fusoHorario}
                dashboardInicial={dashboardGarantiasInicial}
                linhasIniciais={linhasGarantiasIniciais}
                erroInicial={erroGarantiasInicial}
              />
            </TabsContent>
          </div>
        </Card>
      </Tabs>

      <ModalTermoGerado termo={termoGerado} aoFechar={() => setTermoGerado(null)} />

      {/* Modal Nova OS */}
      <ModalNovaOS
        aberta={modalAberta}
        onAbrirMudar={setModalAberta}
        onSalvar={handleSalvarNovaOS}
        clienteIdInicial={clienteIdInicial ?? undefined}
        aoPedirLinkDeFotos={setOsParaLinkDeFotos}
      />

      {osParaLinkDeFotos && (
        <PainelLinkDoCelular
          ordemServicoId={osParaLinkDeFotos}
          aberto
          aoFechar={() => setOsParaLinkDeFotos(null)}
        />
      )}

      {finalizacaoEhRetornoGarantia ? (
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
          exigePrazoGarantia={requerGarantiaFinalizacao}
          prazoPadraoDias={prazoGarantiaPadraoDias}
          prazoMinimoDias={prazoMinimoGarantiaDias}
          prazoMaximoDias={prazoMaximoGarantiaDias}
          pendencias={pendenciasFinalizacao}
          onConfirmar={confirmarFinalizacaoOS}
        />
      )}

      <ModalEntregarSemServico
        key={`${osParaSemServico?.id ?? "sem-os"}-sem-servico`}
        aberta={Boolean(osParaSemServico)}
        onAbrirMudar={(aberta) => {
          if (!aberta) {
            cancelarSemServicoOS();
          }
        }}
        os={osParaSemServico}
        processando={Boolean(osSemServicoProcessandoId)}
        onConfirmar={confirmarSemServicoOS}
      />

      <ModalReabrirOS
        key={osParaReabrir?.id ?? "sem-os-reabrir"}
        aberta={Boolean(osParaReabrir)}
        onAbrirMudar={(aberta) => {
          if (!aberta && !osReabrindoId) {
            concluirSolicitacaoReabertura(false);
          }
        }}
        os={osParaReabrir}
        processando={Boolean(osReabrindoId)}
        onConfirmar={confirmarReaberturaOS}
      />
    </div>
  );
}
