"use client";

/**
 * Filtro de período compartilhado (Fase 2A-1, componente `componente-filtro-periodo`).
 *
 * Combina um seletor de campo de data opcional (ex.: "Vencimento" ×
 * "Pagamento" × "Emissão" — vem de quem usa o componente, nunca hardcoded
 * aqui), UM calendário de intervalo (`react-day-picker`, `mode="range"`,
 * `numberOfMonths={2}` no desktop — nunca dois `DayPicker` independentes:
 * ver o comentário grande perto de `CLASSES_CALENDARIO` pra história desse
 * bug) e uma coluna de presets ("Hoje", "Esta semana", "Mês passado"...).
 * Nada é aplicado até o usuário clicar "Filtrar" — até lá, tudo é um
 * RASCUNHO local; só o clique em "Filtrar" atualiza a URL (e dispara
 * `aoFiltrar`, se passado).
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
// Sem espaço pra DOIS meses lado a lado (spec do dono do projeto, depois de
// testar ao vivo): largura < ~900px OU altura < ~560px — nesses casos o
// Popover (ainda um Popover, não a bottom sheet do `useEhTelaMobile` — essa
// troca só acontece abaixo de 768px de LARGURA) mostra um único mês.
const CONSULTA_ESPACO_COMPACTO = "(max-width: 899px), (max-height: 559px)";

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
const useEhEspacoCompacto = criarHookDeMediaQuery(CONSULTA_ESPACO_COMPACTO);

function inicioDoMesDeCalendario(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
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
  const ehCompacto = useEhEspacoCompacto();
  const conteudoRef = React.useRef<HTMLDivElement>(null);

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
  // a área de calendário/presets ficando rolável em telas curtas).
  React.useEffect(() => {
    if (!aberto) return;

    function aoRolarFora(evento: Event) {
      const alvo = evento.target;
      if (conteudoRef.current && alvo instanceof Node && conteudoRef.current.contains(alvo)) {
        return;
      }
      setAberto(false);
    }

    // `capture: true`: eventos de scroll não borbulham no DOM — só assim um
    // listener num ancestral comum (aqui, `document`) pega o scroll de UM
    // container rolável específico lá dentro (ex.: o `<main>` do shell do
    // app), não só o scroll da window.
    document.addEventListener("scroll", aoRolarFora, true);
    return () => document.removeEventListener("scroll", aoRolarFora, true);
  }, [aberto]);

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
    <Popover open={aberto} onOpenChange={setAberto}>
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
            compacto={ehCompacto}
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
  /** Sem espaço pra dois meses lado a lado (viewport curta/estreita) — mostra um único mês, mesmo na variante "popover". */
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

  // UM único DayPicker (`numberOfMonths`) precisa de UM único estado de mês
  // (o primeiro mês mostrado — os seguintes são consecutivos POR
  // CONSTRUÇÃO da própria biblioteca) e de UMA única faixa controlada.
  //
  // A faixa controlada (`faixaCalendario`) é DISTINTA de `intervaloRascunho`
  // de propósito: ela espelha exatamente o que o `react-day-picker` devolve
  // — inclusive o estado INCOMPLETO `{ from, to: undefined }` entre o
  // primeiro e o segundo clique. Colapsar isso cedo demais num intervalo
  // "completo" (fim = início) — o que este componente fazia antes — engana
  // a lógica nativa de seleção da biblioteca (`resetOnSelect`, abaixo): ela
  // decide "começar um intervalo novo" olhando se JÁ existe uma faixa
  // completa, e se a faixa controlada que devolvemos pra ela já está
  // sempre completa, todo clique pareceria o "terceiro clique".
  const [faixaCalendario, setFaixaCalendario] = React.useState<DateRange>({
    from: intervaloInicial.inicio,
    to: intervaloInicial.fim,
  });
  const [mesBase, setMesBase] = React.useState(() => inicioDoMesDeCalendario(intervaloInicial.inicio));

  function aplicarNovoIntervalo(novo: IntervaloPeriodo, opcoes: { moverCalendario?: boolean } = {}) {
    const resultado = validarIntervalo(novo.inicio, novo.fim);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    setErro(undefined);
    setIntervaloRascunho(novo);
    setFaixaCalendario({ from: novo.inicio, to: novo.fim });
    setTextoInicio(formatarDataExibicao(novo.inicio));
    setTextoFim(formatarDataExibicao(novo.fim));
    if (opcoes.moverCalendario !== false) {
      setMesBase(inicioDoMesDeCalendario(novo.inicio));
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

  function aoVoltarParaPeriodoCustomizado() {
    setMostrarGradeMes(false);
  }

  function aoSelecionarNoCalendario(faixa: DateRange | undefined) {
    // `undefined` acontece ao clicar de novo no único dia de uma seleção de
    // um dia só (a biblioteca "desmarca" quando `required` não está
    // setado) — mantém a última faixa válida em vez de ficar sem nada.
    if (!faixa?.from) return;

    setFaixaCalendario(faixa);
    setMostrarGradeMes(false);

    if (!faixa.to) {
      // Primeiro clique de uma seleção nova — só o início foi escolhido
      // ainda. Não mexe em intervaloRascunho/textos/erro/mês exibido: o
      // usuário ainda está no meio do gesto de selecionar o intervalo, e
      // navegar o calendário sozinho aqui atrapalharia o segundo clique.
      return;
    }

    // Segundo clique (completou o intervalo) ou clique que reinicia um
    // intervalo já completo com um único dia (from === to): os dois casos
    // já chegam prontos em `faixa` — a lógica de "antes do início vira o
    // novo início"/"terceiro clique começa de novo" é da própria
    // biblioteca (`resetOnSelect`, na instância do calendário abaixo), não
    // reimplementada aqui.
    aplicarNovoIntervalo({ inicio: faixa.from, fim: faixa.to }, { moverCalendario: false });
  }

  function aoDigitarInicio(valorDigitado: string) {
    const mascarado = aplicarMascaraDataDigitada(valorDigitado);
    setTextoInicio(mascarado);
    const novaData = interpretarDataDigitada(mascarado);
    if (!novaData) return; // incompleto/inválido — mantém o intervalo válido anterior
    const resultado = validarIntervalo(novaData, intervaloRascunho.fim);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    setErro(undefined);
    const novo = { inicio: novaData, fim: intervaloRascunho.fim };
    setIntervaloRascunho(novo);
    setFaixaCalendario({ from: novo.inicio, to: novo.fim });
    setMesBase(inicioDoMesDeCalendario(novaData));
  }

  function aoDigitarFim(valorDigitado: string) {
    const mascarado = aplicarMascaraDataDigitada(valorDigitado);
    setTextoFim(mascarado);
    const novaData = interpretarDataDigitada(mascarado);
    if (!novaData) return;
    const resultado = validarIntervalo(intervaloRascunho.inicio, novaData);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    setErro(undefined);
    const novo = { inicio: intervaloRascunho.inicio, fim: novaData };
    setIntervaloRascunho(novo);
    setFaixaCalendario({ from: novo.inicio, to: novo.fim });
    // Mostra o mês do FIM no último mês visível do calendário (no layout de
    // dois meses, o segundo; no compacto, o único).
    const numeroDeCalendariosAtual = variante === "folha" || compacto ? 1 : 2;
    const mesDoFim = inicioDoMesDeCalendario(novaData);
    if (numeroDeCalendariosAtual === 2) {
      setMesBase(new Date(Date.UTC(mesDoFim.getUTCFullYear(), mesDoFim.getUTCMonth() - 1, 1)));
    } else {
      setMesBase(mesDoFim);
    }
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
    identificarPresetAtivo(intervaloRascunho, fusoHorario) ??
    (identificarMesEspecifico(intervaloRascunho) ? "mes-especifico" : "personalizado");

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
  const largura = variante === "folha" ? "w-full" : ladoALado ? "w-[680px]" : "w-[340px]";

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
        (calendário + inputs + presets) não cabe no espaço disponível — sem
        min-h-0 o flex item nunca encolhe abaixo do tamanho do seu próprio
        conteúdo, e o overflow-y-auto abaixo nunca teria efeito. O rodapé
        (Cancelar/Filtrar), fora desta div, nunca faz parte da rolagem —
        sempre visível, sem exigir rolar até o fim pra achá-lo.
      */}
      <div className={cn("flex w-full min-h-0 flex-1 overflow-y-auto", ladoALado ? "flex-row" : "flex-col")}>
        <div className="flex flex-1 flex-col gap-2 p-3">
          {mostrarSeletorDeCampo && (
            <SeletorDeCampo campos={campos!} valor={campoRascunho} aoSelecionar={setCampoRascunho} />
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="filtro-periodo-inicio" className="text-xs text-kx-legenda">
                Início do período
              </Label>
              <Input
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
          ) : (
            <CalendarioIntervalo
              numeroDeMeses={numeroDeCalendarios}
              mes={mesBase}
              aoMudarMes={setMesBase}
              faixa={faixaCalendario}
              aoSelecionar={aoSelecionarNoCalendario}
              fusoHorario={fusoHorario}
            />
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 gap-1.5 bg-popover p-3",
            ladoALado
              ? "w-44 flex-col border-l border-kx-painel-borda"
              : "w-full flex-wrap border-t border-kx-painel-borda"
          )}
        >
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
        </div>
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
 * (chegou durante esta fase — antes disso, "mais compacto" era um pedido às
 * cegas, comparado contra o estado COM O BUG dos dois `DayPicker`
 * duplicando "agosto" lado a lado, que inflava o painel bem além do
 * normal; a referência real mede célula de dia ~38×38px, não algo minúsculo
 * estilo app mobile). Célula de dia 36×36px (`size-9`, o mais próximo do
 * grid de 4px que chega perto dos ~38px medidos), círculo VISÍVEL de 32px
 * dentro dela (`border-2 border-transparent bg-clip-padding` — a mesma
 * técnica de `buttonVariants` em `components/ui/button.tsx` — encolhe só a
 * área PINTADA, o alvo de clique/toque continua os 36px inteiros da
 * célula), linha de dias da semana com 28px de altura (`h-7`) e cabeçalho
 * do mês com 36px (`h-9`).
 *
 * `months`/`month` precisam de `relative`: o `Nav` (setas de mês) do
 * react-day-picker é filho de `Months` (não de `Month`/`MonthCaption` — ver
 * `node_modules/react-day-picker/dist/esm/DayPicker.js`, o Nav só entra
 * dentro do `MonthCaption` quando `navLayout` está setado, o que não é o
 * caso aqui) — sem um ancestral posicionado aí, o `absolute` do Nav escapa
 * pro container posicionado mais próximo na árvore (podia ser a página
 * inteira dentro de um Portal), e as setas "flutuam" longe do calendário.
 * Com `numberOfMonths={2}` num ÚNICO `DayPicker` (ver comentário grande em
 * `CalendarioIntervalo`), o Nav aparece uma vez só, olhando pro par de
 * meses inteiro — não uma seta por mês.
 *
 * `select-none` no `months` (herda pros filhos — dias, cabeçalho, tudo):
 * sem isso, um clique duplo no título do mês ("setembro 2026") seleciona o
 * texto como se fosse um parágrafo comum, feio e sem função nenhuma aqui.
 *
 * Estilo do intervalo — só início e fim são círculo cheio, o meio é uma
 * faixa clara contínua (Fase 2A-1, correção pós-bug dos dois `DayPicker`):
 * a biblioteca aplica o modificador genérico "selected" a TODO dia dentro
 * do intervalo (não só as pontas — confirmado lendo
 * `node_modules/react-day-picker/dist/esm/DayPicker.js`, a linha que faz
 * `modifiers[SelectionState.selected] = isSelected?.(date) || ...` roda
 * pra cada dia que `rangeIncludesDate` inclui), ALÉM de "range_start"/
 * "range_middle"/"range_end". Pintar o botão a partir de "selected" (como
 * este componente fazia antes) deixava TODO dia do intervalo com o mesmo
 * círculo cheio das pontas — daí "selected" abaixo não pinta nada: só
 * "range_start"/"range_end" (círculo cheio + canto arredondado do lado de
 * fora) e "range_middle" (faixa clara na CÉLULA, sem círculo no botão)
 * carregam cor. Um intervalo de um dia só marca o MESMO dia como
 * "range_start" E "range_end" ao mesmo tempo (a biblioteca faz isso quando
 * `from`/`to` caem no mesmo dia) — as duas bordas arredondadas juntas viram
 * um círculo só, sem precisar de caso especial aqui.
 *
 * "outside" (dias de outro mês) usa `!` (important) pra sempre vencer
 * qualquer classe de "range_*"/"today" aplicada ao MESMO elemento — sem
 * isso, um dia de outro mês que corresponde à borda do intervalo escolhido
 * pinta como se fosse parte do intervalo, mesmo esmaecido. Com um ÚNICO
 * `DayPicker` de dois meses, dias "outside" só aparecem preenchendo a
 * primeira/última semana do PRIMEIRO/ÚLTIMO mês mostrado (nunca entre os
 * dois meses do meio — cada um dos dois já é mostrado por inteiro) — mas a
 * regra abaixo continua valendo pra esses dois casos.
 */
const CLASSES_CALENDARIO = {
  months: "relative flex select-none gap-2",
  month: "relative space-y-0.5",
  month_caption: "relative flex h-9 items-center justify-center px-9",
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
  month_grid: "border-collapse",
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
 * UM `DayPicker` só, `mode="range"`, `numberOfMonths` (2 no desktop, 1 no
 * layout compacto/mobile) — NUNCA duas instâncias independentes.
 *
 * Bug histórico (Fase 2A-1, corrigido): a versão anterior deste componente
 * renderizava DOIS `<DayPicker numberOfMonths={1}>`, um "mês de início" e
 * um "mês de fim", cada um com seu PRÓPRIO estado de mês exibido — a
 * intenção era imitar visualmente dois calendários lado a lado, mas isso
 * quebrava a biblioteca de verdade: os dois mês podiam mostrar o MESMO mês
 * (nada os mantinha consecutivos por construção), e mais grave, cada
 * instância tinha seu PRÓPRIO estado de seleção internamente controlado a
 * partir da MESMA faixa — clicar num dia na instância da direita reiniciava
 * a seleção em vez de completá-la, porque cada `DayPicker` reage à sua
 * PRÓPRIA sequência de cliques, não a uma sequência compartilhada entre os
 * dois. `numberOfMonths={2}` num único `DayPicker` resolve os dois
 * problemas de graça: os meses são consecutivos por construção (mostra
 * `mes` e `mes+1`) e existe um único fluxo de seleção (primeiro clique =
 * início, segundo = fim, terceiro = reinicia — nativo do `mode="range"`
 * com `resetOnSelect`, não reimplementado na mão).
 */
function CalendarioIntervalo({
  numeroDeMeses,
  mes,
  aoMudarMes,
  faixa,
  aoSelecionar,
  fusoHorario,
}: {
  numeroDeMeses: number;
  mes: Date;
  aoMudarMes: (mes: Date) => void;
  faixa: DateRange;
  aoSelecionar: (faixa: DateRange | undefined) => void;
  fusoHorario: string;
}) {
  return (
    <DayPicker
      mode="range"
      numberOfMonths={numeroDeMeses}
      timeZone="UTC"
      locale={ptBR}
      weekStartsOn={0}
      showOutsideDays
      // Terceiro clique (depois de já ter início E fim) começa um
      // intervalo novo em vez de mover a ponta mais próxima — pedido
      // explícito do dono do projeto, e o que `resetOnSelect` faz nativo.
      resetOnSelect
      month={mes}
      onMonthChange={aoMudarMes}
      selected={faixa}
      onSelect={aoSelecionar}
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
