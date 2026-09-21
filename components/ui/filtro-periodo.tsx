"use client";

/**
 * Filtro de período compartilhado (Fase 2A-1, componente `componente-filtro-periodo`).
 *
 * Combina um seletor de campo de data opcional (ex.: "Vencimento" ×
 * "Pagamento" × "Emissão" — vem de quem usa o componente, nunca hardcoded
 * aqui), dois calendários de intervalo (`react-day-picker`) e uma coluna de
 * presets ("Hoje", "Esta semana", "Mês passado"...). Nada é aplicado até o
 * usuário clicar "Filtrar" — até lá, tudo é um RASCUNHO local; só o clique
 * em "Filtrar" atualiza a URL (e dispara `aoFiltrar`, se passado).
 *
 * Toda fronteira de dia/semana/mês (os presets) vem de `lib/filtro-periodo.ts`,
 * que por sua vez só usa `lib/datas.ts` — nunca `new Date()`/`setHours`/
 * `startOfDay` crus aqui (a regra de lint `konext-datas/*` baniria de
 * qualquer forma, mas o objetivo é nem tentar).
 *
 * Convenção de fuso pros CALENDÁRIOS do `react-day-picker`: `timeZone="UTC"`
 * em toda instância. As datas deste componente são DATA DE CALENDÁRIO
 * (meia-noite UTC — mesma convenção de `lib/datas.ts`/`lib/filtro-periodo.ts`).
 * Sem `timeZone="UTC"`, o `react-day-picker` decide em qual célula do grid
 * cada `Date` cai usando o fuso LOCAL DO NAVEGADOR — num navegador em
 * `America/Sao_Paulo` (UTC−3), meia-noite UTC de um dia é 21h do dia
 * ANTERIOR nesse fuso, e o dia certo apareceria destacado errado. Fixar em
 * "UTC" faz o grid interpretar nossas datas exatamente como eram.
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
  mesDeCalendarioSeguinte,
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

function inscreverEmMudancaDeTela(notificar: () => void) {
  const consulta = window.matchMedia(CONSULTA_TELA_MOBILE);
  consulta.addEventListener("change", notificar);
  return () => consulta.removeEventListener("change", notificar);
}

function obterSeTelaEhMobile() {
  return window.matchMedia(CONSULTA_TELA_MOBILE).matches;
}

function obterSeTelaEhMobileNoServidor() {
  return false;
}

/**
 * `useSyncExternalStore` em vez de `useEffect` + `useState`: evita o
 * "cascading render" de chamar `setState` de dentro de um efeito só pra
 * ler o valor inicial (a regra `react-hooks/set-state-in-effect` bane
 * exatamente esse padrão) — e já é SSR-safe por construção (o snapshot do
 * servidor devolve `false`, nunca lê `window` fora do cliente).
 */
