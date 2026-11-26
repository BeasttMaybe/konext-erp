"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  listarPropostasPaginado,
  obterIndicadoresPropostas,
  type FiltroSituacaoProposta,
  type IndicadoresPropostas as DadosIndicadores,
  type LinhaProposta as DadosLinhaProposta,
  type OrdemProposta,
} from "@/app/actions/propostas";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemPermissao } from "@/contextos/contexto-permissoes";

import { IndicadoresPropostas } from "./indicadores-propostas";
import { LinhaProposta } from "./linha-proposta";

const LIMITE_POR_PAGINA = 20;

/**
 * As abas de triagem. A tela abre em "Todas", com as propostas mais recentes
 * no topo — é o que o dono quer ver ao entrar. "Precisam de atenção" fica
 * como aba/filtro para quando ele quiser triar "o que eu faço agora", e a
 * ordenação por urgência continua disponível no seletor de ordem.
 */
const ABAS: Array<{ valor: FiltroSituacaoProposta; rotulo: string }> = [
  { valor: "ATENCAO", rotulo: "Precisam de atenção" },
  { valor: "EM_ABERTO", rotulo: "Em aberto" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
  { valor: "APROVADA", rotulo: "Aprovadas" },
  { valor: "REJEITADA", rotulo: "Recusadas" },
  { valor: "TODAS", rotulo: "Todas" },
];

const VAZIO_POR_ABA: Record<FiltroSituacaoProposta, { titulo: string; descricao: string }> = {
  ATENCAO: {
    titulo: "Nada pedindo atenção hoje",
    descricao:
      "Nenhuma proposta vencendo, vencida ou com contato marcado pra hoje. As abertas estão em “Em aberto”.",
  },
  EM_ABERTO: {
    titulo: "Nenhuma proposta esperando resposta",
    descricao: "Toda proposta emitida já foi respondida pelo cliente.",
  },
  RASCUNHO: {
    titulo: "Nenhum rascunho",
    descricao: "Rascunho é a proposta que ainda não foi enviada ao cliente.",
  },
  AGUARDANDO: {
    titulo: "Nenhuma proposta aguardando",
    descricao: "Nada enviado e dentro do prazo neste momento.",
  },
  APROVADA: {
    titulo: "Nenhuma proposta aprovada ainda",
    descricao: "Quando o cliente aceitar um orçamento, registre pelo menu da proposta.",
  },
  REJEITADA: {
    titulo: "Nenhuma recusa registrada",
    descricao: "Registrar as recusas é o que permite medir quanto dos seus orçamentos fecha.",
  },
  TODAS: {
    titulo: "Nenhuma proposta ainda",
    descricao: "Crie o primeiro orçamento e ele aparece aqui.",
  },
};

function ConteudoPropostas({ hojeIso }: { hojeIso: string }) {
  const router = useRouter();
  const parametrosDaUrl = useSearchParams();
  const podeEditar = useTemPermissao("propostas.editar");

  const paginaAtual = Math.max(1, Number(parametrosDaUrl.get("pagina") ?? "1"));

  const [propostas, setPropostas] = useState<DadosLinhaProposta[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDePaginas, setTotalDePaginas] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [aba, setAba] = useState<FiltroSituacaoProposta>("TODAS");
  const [ordem, setOrdem] = useState<OrdemProposta>("recentes");
  const [indicadores, setIndicadores] = useState<DadosIndicadores | null>(null);

  const irParaPagina = useCallback(
    (pagina: number) => {
      const parametros = new URLSearchParams(parametrosDaUrl.toString());
      parametros.set("pagina", String(pagina));
      router.push(`?${parametros.toString()}`);
    },
    [router, parametrosDaUrl]
  );

  // A busca espera a digitação parar. Sem isso cada tecla dispara uma consulta
  // paginada no banco, e a lista "pisca" entre resultados parciais.
  useEffect(() => {
    const temporizador = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(temporizador);
  }, [busca]);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        setCarregando(true);
        const resultado = await listarPropostasPaginado({
          pagina: paginaAtual,
          limite: LIMITE_POR_PAGINA,
          busca: buscaAplicada,
          situacao: aba,
          ordem,
        });
        if (!ativo) return;
        setPropostas(resultado.dados);
        setTotal(resultado.total);
        setTotalDePaginas(resultado.totalDePaginas);
      } catch {
        if (ativo) toast.error("Não foi possível carregar as propostas.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [paginaAtual, buscaAplicada, aba, ordem]);

  // Os indicadores são de TODAS as propostas, não da página nem do filtro —
  // então não entram no efeito acima, que roda a cada troca de aba.
  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const resultado = await obterIndicadoresPropostas();
        if (ativo) setIndicadores(resultado);
      } catch {
        // Indicador é resumo: se falhar, a lista ainda serve, e um toast aqui
        // só empilharia erro em cima do erro que a lista já mostrou.
      }
    })();

    return () => {
      ativo = false;
    };
  }, [propostas]);

  const trocarAba = (valor: FiltroSituacaoProposta) => {
    setAba(valor);
    irParaPagina(1);
  };

  const vazio = VAZIO_POR_ABA[aba];

  return (
    <div className="flex w-full flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Propostas</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Orçamentos enviados, o que vence e quanto dos seus orçamentos fecha.
            </p>
          </div>

          {podeEditar && (
            <Button asChild>
              <Link href="/crm/propostas/nova">
                <Plus className="h-4 w-4" />
                Nova proposta
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          {indicadores !== null && <IndicadoresPropostas dados={indicadores} />}

          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Triagem das propostas">
            {ABAS.map((opcao) => {
              const selecionada = aba === opcao.valor;

              return (
                <button
                  key={opcao.valor}
                  type="button"
                  role="tab"
                  aria-selected={selecionada}
                  onClick={() => trocarAba(opcao.valor)}
                  className={
                    selecionada
                      ? "rounded-kx-pilula bg-kx-primaria px-3.5 py-1.5 text-sm font-semibold text-primary-foreground"
                      : "rounded-kx-pilula border border-kx-painel-borda px-3.5 py-1.5 text-sm font-medium text-kx-texto-2 hover:text-kx-texto"
                  }
                >
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 lg:p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda"
                  aria-hidden
                />
                <Input
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Cliente, equipamento ou defeito"
                  aria-label="Buscar propostas"
                  className="pl-9"
                />
              </div>

              <Select value={ordem} onValueChange={(valor) => setOrdem(valor as OrdemProposta)}>
                <SelectTrigger className="sm:w-56" aria-label="Ordenar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgencia">Mais urgentes primeiro</SelectItem>
                  <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
                  <SelectItem value="maior_valor">Maior valor primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {carregando && propostas.length === 0 ? (
              <ul className="space-y-2">
                {Array.from({ length: 6 }).map((_, indice) => (
                  <li
                    key={indice}
                    className="h-[66px] animate-pulse rounded-kx-botao border border-kx-painel-borda bg-kx-superficie"
                  />
                ))}
              </ul>
            ) : propostas.length === 0 ? (
              <EstadoVazio
                icone={<FileText />}
                titulo={buscaAplicada ? "Nada encontrado" : vazio.titulo}
                descricao={
                  buscaAplicada
                    ? `Nenhuma proposta com “${buscaAplicada}” nesta aba.`
                    : vazio.descricao
                }
                acao={
                  !buscaAplicada && podeEditar && aba === "TODAS" ? (
                    <Button asChild>
                      <Link href="/crm/propostas/nova">
                        <Plus className="h-4 w-4" />
                        Criar a primeira
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <p className="text-xs text-kx-legenda">
                  {total === 1 ? "1 proposta" : `${total} propostas`}
                  {buscaAplicada && ` com “${buscaAplicada}”`}
                </p>

                <ul className={`space-y-2 ${carregando ? "opacity-60" : ""}`}>
                  {propostas.map((proposta) => (
                    <LinhaProposta
                      key={proposta.id}
                      proposta={proposta}
                      hojeIso={hojeIso}
                      podeEditar={podeEditar}
                    />
                  ))}
                </ul>

                <PaginationControls
                  currentPage={paginaAtual}
                  totalPages={totalDePaginas}
                  onPageChange={irParaPagina}
                  disabled={carregando}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** `useSearchParams` exige Suspense no App Router. */
export function PaginaPropostas({ hojeIso }: { hojeIso: string }) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-6 lg:px-8">
          <div className="mx-auto h-9 w-56 max-w-7xl animate-pulse rounded-kx-cartao bg-kx-painel-borda" />
        </div>
      }
    >
      <ConteudoPropostas hojeIso={hojeIso} />
    </Suspense>
  );
}
