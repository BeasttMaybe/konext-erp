"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { buscarClientesOS, type ClienteBuscaOS } from "@/app/actions/os";
import { CadastroRapidoDoCliente } from "@/components/crm/cadastro-rapido-cliente";
import {
  PainelFotosDaEntrada,
  ProvedorFotosPendentes,
  useFotosPendentes,
} from "@/components/os/nova-os/fotos-da-entrada";
import { Button } from "@/components/ui/button";
import { CampoDinheiro } from "@/components/ui/campo-dinheiro";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { formatarReais } from "@/lib/dinheiro";
import { caminhoDaOS } from "@/lib/dominio/os/link-da-os";
import {
  MINIMO_DE_PONTOS_DO_DESENHO,
  montarDadosDaOSRapida,
  RASCUNHO_VAZIO,
  ROTULOS_TIPO_PECA,
  tocarPontoDoDesenho,
  totalDoPreOrcamento,
  validarOSRapida,
  type DadosDaOSRapida,
  type ErrosDaOSRapida,
  type ItemDoPreOrcamento,
  type RascunhoDaOSRapida,
} from "@/lib/dominio/os/os-rapida";
import { cn } from "@/lib/utils";
import type { TipoPecaOrcamento } from "@/types/os";

const CAMPO = "h-12 rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-base text-kx-texto placeholder:text-kx-placeholder";
const AREA = "rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 py-3 text-base text-kx-texto placeholder:text-kx-placeholder";

/**
 * Abertura de OS pelo celular: uma tela so, rolando de cima para baixo, na
 * ordem em que o balcao conversa com o cliente. No computador continua o
 * assistente de tres passos (`ModalNovaOS`), que tem espaco para tudo.
 */
