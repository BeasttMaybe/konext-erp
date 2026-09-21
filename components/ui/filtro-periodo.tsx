"use client";

/**
 * Filtro de período compartilhado (Fase 2A-1, componente `componente-filtro-periodo`).
 *
 * Combina um seletor de campo de data opcional (ex.: "Vencimento" ×
 * "Pagamento" × "Emissão" — vem de quem usa o componente, nunca hardcoded
 * aqui), DOIS calendários (`react-day-picker`) com papéis DISTINTOS —
 * esquerda = "Início do período", direita = "Fim do período", cada um
 * navegando de mês de forma INDEPENDENTE — e uma coluna de presets ("Hoje",
 * "Esta semana", "Mês passado"...). Nada é aplicado até o usuário clicar
 * "Filtrar" — até lá, tudo é um RASCUNHO local; só o clique em "Filtrar"
 * atualiza a URL (e dispara `aoFiltrar`, se passado).
 *
 * Os dois calendários leem do MESMO estado de intervalo (`intervaloRascunho`,
 * em `PainelFiltroPeriodo`) — nunca dois estados de intervalo paralelos (o
 * bug da versão anterior a esta: cada `DayPicker` tinha seu próprio fluxo de
 * seleção internamente controlado, e clicar no da direita reiniciava a
 * seleção do da esquerda em vez de completá-la). O que É independente por
 * calendário é só o MÊS EXIBIDO (dois estados, um por calendário — isso é
 * esperado e correto aqui: navegar o calendário de início até janeiro não
 * pode mexer no calendário de fim, que pode estar em setembro). Ver o
 * comentário grande em `CalendarioIntervalo` pra como o clique de cada
 * calendário é amarrado só à sua própria ponta do intervalo.
 *
 * Toda fronteira de dia/semana/mês (os presets) vem de `lib/filtro-periodo.ts`,
 * que por sua vez só usa `lib/datas.ts` — nunca `new Date()`/`setHours`/
 * `startOfDay` crus aqui (a regra de lint `konext-datas/*` baniria de
 * qualquer forma, mas o objetivo é nem tentar).
 *
 * Convenção de fuso pro CALENDÁRIO do `react-day-picker`: `timeZone="UTC"`.
 * As datas deste componente são DATA DE CALENDÁRIO (meia-noite UTC — mesma
 * convenção de `lib/datas.ts`/`lib/filtro-periodo.ts`). Sem `timeZone="UTC"`,
 * o `react-day-picker` decide em qual célula do grid cada `Date` cai usando
 * o fuso LOCAL DO NAVEGADOR — num navegador em `America/Sao_Paulo` (UTC−3),
 * meia-noite UTC de um dia é 21h do dia ANTERIOR nesse fuso, e o dia certo
 * apareceria destacado errado. Fixar em "UTC" faz o grid interpretar nossas
 * datas exatamente como eram.
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { Calendar as IconeCalendario, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { FUSO_HORARIO_PADRAO, hojeComoDataDeCalendario } from "@/lib/datas";
import {
  aplicarMascaraDataDigitada,
  calcularIntervaloMesEspecifico,
  calcularPresetEsteMes,
  formatarDataExibicao,
  formatarRotuloIntervalo,
  identificarMesEspecifico,
  identificarPresetAtivo,
  interpretarDataDigitada,
  mesDeCalendarioAtual,
  NOMES_PARAMS_PERIODO_PADRAO,
  paraSearchParams,
  PRESETS_PERIODO,
  validarIntervalo,
  type ChavePresetPeriodo,
  type IntervaloPeriodo,
  type MesDeCalendario,
  type NomesParamsPeriodo,
  type OpcaoCampoPeriodo,
} from "@/lib/filtro-periodo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NOME_DOS_MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Preset "informativo": nunca some do rótulo do chip ativo quando o rascunho não bate com nenhum preset computado nem com um mês inteiro. */
type ChaveVisualPreset = ChavePresetPeriodo | "mes-especifico" | "personalizado";

const CONSULTA_TELA_MOBILE = "(max-width: 767px)";

function criarHookDeMediaQuery(consultaCss: string) {
  function inscrever(notificar: () => void) {
    const consulta = window.matchMedia(consultaCss);
    consulta.addEventListener("change", notificar);
    return () => consulta.removeEventListener("change", notificar);
  }

  function obterInstantaneo() {
    return window.matchMedia(consultaCss).matches;
  }

  function obterInstantaneoNoServidor() {
    return false;
  }

  /**
   * `useSyncExternalStore` em vez de `useEffect` + `useState`: evita o
   * "cascading render" de chamar `setState` de dentro de um efeito só pra
   * ler o valor inicial (a regra `react-hooks/set-state-in-effect` bane
   * exatamente esse padrão) — e já é SSR-safe por construção (o snapshot do
   * servidor devolve `false`, nunca lê `window` fora do cliente).
   */
  return function useMediaQuery(): boolean {
    return React.useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoNoServidor);
  };
}

const useEhTelaMobile = criarHookDeMediaQuery(CONSULTA_TELA_MOBILE);

/**
 * Espaço mínimo (em px) que o layout de DOIS calendários lado a lado
 * precisa pra caber sem cortar nada. Altura medida DE VERDADE com
 * Playwright (o painel real — inputs + calendário + presets + rodapé —
 * renderiza a ~389px numa viewport bem alta, sem precisar rolar): 460px dá
 * uma margem de ~70px pra fonte/borda/padding variarem entre navegador/SO
 * sem virar um cálculo tão folgado que force o layout compacto em telas
 * que já teriam espaço de sobra pros dois calendários. Largura: 760px, o
 * painel de dois calendários mede 720px (ver `largura` em
 * `PainelFiltroPeriodo`) mais margem de segurança equivalente.
 */
const LARGURA_MINIMA_DOIS_CALENDARIOS = 760;
const ALTURA_MINIMA_DOIS_CALENDARIOS = 460;

/**
 * Decide o layout compacto medindo o espaço disponível AO REDOR DO
 * GATILHO de verdade (`getBoundingClientRect`), não só o tamanho da
 * viewport — os dois só coincidem quando o gatilho fica no meio da tela.
 * Reportado ao vivo pelo dono do projeto: numa janela de ~1100×500 com o
 * gatilho perto do TOPO da página, a viewport inteira tem largura de
 * sobra (1100 > 900), mas o espaço vertical disponível ao redor do
 * gatilho — o que importa de verdade, já que é ele que limita onde o
 * Radix consegue encaixar o popover — é bem menor que os 500px inteiros
 * da janela (o gatilho já ocupa uma fatia vertical, então nem "acima" nem
 * "abaixo" dele sobra tudo). Usa o MAIOR dos dois lados (acima/abaixo),
 * já que é pra esse lado que o `avoidCollisions` do Radix vai inverter o
 * popover.
 */