function useEhTelaMobile(): boolean {
  return React.useSyncExternalStore(
    inscreverEmMudancaDeTela,
    obterSeTelaEhMobile,
    obterSeTelaEhMobileNoServidor
  );
}

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
  aoFiltrar,
  className,
}: FiltroPeriodoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ehMobile = useEhTelaMobile();

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

  const rotuloCampoAtual =
    campos && campos.length > 0
      ? campos.find((opcao) => opcao.valor === campoComprometido)?.rotulo
      : rotulo;

  const rotuloBotao = formatarRotuloIntervalo(intervaloComprometido, rotuloCampoAtual);

  function aoConfirmar(resultado: { campo: string | undefined; intervalo: IntervaloPeriodo }) {
    const params = paraSearchParams(resultado.intervalo, resultado.campo, searchParams, nomesParams);
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
      <PopoverContent align="start" className="w-auto p-0">
        {aberto && (
          <PainelFiltroPeriodo
            campos={campos}
            campoInicial={campoComprometido}
            intervaloInicial={intervaloComprometido}
            fusoHorario={fusoHorario}
            variante="popover"
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

  const [mesEsquerda, setMesEsquerda] = React.useState(() => inicioDoMesDeCalendario(intervaloInicial.inicio));
  const [mesDireita, setMesDireita] = React.useState(() => {
    const mesDoFim = inicioDoMesDeCalendario(intervaloInicial.fim);
    const mesDoInicio = inicioDoMesDeCalendario(intervaloInicial.inicio);
    return mesDoFim.getTime() === mesDoInicio.getTime()
      ? mesDeCalendarioParaData(mesDeCalendarioSeguinte(dataParaMesDeCalendario(mesDoInicio)))
      : mesDoFim;
  });

  const rangeParaCalendario: DateRange = { from: intervaloRascunho.inicio, to: intervaloRascunho.fim };

  function aplicarNovoIntervalo(novo: IntervaloPeriodo) {
    const resultado = validarIntervalo(novo.inicio, novo.fim);
    if (!resultado.valido) {
      setErro(resultado.mensagemErro);
      return;
    }
    setErro(undefined);
    setIntervaloRascunho(novo);
    setTextoInicio(formatarDataExibicao(novo.inicio));
    setTextoFim(formatarDataExibicao(novo.fim));
    setMesEsquerda(inicioDoMesDeCalendario(novo.inicio));
    setMesDireita(inicioDoMesDeCalendario(novo.fim));
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
    if (!faixa?.from) return;
    const inicio = faixa.from;
    const fim = faixa.to ?? faixa.from;
    aplicarNovoIntervalo({ inicio, fim });
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
    setIntervaloRascunho({ inicio: novaData, fim: intervaloRascunho.fim });
    setMesEsquerda(inicioDoMesDeCalendario(novaData));
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
    setIntervaloRascunho({ inicio: intervaloRascunho.inicio, fim: novaData });
    setMesDireita(inicioDoMesDeCalendario(novaData));
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
  const numeroDeCalendarios = variante === "folha" ? 1 : 2;

  return (
    <div className="flex w-full flex-col sm:w-[640px]">
      <div className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:gap-0 sm:p-0">
      <div className="flex flex-1 flex-col gap-3 sm:p-4">
        {mostrarSeletorDeCampo && (
          <SeletorDeCampo campos={campos!} valor={campoRascunho} aoSelecionar={setCampoRascunho} />
        )}

        <div className="grid grid-cols-2 gap-3">
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
              className="h-11 min-h-11"
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
              className="h-11 min-h-11"
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
          <div className={cn("flex flex-col gap-4", numeroDeCalendarios === 2 && "sm:flex-row sm:gap-2")}>
            <CalendarioIntervalo
              mes={mesEsquerda}
              aoMudarMes={setMesEsquerda}
              faixa={rangeParaCalendario}
              aoSelecionar={aoSelecionarNoCalendario}
              fusoHorario={fusoHorario}
            />
            {numeroDeCalendarios === 2 && (
              <CalendarioIntervalo
                mes={mesDireita}
                aoMudarMes={setMesDireita}
                faixa={rangeParaCalendario}
                aoSelecionar={aoSelecionarNoCalendario}
                fusoHorario={fusoHorario}
              />
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 gap-1.5 border-kx-painel-borda sm:w-44 sm:flex-col sm:border-l sm:p-4",
          variante === "folha" && "flex-wrap sm:hidden"
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

      <div className="flex w-full items-center justify-end gap-2 border-t border-kx-painel-borda p-3">
        <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="button" variant="default" className="h-11 min-h-11" onClick={aoClicarFiltrar}>
          Filtrar
        </Button>
      </div>
    </div>
  );
}

function dataParaMesDeCalendario(data: Date): MesDeCalendario {
  return { ano: data.getUTCFullYear(), mesIndiceZero: data.getUTCMonth() };
}

function mesDeCalendarioParaData(mes: MesDeCalendario): Date {
  return new Date(Date.UTC(mes.ano, mes.mesIndiceZero, 1));
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
        <Button type="button" variant="outline" className="h-11 min-h-11 w-fit gap-1.5 self-start">
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
        "min-h-11 shrink-0 rounded-kx-botao px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        ativo
          ? "bg-primary/15 text-primary"
          : "text-kx-legenda hover:bg-kx-superficie hover:text-kx-texto"
      )}
    >
      {children}
    </button>
  );
}

const CLASSES_CALENDARIO = {
  months: "flex",
  month: "space-y-2",
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
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "size-11 text-center text-xs font-medium text-kx-legenda",
  week: "mt-1 flex w-full",
  day: "p-0 text-center align-middle",
  day_button:
    "flex size-11 items-center justify-center rounded-kx-botao text-sm font-medium text-kx-texto outline-none transition-colors hover:bg-kx-superficie focus-visible:ring-3 focus-visible:ring-ring/50",
  range_start: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
  range_end: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
  range_middle: "[&>button]:rounded-none [&>button]:bg-primary/15 [&>button]:text-kx-texto",
  selected: "[&>button]:bg-primary [&>button]:text-primary-foreground",
  today: "[&>button]:font-bold [&>button]:text-primary",
  outside: "[&>button]:text-kx-placeholder [&>button]:opacity-60",
  disabled: "[&>button]:opacity-40 [&>button]:pointer-events-none",
  hidden: "invisible",
};

function CalendarioIntervalo({
  mes,
  aoMudarMes,
  faixa,
  aoSelecionar,
  fusoHorario,
}: {
  mes: Date;
  aoMudarMes: (mes: Date) => void;
  faixa: DateRange;
  aoSelecionar: (faixa: DateRange | undefined) => void;
  fusoHorario: string;
}) {
  return (
    <DayPicker
      mode="range"
      timeZone="UTC"
      locale={ptBR}
      weekStartsOn={0}
      showOutsideDays
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
    <div className="space-y-3">
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
      <div className="grid grid-cols-3 gap-2">
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
                "min-h-11 rounded-kx-botao px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