export function NovaOSRapida({
  aberta,
  onAbrirMudar,
  onSalvar,
}: {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  /** Cria a OS e devolve o id. Erros ja viram aviso em quem chama. */
  onSalvar: (dados: DadosDaOSRapida) => Promise<string>;
}) {
  return (
    <Dialog open={aberta} onOpenChange={onAbrirMudar}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-kx-fundo p-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none"
      >
        {/* O formulario so existe aberto: fechar descarta o rascunho e as
            previas das fotos, e a proxima OS comeca limpa. */}
        {aberta ? <Formulario onFechar={() => onAbrirMudar(false)} onSalvar={onSalvar} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  onFechar,
  onSalvar,
}: {
  onFechar: () => void;
  onSalvar: (dados: DadosDaOSRapida) => Promise<string>;
}) {
  const router = useRouter();
  const fotos = useFotosPendentes();
  const [rascunho, setRascunho] = useState<RascunhoDaOSRapida>(RASCUNHO_VAZIO);
  const [erros, setErros] = useState<ErrosDaOSRapida>({});
  const [salvando, setSalvando] = useState(false);
  // O item que esta sendo digitado no pre-orcamento. Fica aqui, e nao dentro
  // do pre-orcamento, porque quem toca "Abrir OS" com um valor digitado e sem
  // tocar "Incluir" quer esse item na OS — perde-lo seria orcar a menos.
  const [itemEmEdicao, setItemEmEdicao] = useState<ItemDoPreOrcamento>(ITEM_EM_BRANCO);

  const mudar = <C extends keyof RascunhoDaOSRapida>(campo: C, valor: RascunhoDaOSRapida[C]) => {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
    // O erro de um campo some assim que ele e mexido; os outros ficam.
    setErros((atual) => {
      const chave = campo === "clienteId" ? "cliente" : campo;
      if (!(chave in atual)) return atual;
      const resto = { ...atual };
      delete resto[chave as keyof ErrosDaOSRapida];
      return resto;
    });
  };

  const salvar = async () => {
    const final =
      itemEmEdicao.valorCentavos > 0
        ? { ...rascunho, itens: [...rascunho.itens, { ...itemEmEdicao, descricao: itemEmEdicao.descricao.trim() }] }
        : rascunho;
    const encontrados = validarOSRapida(final);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      // Leva a pessoa ate o primeiro campo com problema: no celular ele
      // costuma estar fora da tela quando se toca no botao la embaixo.
      const primeiro = (["cliente", "aparelho", "defeito", "itens"] as const).find((c) => encontrados[c]);
      document.getElementById(`os-rapida-${primeiro}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSalvando(true);
    try {
      const id = await onSalvar(montarDadosDaOSRapida(final));
      const { enviadas, falhas } = await fotos.enviarPara(id);
      if (falhas > 0) {
        toast.error(
          falhas === 1
            ? "A OS foi criada, mas 1 foto não subiu. Adicione-a na tela da OS."
            : `A OS foi criada, mas ${falhas} fotos não subiram. Adicione-as na tela da OS.`
        );
      } else if (enviadas > 0) {
        toast.success(enviadas === 1 ? "1 foto anexada." : `${enviadas} fotos anexadas.`);
      }
      onFechar();
      // Abre a OS criada: dali se imprime a etiqueta com o QR e se segue.
      router.push(caminhoDaOS(id));
    } catch {
      // `onSalvar` ja mostrou o motivo; o rascunho fica para corrigir.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ProvedorFotosPendentes valor={fotos}>
      <header className="flex shrink-0 items-center gap-3 border-b border-kx-painel-borda bg-kx-painel px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-lg font-bold text-kx-texto">Nova OS</DialogTitle>
          <DialogDescription className="text-xs text-kx-legenda">
            Só cliente, aparelho e defeito são obrigatórios.
          </DialogDescription>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={onFechar} aria-label="Fechar">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          <Secao titulo="Cliente" obrigatorio id="os-rapida-cliente" erro={erros.cliente}>
            <EscolhaDoCliente onEscolher={(id) => mudar("clienteId", id)} />
          </Secao>

          <Secao titulo="Aparelho" obrigatorio id="os-rapida-aparelho" erro={erros.aparelho} rotuloPara="os-rapida-campo-aparelho">
            <Input
              id="os-rapida-campo-aparelho"
              className={CAMPO}
              placeholder="Ex.: iPhone 13 Pro, Galaxy A54"
              autoCapitalize="words"
              value={rascunho.aparelho}
              aria-invalid={Boolean(erros.aparelho)}
              onChange={(e) => mudar("aparelho", e.target.value)}
            />
          </Secao>

          <Secao titulo="Defeito" obrigatorio id="os-rapida-defeito" erro={erros.defeito} rotuloPara="os-rapida-campo-defeito">
            <Textarea
              id="os-rapida-campo-defeito"
              className={cn(AREA, "min-h-24")}
              placeholder="O que o cliente relatou"
              value={rascunho.defeito}
              aria-invalid={Boolean(erros.defeito)}
              onChange={(e) => mudar("defeito", e.target.value)}
            />
          </Secao>

          <Secao titulo="Observações" rotuloPara="os-rapida-campo-observacoes">
            <Textarea
              id="os-rapida-campo-observacoes"
              className={cn(AREA, "min-h-20")}
              placeholder="Riscos, acessórios que ficaram, combinados…"
              value={rascunho.observacoes}
              onChange={(e) => mudar("observacoes", e.target.value)}
            />
          </Secao>

          <Secao titulo="Senha do aparelho">
            <SenhaDoAparelho rascunho={rascunho} mudar={mudar} />
          </Secao>

          <PainelFotosDaEntrada />

          <Secao titulo="Pré-orçamento" id="os-rapida-itens" erro={erros.itens}>
            <PreOrcamento
              itens={rascunho.itens}
              onMudar={(itens) => mudar("itens", itens)}
              emEdicao={itemEmEdicao}
              onEditar={setItemEmEdicao}
            />
          </Secao>
        </div>
      </div>

      <footer className="shrink-0 border-t border-kx-painel-borda bg-kx-painel px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <Button
          type="button"
          className="mx-auto flex h-12 w-full max-w-xl text-base font-bold"
          disabled={salvando || fotos.preparando}
          onClick={() => void salvar()}
        >
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
          {salvando ? "Abrindo OS…" : "Abrir OS"}
        </Button>
      </footer>
    </ProvedorFotosPendentes>
  );
}

function Secao({
  titulo,
  obrigatorio = false,
  id,
  erro,
  rotuloPara,
  children,
}: {
  titulo: string;
  obrigatorio?: boolean;
  id?: string;
  erro?: string;
  rotuloPara?: string;
  children: React.ReactNode;
}) {
  const Rotulo = rotuloPara ? "label" : "span";
  return (
    <section id={id} className="flex flex-col gap-2">
      <Rotulo htmlFor={rotuloPara} className="text-sm font-bold text-kx-texto">
        {titulo}
        {obrigatorio ? (
          <span className="ml-1 text-kx-erro-texto" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-kx-legenda">opcional</span>
        )}
      </Rotulo>
      {children}
      {erro ? (
        <p role="alert" className="text-sm font-medium text-kx-erro-texto">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cliente                                                             */
/* ------------------------------------------------------------------ */

function EscolhaDoCliente({ onEscolher }: { onEscolher: (id: string | null) => void }) {
  const [termo, setTermo] = useState("");
  const [encontrados, setEncontrados] = useState<ClienteBuscaOS[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<ClienteBuscaOS | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const podeCadastrar = useTemPermissao("crm.editar");

  const termoLimpo = termo.trim();
  const buscaAtiva = !escolhido && !cadastrando && termoLimpo.length >= 2;

  useEffect(() => {
    if (!buscaAtiva) return;
    let ativo = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const lista = await buscarClientesOS(termoLimpo);
        if (ativo) setEncontrados(lista);
      } catch {
        if (ativo) setEncontrados([]);
      } finally {
        if (ativo) setBuscando(false);
      }
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [buscaAtiva, termoLimpo]);

  const escolher = (cliente: ClienteBuscaOS) => {
    setEscolhido(cliente);
    setCadastrando(false);
    onEscolher(cliente.id);
  };

  if (escolhido) {
    return (
      <div className="flex items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-kx-texto">{escolhido.nomeRazaoSocial}</p>
          {escolhido.telefone ? <p className="text-sm text-kx-legenda">{escolhido.telefone}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => {
            setEscolhido(null);
            onEscolher(null);
          }}
        >
          Trocar
        </Button>
      </div>
    );
  }

  if (cadastrando) {
    return (
      <CadastroRapidoDoCliente
        nomeInicial={termoLimpo}
        classeDoCampo={CAMPO}
        onCancelar={() => setCadastrando(false)}
        onCadastrado={(cliente) => escolher({ ...cliente, documento: cliente.documento ?? "" })}
      />
    );
  }

  const mostrarLista = termoLimpo.length >= 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" aria-hidden />
        <Input
          className={cn(CAMPO, "pl-10")}
          placeholder="Nome, telefone ou CPF"
          aria-label="Buscar cliente"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            if (e.target.value.trim().length < 2) setEncontrados([]);
          }}
        />
        {buscando ? (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-kx-legenda" aria-hidden />
        ) : null}
      </div>

      {mostrarLista && encontrados.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-painel" aria-label="Clientes encontrados">
          {encontrados.map((cliente) => (
            <li key={cliente.id} className="border-b border-kx-painel-borda last:border-b-0">
              <button
                type="button"
                className="flex min-h-12 w-full flex-col items-start px-3.5 py-2.5 text-left hover:bg-kx-superficie focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kx-foco"
                onClick={() => escolher(cliente)}
              >
                <span className="text-base font-medium text-kx-texto">{cliente.nomeRazaoSocial}</span>
                <span className="text-sm text-kx-legenda">
                  {[cliente.telefone, cliente.documento].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mostrarLista && !buscando && encontrados.length === 0 ? (
        <p className="text-sm text-kx-legenda">Nenhum cliente com “{termoLimpo}”.</p>
      ) : null}

      {podeCadastrar ? (
        <Button type="button" variant="outline" className="h-11 justify-start" onClick={() => setCadastrando(true)}>
          <UserPlus className="h-4 w-4" />
          {termoLimpo.length >= 2 && encontrados.length === 0 ? `Cadastrar “${termoLimpo}”` : "Cliente novo"}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Senha                                                               */
/* ------------------------------------------------------------------ */

function SenhaDoAparelho({
  rascunho,
  mudar,
}: {
  rascunho: RascunhoDaOSRapida;
  mudar: <C extends keyof RascunhoDaOSRapida>(campo: C, valor: RascunhoDaOSRapida[C]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tipo de senha" className="grid grid-cols-2 gap-1 rounded-kx-botao bg-kx-superficie p-1">
        {(
          [
            ["CARACTERES", "Números / letras"],
            ["DESENHO", "Padrão (desenho)"],
          ] as const
        ).map(([modo, rotulo]) => {
          const ativo = rascunho.modoDaSenha === modo;
          return (
            <button
              key={modo}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => mudar("modoDaSenha", modo)}
              className={cn(
                "h-10 rounded-kx-botao text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco",
                ativo ? "bg-kx-primaria text-primary-foreground shadow-sm" : "text-kx-texto-2"
              )}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {rascunho.modoDaSenha === "CARACTERES" ? (
        <Input
          className={CAMPO}
          placeholder="Senha de desbloqueio"
          aria-label="Senha de desbloqueio"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={rascunho.senha}
          onChange={(e) => mudar("senha", e.target.value)}
        />
      ) : (
        <GradeDoDesenho desenho={rascunho.desenho} onMudar={(desenho) => mudar("desenho", desenho)} />
      )}
    </div>
  );
}

/** Centro de cada ponto, numa grade de 0 a 300. */
const CENTRO = (ponto: number) => ({ x: 50 + ((ponto - 1) % 3) * 100, y: 50 + Math.floor((ponto - 1) / 3) * 100 });

/**
 * O desenho e feito tocando os pontos na ordem — nao arrastando. Arrastar
 * dentro de uma tela que rola faz a pagina rolar junto no iPhone, e o
 * desenho sai torto; tocar ponto a ponto e lento so na primeira vez.
 * Cada ponto mostra o numero da ordem, que e o que o tecnico precisa ler.
 */
function GradeDoDesenho({ desenho, onMudar }: { desenho: number[]; onMudar: (desenho: number[]) => void }) {
  const curto = desenho.length > 0 && desenho.length < MINIMO_DE_PONTOS_DO_DESENHO;
  return (
    <div className="flex flex-col items-center gap-2 rounded-kx-cartao bg-kx-superficie p-4">
      <div className="relative aspect-square w-full max-w-64">
        <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <polyline
            points={desenho.map((p) => `${CENTRO(p).x},${CENTRO(p).y}`).join(" ")}
            fill="none"
            className="stroke-kx-destaque"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="relative grid h-full w-full grid-cols-3 grid-rows-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((ponto) => {
            const ordem = desenho.indexOf(ponto);
            const tocado = ordem >= 0;
            return (
              <button
                key={ponto}
                type="button"
                aria-label={tocado ? `Ponto ${ponto}, ${ordem + 1}º do desenho` : `Ponto ${ponto}`}
                aria-pressed={tocado}
                onClick={() => onMudar(tocarPontoDoDesenho(desenho, ponto))}
                className="flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 text-base font-bold transition-colors",
                    tocado
                      ? "border-kx-destaque bg-kx-primaria text-primary-foreground"
                      : "border-kx-campo-borda bg-kx-painel text-transparent"
                  )}
                >
                  {tocado ? ordem + 1 : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <span className={cn("text-sm", curto ? "font-medium text-kx-alerta-texto" : "text-kx-legenda")}>
          {desenho.length === 0
            ? "Toque os pontos na ordem do desenho"
            : curto
              ? `Mínimo de ${MINIMO_DE_PONTOS_DO_DESENHO} pontos`
              : desenho.join(" → ")}
        </span>
        <Button type="button" variant="ghost" className="h-10" disabled={desenho.length === 0} onClick={() => onMudar([])}>
          Limpar
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pré-orçamento                                                       */
/* ------------------------------------------------------------------ */

const ITEM_EM_BRANCO: ItemDoPreOrcamento = { tipo: "TELA", descricao: "", valorCentavos: 0 };

const TIPOS: TipoPecaOrcamento[] = ["TELA", "BATERIA", "CONECTOR_CARGA", "TAMPA_IPHONE", "TAMPA_ANDROID", "OUTROS"];

function PreOrcamento({
  itens,
  onMudar,
  emEdicao,
  onEditar,
}: {
  itens: RascunhoDaOSRapida["itens"];
  onMudar: (itens: RascunhoDaOSRapida["itens"]) => void;
  emEdicao: ItemDoPreOrcamento;
  onEditar: (item: ItemDoPreOrcamento) => void;
}) {
  const { tipo, descricao, valorCentavos: valor } = emEdicao;
  const setTipo = (novo: TipoPecaOrcamento) => onEditar({ ...emEdicao, tipo: novo });
  const setDescricao = (nova: string) => onEditar({ ...emEdicao, descricao: nova });
  const setValor = (centavos: number) => onEditar({ ...emEdicao, valorCentavos: centavos });

  const adicionar = () => {
    if (valor <= 0) return;
    onMudar([...itens, { tipo, descricao: descricao.trim(), valorCentavos: valor }]);
    onEditar({ ...ITEM_EM_BRANCO, tipo });
  };

  return (
    <div className="flex flex-col gap-3">
      {itens.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-painel">
          {itens.map((item, indice) => (
            <li key={indice} className="flex items-center gap-3 border-b border-kx-painel-borda px-3.5 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-kx-texto">{item.descricao || ROTULOS_TIPO_PECA[item.tipo]}</p>
                {item.descricao ? <p className="text-xs text-kx-legenda">{ROTULOS_TIPO_PECA[item.tipo]}</p> : null}
              </div>
              <span className="text-base font-semibold tabular-nums text-kx-texto">{formatarReais(item.valorCentavos)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                aria-label={`Remover ${item.descricao || ROTULOS_TIPO_PECA[item.tipo]}`}
                onClick={() => onMudar(itens.filter((_, i) => i !== indice))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          <li className="flex items-center justify-between bg-kx-superficie px-3.5 py-2.5">
            <span className="text-sm font-semibold text-kx-texto-2">Total previsto</span>
            <span className="text-base font-bold tabular-nums text-kx-texto">{formatarReais(totalDoPreOrcamento(itens))}</span>
          </li>
        </ul>
      ) : null}

      <div className="flex flex-col gap-2.5 rounded-kx-cartao bg-kx-superficie p-3.5">
        <div role="radiogroup" aria-label="Tipo do item" className="flex flex-wrap gap-1.5">
          {TIPOS.map((opcao) => {
            const ativo = tipo === opcao;
            return (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setTipo(opcao)}
                className={cn(
                  "h-9 rounded-kx-pilula border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco",
                  ativo
                    ? "border-transparent bg-kx-primaria text-primary-foreground"
                    : "border-kx-painel-borda bg-kx-painel text-kx-texto-2"
                )}
              >
                {ROTULOS_TIPO_PECA[opcao]}
              </button>
            );
          })}
        </div>
        <Input
          className={CAMPO}
          placeholder={`Descrição (opcional) — ex.: ${ROTULOS_TIPO_PECA[tipo]} original`}
          aria-label="Descrição do item"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className="flex gap-2">
          <CampoDinheiro
            valorCentavos={valor}
            onChange={setValor}
            aria-label="Valor do item"
            className={cn(CAMPO, "flex-1")}
          />
          {/* Sem `disabled` de proposito: o valor so e confirmado quando o campo
              perde o foco, e esse foco sai justamente no toque neste botao. Um
              botao desabilitado ate ali engoliria o primeiro toque. */}
          <Button type="button" variant="outline" className="h-12 px-4" onClick={adicionar}>
            <Plus className="h-4 w-4" />
            Incluir
          </Button>
        </div>
      </div>
    </div>
  );
}