function medirSeEspacoEhCompacto(gatilho: HTMLElement | null): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < LARGURA_MINIMA_DOIS_CALENDARIOS) return true;
  if (!gatilho) return false;

  const retangulo = gatilho.getBoundingClientRect();
  const espacoAcima = retangulo.top;
  const espacoAbaixo = window.innerHeight - retangulo.bottom;
  const melhorEspacoVertical = Math.max(espacoAcima, espacoAbaixo);

  return melhorEspacoVertical < ALTURA_MINIMA_DOIS_CALENDARIOS;
}

function inicioDoMesDeCalendario(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

/** Passado como `onSelect` do `react-day-picker` — nunca chamado pra decidir nada (ver o comentário grande em `CalendarioIntervalo` sobre por que ele existe mesmo assim). */
function aoSelecionarNativoNoOp() {
  // Intencionalmente vazio.
}

export interface FiltroPeriodoProps {
  /** Opções de campo de data (ex.: Vencimento/Pagamento/Emissão). O seletor só aparece quando há mais de uma opção — nunca hardcoded dentro do componente. */
  campos?: OpcaoCampoPeriodo[];
  /** Rótulo fixo do botão-gatilho quando não há seletor de campo (0 ou 1 opção em `campos`) — ex. "Período". Ignorado quando `campos.length > 1`. */
  rotulo?: string;
  /** Fuso horário da loja (`Configuracao.fusoHorario`) — todo cálculo de preset usa este valor, nunca o fuso do navegador. */
  fusoHorario?: string;
  /** Intervalo usado quando a URL ainda não tem `inicio`/`fim` (ou eles são inválidos). Padrão: "Este mês". */
  intervaloPadrao?: IntervaloPeriodo;
  /** Nomes dos search params — só pra evitar colisão se uma mesma tela precisar de duas instâncias. */
  nomesParams?: NomesParamsPeriodo;
  /**
   * Outros search params pra escrever na MESMA navegação que grava
   * `inicio`/`fim` ao clicar "Filtrar" — ex. a home marca `periodo=custom`
   * junto (ver `components/dashboard/cabecalho-dashboard.tsx`). Usar isto
   * em vez de um `router.push` separado dentro de `aoFiltrar`: senão duas
   * navegações concorrentes disputam qual "ganha" (a segunda pode ler
   * `searchParams` ainda desatualizado e sobrescrever o `inicio`/`fim` que
   * a primeira acabou de gravar).
   */
  paramsAdicionais?: Record<string, string>;
  /** Chamado além da atualização da URL, ao clicar "Filtrar". */
  aoFiltrar?: (resultado: { campo: string | undefined; intervalo: IntervaloPeriodo }) => void;
  className?: string;
}

export function FiltroPeriodo({
  campos,
  rotulo,
  fusoHorario = FUSO_HORARIO_PADRAO,
  intervaloPadrao,
  nomesParams = NOMES_PARAMS_PERIODO_PADRAO,
  paramsAdicionais,
  aoFiltrar,
  className,
}: FiltroPeriodoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ehMobile = useEhTelaMobile();
  const conteudoRef = React.useRef<HTMLDivElement>(null);
  const gatilhoRef = React.useRef<HTMLButtonElement>(null);
  // Medido no momento de ABRIR (não um media query de viewport — ver
  // `medirSeEspacoEhCompacto`), então só precisa de estado normal: o valor
  // certo já está pronto quando `PainelFiltroPeriodo` monta pela primeira
  // vez (a chamada em `aoMudarAberto`, abaixo, roda ANTES do `setAberto`
  // no mesmo handler, então os dois batches num render só).
  const [compacto, setCompacto] = React.useState(false);

  const valorPadrao = React.useMemo(
    () => intervaloPadrao ?? calcularPresetEsteMes(fusoHorario),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fusoHorario]
  );

  const lidoDaUrl = React.useMemo(
    () => ({
      campo: searchParams.get(nomesParams.campo) ?? undefined,
      inicio: searchParams.get(nomesParams.inicio),
      fim: searchParams.get(nomesParams.fim),
    }),
    [searchParams, nomesParams]
  );

  const intervaloComprometido = React.useMemo<IntervaloPeriodo>(() => {
    if (lidoDaUrl.inicio && lidoDaUrl.fim) {
      const inicio = interpretarDataParaCalendario(lidoDaUrl.inicio);
      const fim = interpretarDataParaCalendario(lidoDaUrl.fim);
      if (inicio && fim && validarIntervalo(inicio, fim).valido) {
        return { inicio, fim };
      }
    }
    return valorPadrao;
  }, [lidoDaUrl, valorPadrao]);

  const campoPadrao = campos && campos.length > 0 ? campos[0].valor : undefined;
  const campoComprometido =
    campos && campos.length > 0
      ? (campos.find((opcao) => opcao.valor === lidoDaUrl.campo)?.valor ?? campoPadrao)
      : undefined;

  const [aberto, setAberto] = React.useState(false);

  // O dono do projeto testou ao vivo e reportou que o popover "acompanha o
  // scroll da página" — confirmado com Playwright: o Popover do Radix é
  // `position: fixed` (correto, sem nenhum ancestral com `transform`
  // quebrando o containing block — checado via getComputedStyle na cadeia
  // inteira até `<html>`) e o Floating UI dele RE-POSICIONA de propósito
  // pra continuar "grudado" no gatilho enquanto a página rola por baixo —
  // isso é o comportamento padrão da biblioteca, não um bug de CSS. Ele
  // queria o oposto: parado no lugar. Como não tem uma prop pública do
  // Radix Popover pra desligar só o "seguir no scroll" sem desligar o
  // resto do posicionamento, o padrão mais comum (e o mais simples e
  // robusto) pra esse pedido é FECHAR o popover quando a página rola por
  // baixo dele — nunca quando a rolagem é DENTRO do próprio popover (ex.:
  // a área de calendário/presets ficando rolável em telas curtas). Fecha
  // também no `resize` da janela pelo mesmo motivo: o layout compacto×dois
  // calendários é decidido ao ABRIR (medindo o espaço real ao redor do
  // gatilho, ver `medirSeEspacoEhCompacto`) — re-medir e trocar de layout
  // com o popover já aberto seria mais complexo que só fechar, e resize
  // com o popover aberto é uma interação rara o bastante pra isso ser uma
  // troca razoável.
  React.useEffect(() => {
    if (!aberto) return;

    // A própria ABERTURA às vezes dispara um scroll (confirmado com
    // Playwright: `<main>` rola ~21px sozinho logo que o popover monta,
    // efeito colateral de foco/posicionamento do Radix — não uma rolagem
    // do usuário) — sem este atraso, o listener abaixo pegava ESSE scroll
    // e fechava o popover no mesmo instante em que abria (reproduzido de
    // verdade numa janela curta, onde o gatilho fica perto da borda). Só
    // passa a reagir a scroll/resize depois que a abertura terminou de
    // assentar.
    let ativo = false;
    const temporizador = window.setTimeout(() => {
      ativo = true;
    }, 350);

    function aoRolarFora(evento: Event) {
      if (!ativo) return;
      const alvo = evento.target;
      if (conteudoRef.current && alvo instanceof Node && conteudoRef.current.contains(alvo)) {
        return;
      }
      setAberto(false);
    }

    function aoRedimensionar() {
      if (!ativo) return;
      setAberto(false);
    }

    // `capture: true`: eventos de scroll não borbulham no DOM — só assim um
    // listener num ancestral comum (aqui, `document`) pega o scroll de UM
    // container rolável específico lá dentro (ex.: o `<main>` do shell do
    // app), não só o scroll da window.
    document.addEventListener("scroll", aoRolarFora, true);
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("scroll", aoRolarFora, true);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [aberto]);

  /**
   * Decide dois calendários × compacto no momento de ABRIR, medindo o
   * espaço de verdade ao redor do GATILHO (`medirSeEspacoEhCompacto`) — não
   * um media query de viewport. Reportado ao vivo: numa janela curta
   * (~1100×500) com o gatilho perto do topo da página, a viewport tem
   * largura de sobra, mas o espaço VERTICAL disponível ao redor do
   * gatilho — o que realmente limita onde o painel cabe — é bem menor que
   * a altura inteira da janela. As duas `setState` abaixo (aqui e a que o
   * Radix dispara via `open`) acontecem no mesmo handler, então o React
   * aplica as duas juntas antes do próximo render — `PainelFiltroPeriodo`
   * já monta com o `compacto` certo na primeira renderização, sem piscar
   * o layout errado primeiro.
   */
  function aoMudarAberto(novoAberto: boolean) {
    if (novoAberto) {
      setCompacto(medirSeEspacoEhCompacto(gatilhoRef.current));
    }
    setAberto(novoAberto);
  }

  const rotuloCampoAtual =
    campos && campos.length > 0
      ? campos.find((opcao) => opcao.valor === campoComprometido)?.rotulo
      : rotulo;

  const rotuloBotao = formatarRotuloIntervalo(intervaloComprometido, rotuloCampoAtual);

  function aoConfirmar(resultado: { campo: string | undefined; intervalo: IntervaloPeriodo }) {
    const params = paraSearchParams(resultado.intervalo, resultado.campo, searchParams, nomesParams);
    if (paramsAdicionais) {
      for (const [chave, valor] of Object.entries(paramsAdicionais)) {
        params.set(chave, valor);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
    aoFiltrar?.(resultado);
    setAberto(false);
  }

  const gatilho = (
    <Button
      ref={gatilhoRef}
      type="button"
      variant="outline"
      className={cn("h-10 min-h-11 gap-2 rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3 text-sm font-medium text-kx-texto", className)}
    >
      <IconeCalendario className="size-4 text-kx-legenda" />
      <span>{rotuloBotao}</span>
    </Button>
  );

  if (ehMobile) {
    return (
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild>{gatilho}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-kx-painel">
          <SheetHeader>
            <SheetTitle>Filtrar por período</SheetTitle>
          </SheetHeader>
          {aberto && (
            <PainelFiltroPeriodo
              campos={campos}
              campoInicial={campoComprometido}
              intervaloInicial={intervaloComprometido}
              fusoHorario={fusoHorario}
              variante="folha"
              compacto={false}
              aoCancelar={() => setAberto(false)}
              aoConfirmar={aoConfirmar}
            />
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={aoMudarAberto}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent
        ref={conteudoRef}
        align="start"
        collisionPadding={16}
        avoidCollisions
        // Sem isto, o autofoco padrão do Radix (foca o primeiro campo
        // focável ao abrir — aqui, "Início do período") deixa o texto
        // inteiro SELECIONADO nesse primeiro foco (comportamento nativo do
        // navegador ao focar um input recém-montado por foco programático,
        // não algo que `onFocus`/`setSelectionRange` no próprio Input
        // consiga vencer — o navegador aplica a seleção DEPOIS do evento
        // `focus`). `preventDefault` aqui desliga só o autofoco automático —
        // o usuário ainda navega pro campo normalmente com Tab/clique, sem
        // nada vir pré-selecionado.
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        // O limite de altura (rede de segurança pra viewport curta — ex.:
        // notebook com zoom alto, onde nem invertendo o lado o painel cabe
        // inteiro) fica no filho — PainelFiltroPeriodo usa a mesma variável
        // CSS do Radix pra altura disponível — não aqui: só a ÁREA DE
        // CONTEÚDO rola, o rodapé (Cancelar/Filtrar) fica sempre visível.
        className="w-auto max-w-[calc(100vw-32px)] overflow-hidden p-0"
      >
        {aberto && (
          <PainelFiltroPeriodo
            campos={campos}
            campoInicial={campoComprometido}
            intervaloInicial={intervaloComprometido}
            fusoHorario={fusoHorario}
            variante="popover"
            compacto={compacto}
            aoCancelar={() => setAberto(false)}
            aoConfirmar={aoConfirmar}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Painel interno (rascunho local até "Filtrar") ───────────────────────────

interface PainelFiltroPeriodoProps {
  campos?: OpcaoCampoPeriodo[];
  campoInicial: string | undefined;
  intervaloInicial: IntervaloPeriodo;
  fusoHorario: string;
  variante: "popover" | "folha";
  /** Sem espaço pra dois calendários lado a lado (viewport curta/estreita) — mostra um único calendário, mesmo na variante "popover". */
  compacto: boolean;
  aoCancelar: () => void;
  aoConfirmar: (resultado: { campo: string | undefined; intervalo: IntervaloPeriodo }) => void;
}

/** Converte "yyyy-MM-dd" pro tipo Date de calendário deste módulo — só um alias local pra não importar `dataDeCalendario` duas vezes com nomes diferentes num mesmo arquivo grande. */
function interpretarDataParaCalendario(anoMesDiaIso: string): Date | null {
  return interpretarDataDigitada(isoParaDigitado(anoMesDiaIso));
}

function isoParaDigitado(anoMesDiaIso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anoMesDiaIso);
  if (!partes) return "";
  const [, ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function PainelFiltroPeriodo({
  campos,
  campoInicial,
  intervaloInicial,
  fusoHorario,
  variante,
  compacto,
  aoCancelar,
  aoConfirmar,
}: PainelFiltroPeriodoProps) {
  const [campoRascunho, setCampoRascunho] = React.useState(campoInicial);
  const [intervaloRascunho, setIntervaloRascunho] = React.useState(intervaloInicial);
  const [textoInicio, setTextoInicio] = React.useState(() => formatarDataExibicao(intervaloInicial.inicio));
  const [textoFim, setTextoFim] = React.useState(() => formatarDataExibicao(intervaloInicial.fim));
  const [erro, setErro] = React.useState<string | undefined>(undefined);
  const [mostrarGradeMes, setMostrarGradeMes] = React.useState(false);
  const [gradeMesAno, setGradeMesAno] = React.useState<MesDeCalendario>(
    () => identificarMesEspecifico(intervaloInicial) ?? mesDeCalendarioAtual(fusoHorario)
  );

  // Dois calendários com papéis DISTINTOS (esquerda = início, direita =
  // fim) — cada um navega de mês de forma INDEPENDENTE (um intervalo de
  // janeiro a setembro é só 2 cliques, nunca precisa paginar mês a mês),
  // então cada um precisa do SEU PRÓPRIO estado de mês exibido. Isso é
  // diferente do bug da versão anterior: lá, o que vazava eram dois
  // ESTADOS DE SELEÇÃO paralelos (cada `DayPicker` completando sua própria
  // faixa); aqui só o mês exibido é paralelo — a faixa pintada nos dois
  // calendários vem do MESMO `intervaloRascunho` (via `faixaAtual` abaixo),
  // então os dois NUNCA dessincronizam visualmente.
  const [mesEsquerda, setMesEsquerda] = React.useState(() => inicioDoMesDeCalendario(intervaloInicial.inicio));
  const [mesDireita, setMesDireita] = React.useState(() => inicioDoMesDeCalendario(intervaloInicial.fim));
  // Layout compacto (um calendário só): qual ponta do intervalo um clique
  // define agora, trocado pelo alternador "Início/Fim" acima do calendário.
  const [ladoCompactoAtivo, setLadoCompactoAtivo] = React.useState<"inicio" | "fim">("inicio");

  // "Período customizado" (chip de preset) não tem uma FÓRMULA própria —
  // ao contrário de "Este mês"/"Mês passado"/etc., que `identificarPresetAtivo`
  // reconhece comparando datas, "personalizado" é estruturalmente "não bate
  // com nada". Isso significa que `chaveVisualAtiva` (calculada a partir de
  // `intervaloRascunho`, mais abaixo) NUNCA fica "personalizado" só porque
  // o usuário clicou o chip — se o intervalo atual por acaso bate com "Este
  // mês", clicar "Período customizado" sem mexer nas datas não mudaria
  // nada visualmente sem este override explícito. `presetForcado` existe
  // só pra isso: fica "personalizado" a partir do clique no chip, e volta
  // a `null` (deixa o cálculo normal assumir de novo) assim que o
  // intervalo REALMENTE muda — via `aplicarNovoIntervalo`, chamada por
  // todo outro caminho que move as datas (presets, cliques no calendário,
  // digitação).
  const [presetForcado, setPresetForcado] = React.useState<"personalizado" | null>(null);
  const inputInicioRef = React.useRef<HTMLInputElement>(null);
  const [pedidoDeFoco, setPedidoDeFoco] = React.useState(0);

  React.useEffect(() => {
    if (pedidoDeFoco === 0) return;
    // `preventScroll`: focar um campo que já está visível não pode rolar
    // nada na tela (pedido explícito) — o padrão do navegador rolaria o
    // elemento pra vista mesmo já estando visível, em alguns casos.
    inputInicioRef.current?.focus({ preventScroll: true });
    inputInicioRef.current?.select();
  }, [pedidoDeFoco]);

  const faixaAtual: DateRange = { from: intervaloRascunho.inicio, to: intervaloRascunho.fim };

  function aplicarNovoIntervalo(
    novo: IntervaloPeriodo,
    opcoes: { moverEsquerda?: boolean; moverDireita?: boolean } = {}
  ) {
    const resultado = validarIntervalo(novo.inicio, novo.fim);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    setErro(undefined);
    setPresetForcado(null);
    setIntervaloRascunho(novo);
    setTextoInicio(formatarDataExibicao(novo.inicio));
    setTextoFim(formatarDataExibicao(novo.fim));
    if (opcoes.moverEsquerda !== false) {
      setMesEsquerda(inicioDoMesDeCalendario(novo.inicio));
    }
    if (opcoes.moverDireita !== false) {
      setMesDireita(inicioDoMesDeCalendario(novo.fim));
    }
  }

  function aoClicarPreset(chave: ChavePresetPeriodo) {
    const definicao = PRESETS_PERIODO.find((preset) => preset.chave === chave);
    if (!definicao) return;
    setMostrarGradeMes(false);
    aplicarNovoIntervalo(definicao.calcular(fusoHorario));
  }

  function aoAbrirSeletorDeMes() {
    setGradeMesAno(identificarMesEspecifico(intervaloRascunho) ?? mesDeCalendarioAtual(fusoHorario));
    setMostrarGradeMes(true);
  }

  function aoEscolherMesNaGrade(mesIndiceZero: number) {
    const mes: MesDeCalendario = { ano: gradeMesAno.ano, mesIndiceZero };
    setMostrarGradeMes(false);
    aplicarNovoIntervalo(calcularIntervaloMesEspecifico(mes));
  }

  /**
   * "Período customizado": vira o preset ativo, mantém o intervalo atual
   * intacto (não é um preset com fórmula própria — é o "modo manual"), e
   * move o foco pro campo "Início do período" com o texto selecionado,
   * pronto pra digitar por cima. Não muda `mesEsquerda`/`mesDireita` nem
   * `intervaloRascunho` — só sair da grade de mês (se estava aberta) e
   * marcar o preset.
   */
  function aoVoltarParaPeriodoCustomizado() {
    setMostrarGradeMes(false);
    setPresetForcado("personalizado");
    setPedidoDeFoco((atual) => atual + 1);
  }

  /**
   * Clique no calendário de INÍCIO: o dia clicado sempre vira o novo
   * início — nunca depende de quantos cliques já aconteceram (diferente do
   * fluxo padrão de "dois cliques" do `mode="range"` da biblioteca, que
   * este componente propositalmente ignora — ver `CalendarioIntervalo`).
   * Se o dia clicado é DEPOIS do fim atual, o fim se ajusta pro mesmo dia
   * — o intervalo nunca fica invertido, sem precisar de mensagem de erro
   * (pedido explícito do dono do projeto: isso é diferente de digitar uma
   * data inválida nos campos de texto, que continua mostrando erro).
   */
  function aoClicarDiaEsquerda(dia: Date) {
    setMostrarGradeMes(false);
    const fimPrecisaAjustar = dia.getTime() > intervaloRascunho.fim.getTime();
    aplicarNovoIntervalo(
      { inicio: dia, fim: fimPrecisaAjustar ? dia : intervaloRascunho.fim },
      { moverEsquerda: false, moverDireita: fimPrecisaAjustar }
    );
  }

  /** Espelho de `aoClicarDiaEsquerda` pro calendário de FIM. */
  function aoClicarDiaDireita(dia: Date) {
    setMostrarGradeMes(false);
    const inicioPrecisaAjustar = dia.getTime() < intervaloRascunho.inicio.getTime();
    aplicarNovoIntervalo(
      { inicio: inicioPrecisaAjustar ? dia : intervaloRascunho.inicio, fim: dia },
      { moverEsquerda: inicioPrecisaAjustar, moverDireita: false }
    );
  }

  /** No layout compacto (um calendário só), o alternador decide qual das duas funções acima o clique único usa. */
  function aoClicarDiaCompacto(dia: Date) {
    if (ladoCompactoAtivo === "inicio") {
      aoClicarDiaEsquerda(dia);
    } else {
      aoClicarDiaDireita(dia);
    }
  }

  function aoDigitarInicio(valorDigitado: string) {
    const mascarado = aplicarMascaraDataDigitada(valorDigitado);
    setTextoInicio(mascarado);
    const novaData = interpretarDataDigitada(mascarado);
    if (!novaData) return; // incompleto/inválido — mantém o intervalo válido anterior
    aplicarNovoIntervalo(
      { inicio: novaData, fim: intervaloRascunho.fim },
      { moverEsquerda: true, moverDireita: false }
    );
  }

  function aoDigitarFim(valorDigitado: string) {
    const mascarado = aplicarMascaraDataDigitada(valorDigitado);
    setTextoFim(mascarado);
    const novaData = interpretarDataDigitada(mascarado);
    if (!novaData) return;
    aplicarNovoIntervalo(
      { inicio: intervaloRascunho.inicio, fim: novaData },
      { moverEsquerda: false, moverDireita: true }
    );
  }

  function aoClicarFiltrar() {
    const resultado = validarIntervalo(intervaloRascunho.inicio, intervaloRascunho.fim);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    aoConfirmar({ campo: campoRascunho, intervalo: intervaloRascunho });
  }

  const chaveVisualAtiva: ChaveVisualPreset =
    presetForcado ??
    identificarPresetAtivo(intervaloRascunho, fusoHorario) ??
    (identificarMesEspecifico(intervaloRascunho) ? "mes-especifico" : "personalizado");

  /**
   * Os chips de preset (`Hoje`.."Período customizado") — extraído numa
   * função à parte porque o layout de DOIS calendários (barra lateral) e o
   * layout COMPACTO (linha horizontal no topo) mostram exatamente os
   * MESMOS chips, só dentro de containers/orientações diferentes. Escolher
   * qualquer um aqui continua chamando os mesmos handlers que já mexem em
   * `intervaloRascunho`/`textoInicio`/`textoFim`/o mês exibido — a
   * reordenação do layout compacto não muda NADA do comportamento, só
   * ONDE os chips aparecem visualmente.
   */
  function renderizarChipsDePresets() {
    return (
      <>
        {PRESETS_PERIODO.map((preset) => (
          <ChipPreset
            key={preset.chave}
            ativo={chaveVisualAtiva === preset.chave}
            onClick={() => aoClicarPreset(preset.chave)}
          >
            {preset.rotulo}
          </ChipPreset>
        ))}
        <ChipPreset ativo={chaveVisualAtiva === "mes-especifico"} onClick={aoAbrirSeletorDeMes}>
          Selecionar mês
        </ChipPreset>
        <ChipPreset ativo={chaveVisualAtiva === "personalizado"} onClick={aoVoltarParaPeriodoCustomizado}>
          Período customizado
        </ChipPreset>
      </>
    );
  }

  const mostrarSeletorDeCampo = Boolean(campos && campos.length > 1);
  const numeroDeCalendarios = variante === "folha" || compacto ? 1 : 2;

  function aoFocarSemSelecionarTudo(evento: React.FocusEvent<HTMLInputElement>) {
    // Foca o campo sem selecionar o texto inteiro — o comportamento padrão
    // do navegador ao focar um input controlado (inclusive via foco
    // automático do Radix Popover ao abrir) pode deixar o valor inteiro
    // destacado, o que atrapalha continuar digitando/corrigindo uma data.
    const valor = evento.target.value;
    evento.target.setSelectionRange(valor.length, valor.length);
  }

  // Layout decidido por ESTADO (variante/numeroDeCalendarios, calculados em
  // JS a partir de `useEhTelaMobile`/`useEhEspacoCompacto`), nunca por
  // breakpoint `sm:`/`md:` do Tailwind — os dois não têm por que coincidir
  // (a consulta de "espaço compacto" é 900×560, bem diferente do `sm` do
  // Tailwind, 640px) misturar os dois foi a causa da largura/altura do
  // popover saírem do controle em telas reais.
  const ladoALado = variante === "popover" && numeroDeCalendarios === 2;
  // 720px: cada calendário tem largura mínima fixa (7 colunas × 36px =
  // 252px, o grid de dias não encolhe) — dois lado a lado + gap-3 entre
  // eles + o padding da coluna de conteúdo já somam 540px, mais a barra de
  // presets (w-44 = 176px) dá 716px. Um valor menor aqui faz o flexbox
  // forçar a largura mínima dos calendários mesmo assim (min-width: auto
  // é o padrão em flex items), estourando o container e cortando o que
  // teria que encolher — confirmado com Playwright (o rótulo "Início do
  // período" aparecia cortado, embora o texto no DOM estivesse correto).
  const largura = variante === "folha" ? "w-full" : ladoALado ? "w-[720px]" : "w-[340px]";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        variante === "popover" &&
          "max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-32px)] rounded-md bg-popover text-popover-foreground",
        largura
      )}
    >
      {/*
        flex-1 + min-h-0: dentro de um pai com max-height (não height fixo),
        é isto que faz esta área ceder e virar rolável quando o conteúdo
        (calendários + inputs + presets) não cabe no espaço disponível — sem
        min-h-0 o flex item nunca encolhe abaixo do tamanho do seu próprio
        conteúdo, e o overflow-y-auto abaixo nunca teria efeito. O rodapé
        (Cancelar/Filtrar), fora desta div, nunca faz parte da rolagem —
        sempre visível, sem exigir rolar até o fim pra achá-lo.
      */}
      <div className={cn("flex w-full min-h-0 flex-1 overflow-y-auto", ladoALado ? "flex-row" : "flex-col")}>
        {/*
          Layout COMPACTO (um calendário só — popover estreito/curto ou a
          folha mobile): presets primeiro, ANTES dos campos/calendário —
          pedido do dono do projeto depois de testar ao vivo: "Este mês"/
          "Mês passado" são as ações mais usadas, e no layout de baixo pra
          cima anterior (calendário inteiro, DEPOIS os presets) chegar nelas
          exigia rolar por baixo do calendário primeiro. Uma linha só,
          `flex-nowrap` + `overflow-x-auto` (nunca quebra em várias linhas —
          diferente da versão anterior, que usava `flex-wrap`). Só nesta
          orientação: o layout de DOIS calendários mantém os presets na
          barra lateral de sempre, sem mudança (ver o outro bloco de
          presets, mais abaixo, fora deste `!ladoALado`).
        */}
        {!ladoALado && (
          <div className="flex shrink-0 flex-nowrap gap-1.5 overflow-x-auto border-b border-kx-painel-borda bg-popover p-3">
            {renderizarChipsDePresets()}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-3">
          {mostrarSeletorDeCampo && (
            <SeletorDeCampo campos={campos!} valor={campoRascunho} aoSelecionar={setCampoRascunho} />
          )}

          {erro && (
            <p role="alert" className="text-xs font-medium text-kx-erro">
              {erro}
            </p>
          )}

          {mostrarGradeMes ? (
            <GradeMesAno
              mesAno={gradeMesAno}
              mesSelecionado={identificarMesEspecifico(intervaloRascunho)}
              aoMudarAno={(ano) => setGradeMesAno((atual) => ({ ...atual, ano }))}
              aoEscolherMes={aoEscolherMesNaGrade}
            />
          ) : numeroDeCalendarios === 2 ? (
            // min-w-0 nas duas colunas: sem isto, `min-width: auto` (o
            // padrão em flex item) faz cada coluna recusar encolher abaixo
            // da largura mínima do CONTEÚDO dela (o grid de dias do
            // calendário, 252px fixos) — mesmo com a largura do painel já
            // calibrada (`largura`, mais abaixo), qualquer diferença entre
            // a conta teórica e o que renderiza de verdade (fonte, borda,
            // padding) faz o flexbox estourar o container em vez de
            // simplesmente encolher o que sobra. Confirmado com Playwright.
            <div className="flex min-w-0 flex-row gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filtro-periodo-inicio" className="text-xs text-kx-legenda">
                    Início do período
                  </Label>
                  <Input
                    ref={inputInicioRef}
                    id="filtro-periodo-inicio"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={textoInicio}
                    onChange={(evento) => aoDigitarInicio(evento.target.value)}
                    onFocus={aoFocarSemSelecionarTudo}
                    className="h-9"
                  />
                </div>
                <CalendarioIntervalo
                  mes={mesEsquerda}
                  aoMudarMes={setMesEsquerda}
                  faixa={faixaAtual}
                  aoClicarDia={aoClicarDiaEsquerda}
                  fusoHorario={fusoHorario}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filtro-periodo-fim" className="text-xs text-kx-legenda">
                    Fim do período
                  </Label>
                  <Input
                    id="filtro-periodo-fim"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={textoFim}
                    onChange={(evento) => aoDigitarFim(evento.target.value)}
                    onFocus={aoFocarSemSelecionarTudo}
                    className="h-9"
                  />
                </div>
                <CalendarioIntervalo
                  mes={mesDireita}
                  aoMudarMes={setMesDireita}
                  faixa={faixaAtual}
                  aoClicarDia={aoClicarDiaDireita}
                  fusoHorario={fusoHorario}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filtro-periodo-inicio" className="text-xs text-kx-legenda">
                    Início do período
                  </Label>
                  <Input
                    ref={inputInicioRef}
                    id="filtro-periodo-inicio"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={textoInicio}
                    onChange={(evento) => aoDigitarInicio(evento.target.value)}
                    onFocus={aoFocarSemSelecionarTudo}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filtro-periodo-fim" className="text-xs text-kx-legenda">
                    Fim do período
                  </Label>
                  <Input
                    id="filtro-periodo-fim"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={textoFim}
                    onChange={(evento) => aoDigitarFim(evento.target.value)}
                    onFocus={aoFocarSemSelecionarTudo}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Layout compacto: um calendário só — este alternador decide se o próximo clique nele define o início ou o fim. */}
              <div
                role="tablist"
                aria-label="Ponta do período que o calendário edita"
                className="flex gap-1 rounded-kx-botao bg-kx-superficie p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={ladoCompactoAtivo === "inicio"}
                  onClick={() => setLadoCompactoAtivo("inicio")}
                  className={cn(
                    "flex-1 rounded-kx-botao px-2 py-1.5 text-xs font-medium transition-colors",
                    ladoCompactoAtivo === "inicio"
                      ? "bg-primary text-primary-foreground"
                      : "text-kx-legenda hover:text-kx-texto"
                  )}
                >
                  Início
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={ladoCompactoAtivo === "fim"}
                  onClick={() => setLadoCompactoAtivo("fim")}
                  className={cn(
                    "flex-1 rounded-kx-botao px-2 py-1.5 text-xs font-medium transition-colors",
                    ladoCompactoAtivo === "fim"
                      ? "bg-primary text-primary-foreground"
                      : "text-kx-legenda hover:text-kx-texto"
                  )}
                >
                  Fim
                </button>
              </div>

              <CalendarioIntervalo
                mes={ladoCompactoAtivo === "inicio" ? mesEsquerda : mesDireita}
                aoMudarMes={ladoCompactoAtivo === "inicio" ? setMesEsquerda : setMesDireita}
                faixa={faixaAtual}
                aoClicarDia={aoClicarDiaCompacto}
                fusoHorario={fusoHorario}
              />
            </div>
          )}
        </div>

        {/* Layout de DOIS calendários: presets na barra lateral de sempre — só o layout COMPACTO (bloco no topo, acima) mudou de lugar. */}
        {ladoALado && (
          <div className="flex w-44 shrink-0 flex-col gap-1.5 border-l border-kx-painel-borda bg-popover p-3">
            {renderizarChipsDePresets()}
          </div>
        )}
      </div>

      {/* Fora da área rolável de propósito (ver comentário acima) — o
          rodapé nunca esconde atrás de uma rolagem que o usuário talvez
          nem perceba que existe. */}
      <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-kx-painel-borda bg-popover p-2">
        <Button type="button" variant="ghost" className="h-9" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="button" variant="default" className="h-9" onClick={aoClicarFiltrar}>
          Filtrar
        </Button>
      </div>
    </div>
  );
}

// ── Peças menores ───────────────────────────────────────────────────────────

function SeletorDeCampo({
  campos,
  valor,
  aoSelecionar,
}: {
  campos: OpcaoCampoPeriodo[];
  valor: string | undefined;
  aoSelecionar: (valor: string) => void;
}) {
  const atual = campos.find((opcao) => opcao.valor === valor) ?? campos[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-9 w-fit gap-1.5 self-start">
          {atual.rotulo}
          <ChevronDown className="size-4 text-kx-legenda" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {campos.map((opcao) => (
          <DropdownMenuItem key={opcao.valor} onSelect={() => aoSelecionar(opcao.valor)}>
            {opcao.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChipPreset({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "min-h-9 shrink-0 rounded-kx-botao px-2.5 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        ativo
          ? "bg-primary/15 text-primary"
          : "text-kx-legenda hover:bg-kx-superficie hover:text-kx-texto"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Medidas calibradas contra `docs/design/referencia-filtro-periodo-bling.png`
 * (chegou durante a Fase 2A-1 — antes disso, "mais compacto" era um pedido
 * às cegas, comparado contra um estado com bug que inflava o painel bem
 * além do normal; a referência real mede célula de dia ~38×38px, não algo
 * minúsculo estilo app mobile). Célula de dia 36×36px (`size-9`, o mais
 * próximo do grid de 4px que chega perto dos ~38px medidos), círculo
 * VISÍVEL de 32px dentro dela (`border-2 border-transparent
 * bg-clip-padding` — a mesma técnica de `buttonVariants` em
 * `components/ui/button.tsx` — encolhe só a área PINTADA, o alvo de
 * clique/toque continua os 36px inteiros da célula), linha de dias da
 * semana com 28px de altura (`h-7`) e cabeçalho do mês com 36px (`h-9`).
 *
 * `months`/`month` precisam de `relative`: o `Nav` (setas de mês) do
 * react-day-picker é filho de `Months` (não de `Month`/`MonthCaption` — ver
 * `node_modules/react-day-picker/dist/esm/DayPicker.js`, o Nav só entra
 * dentro do `MonthCaption` quando `navLayout` está setado, o que não é o
 * caso aqui) — sem um ancestral posicionado aí, o `absolute` do Nav escapa
 * pro container posicionado mais próximo na árvore. Com DOIS `DayPicker`
 * (`numberOfMonths={1}` cada — ver `CalendarioIntervalo`), cada instância
 * tem seu próprio `Months`/Nav — as setas ficam na linha de título de CADA
 * calendário, naturalmente, sem precisar de nada especial aqui.
 *
 * `select-none` no `months` (herda pros filhos — dias, cabeçalho, tudo):
 * sem isso, um clique duplo no título do mês ("setembro 2026") seleciona o
 * texto como se fosse um parágrafo comum, feio e sem função nenhuma aqui.
 *
 * Estilo do intervalo — só início e fim são círculo cheio, o meio é uma
 * faixa clara contínua: a biblioteca aplica o modificador genérico
 * "selected" a TODO dia dentro do intervalo (não só as pontas —
 * confirmado lendo `node_modules/react-day-picker/dist/esm/DayPicker.js`,
 * a linha que faz `modifiers[SelectionState.selected] = isSelected?.(date)
 * || ...` roda pra cada dia que `rangeIncludesDate` inclui), ALÉM de
 * "range_start"/"range_middle"/"range_end". Pintar o botão a partir de
 * "selected" deixaria TODO dia do intervalo com o mesmo círculo cheio das
 * pontas — daí "selected" abaixo não pinta nada: só "range_start"/
 * "range_end" (círculo cheio + canto arredondado do lado de fora) e
 * "range_middle" (faixa clara na CÉLULA, sem círculo no botão) carregam
 * cor. Um intervalo de um dia só marca o MESMO dia como "range_start" E
 * "range_end" ao mesmo tempo (a biblioteca faz isso quando `from`/`to`
 * caem no mesmo dia) — as duas bordas arredondadas juntas viram um círculo
 * só, sem precisar de caso especial aqui. Como os DOIS calendários recebem
 * a MESMA faixa (`faixaAtual`, computada uma vez em `PainelFiltroPeriodo`
 * a partir do único `intervaloRascunho`), a faixa pintada é sempre
 * idêntica nos dois — nunca dessincroniza.
 *
 * "outside" (dias de outro mês) usa `!` (important) pra sempre vencer
 * qualquer classe de "range_*"/"today" aplicada ao MESMO elemento — sem
 * isso, um dia de outro mês que corresponde à borda do intervalo escolhido
 * pinta como se fosse parte do intervalo, mesmo esmaecido.
 */
const CLASSES_CALENDARIO = {
  months: "relative flex select-none",
  // `pointer-events-none` aqui também: `month` (não só `month_caption`, seu
  // filho) é quem de fato ocupa a mesma faixa de `nav` no DOM — desligar só
  // no filho não bastava (confirmado com Playwright: o clique passou a ser
  // bloqueado por ESTE elemento em vez do de dentro). `month_grid` abaixo
  // religa com `pointer-events-auto`, senão os DIAS também parariam de
  // responder a clique (pointer-events: none propaga pra descendentes).
  month: "relative space-y-0.5 pointer-events-none",
  // `pointer-events-none`: `month_caption` ocupa a largura INTEIRA da tira
  // do cabeçalho (`px-9` é só padding — o elemento em si continua com o
  // box cheio), sobrepondo o `nav` (que é `absolute`, mesma faixa de
  // altura, botões nas pontas) sem nenhum dos dois declarar `z-index` — o
  // empate de camada é resolvido por ORDEM NO DOM, e `month_caption` vem
  // DEPOIS de `nav` dentro de `Month`, então pintava por cima e
  // interceptava o clique nas setas (mesmo sem ter fundo opaco — um `div`
  // comum já bloqueia ponteiro por cima de outro elemento, mesmo
  // "invisível"). Bug real, não só visual: reproduzido com Playwright (o
  // erro exato do clique automatizado apontava a `<div class="... px-9">`
  // como quem "intercepts pointer events"). `month_caption` nunca precisa
  // receber clique (só mostra o nome do mês) — desligar pointer-events
  // nele deixa os cliques passarem direto pro `nav` por baixo, nos dois
  // layouts (dois calendários e compacto — é o mesmo componente).
  month_caption: "relative flex h-9 items-center justify-center px-9 pointer-events-none",
  caption_label: "text-sm font-semibold text-kx-texto",
  nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between px-0.5",
  button_previous: cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "text-kx-legenda hover:text-kx-texto"
  ),
  button_next: cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "text-kx-legenda hover:text-kx-texto"
  ),
  month_grid: "pointer-events-auto border-collapse",
  weekdays: "flex",
  weekday: "flex h-7 w-9 items-center justify-center text-[11px] font-medium text-kx-legenda",
  week: "flex w-full",
  day: "w-9 p-0 text-center align-middle",
  day_button:
    "flex size-9 items-center justify-center rounded-full border-2 border-transparent bg-clip-padding text-xs font-medium text-kx-texto outline-none transition-colors hover:bg-kx-superficie focus-visible:ring-3 focus-visible:ring-ring/50",
  range_start:
    "rounded-l-full bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
  range_end:
    "rounded-r-full bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
  range_middle: "bg-primary/15",
  selected: "",
  today: "[&>button]:font-bold [&>button]:text-primary",
  outside:
    "!bg-transparent opacity-60 [&>button]:!bg-transparent [&>button]:!text-kx-placeholder [&>button]:hover:!bg-kx-superficie/60",
  disabled: "[&>button]:opacity-40 [&>button]:pointer-events-none",
  hidden: "invisible",
};

/**
 * Um calendário, com papel FIXO decidido por quem chama (`aoClicarDia`
 * sempre define ou o início, ou o fim — nunca os dois, nunca depende de
 * "qual clique é esse"). `numberOfMonths` fica sempre em 1: cada instância
 * é UM mês, e o componente pai (`PainelFiltroPeriodo`) decide quantas
 * instâncias renderizar (2 no desktop, 1 no layout compacto).
 *
 * `mode="range"` + `selected={faixa}` continuam aqui — não pra usar o
 * fluxo padrão de seleção da biblioteca (2 cliques, `resetOnSelect`
 * etc. — isso é o que este componente PRECISA EVITAR: cada calendário tem
 * um papel fixo, não uma sequência de cliques própria), mas porque é o
 * `mode` que faz a biblioteca computar os modificadores
 * `range_start`/`range_middle`/`range_end`/`selected` a partir de
 * `selected` (ver o código de `DayPicker.js`: esse bloco só roda quando
 * `isDateRange(selectedValue)`, e `selectedValue` só existe quando `mode`
 * está setado). Sem um `mode`, eu teria que recalcular esses modificadores
 * na mão via a prop `modifiers` — dá mais trabalho pra reproduzir algo que
 * a biblioteca já faz certo.
 *
 * O que É preciso evitar é o `onSelect` PADRÃO decidindo o próximo
 * intervalo: `useRange` (o hook interno da biblioteca pro `mode="range"`)
 * só usa `props.selected` pra computar os modificadores quando `onSelect`
 * está presente — API "controlada" de verdade (ver
 * `node_modules/react-day-picker/dist/esm/selection/useRange.js`: sem
 * `onSelect`, o `selected` que a biblioteca usa pra pintar a tela vem de
 * um estado INTERNO dela, que ignora o que a gente passa depois do
 * primeiro render). Por isso `onSelect` aqui é um no-op deliberado
 * (`aoSelecionarNativoNoOp`) — só pra manter a biblioteca no modo
 * controlado — e quem decide o próximo intervalo de verdade é
 * `onDayClick`, que dá o `Date` exato clicado, sem nenhuma lógica de
 * "qual clique é esse" embutida.
 */
function CalendarioIntervalo({
  mes,
  aoMudarMes,
  faixa,
  aoClicarDia,
  fusoHorario,
}: {
  mes: Date;
  aoMudarMes: (mes: Date) => void;
  faixa: DateRange;
  aoClicarDia: (dia: Date) => void;
  fusoHorario: string;
}) {
  return (
    <DayPicker
      mode="range"
      numberOfMonths={1}
      timeZone="UTC"
      locale={ptBR}
      weekStartsOn={0}
      showOutsideDays
      month={mes}
      onMonthChange={aoMudarMes}
      selected={faixa}
      onSelect={aoSelecionarNativoNoOp}
      onDayClick={(dia) => aoClicarDia(dia)}
      classNames={CLASSES_CALENDARIO}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
      // "Hoje" é calculado no fuso da LOJA (`fusoHorario`), não no fuso do
      // navegador de quem está olhando a tela — evita o mesmo bug de
      // fronteira que `lib/datas.ts` existe pra evitar no servidor.
      today={hojeComoDataDeCalendario(fusoHorario)}
    />
  );
}

function GradeMesAno({
  mesAno,
  mesSelecionado,
  aoMudarAno,
  aoEscolherMes,
}: {
  mesAno: MesDeCalendario;
  mesSelecionado: MesDeCalendario | null;
  aoMudarAno: (ano: number) => void;
  aoEscolherMes: (mesIndiceZero: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Ano anterior"
          onClick={() => aoMudarAno(mesAno.ano - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-kx-texto">{mesAno.ano}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Próximo ano"
          onClick={() => aoMudarAno(mesAno.ano + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {NOME_DOS_MESES.map((nomeMes, indice) => {
          const ativo =
            mesSelecionado?.ano === mesAno.ano && mesSelecionado?.mesIndiceZero === indice;
          return (
            <button
              key={nomeMes}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoEscolherMes(indice)}
              className={cn(
                "min-h-9 rounded-kx-botao px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "bg-kx-superficie text-kx-texto hover:bg-kx-superficie/70"
              )}
            >
              {nomeMes}
            </button>
          );
        })}
      </div>
    </div>
  );
}
