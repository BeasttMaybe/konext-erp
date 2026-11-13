"use client";

import { useMemo, useState } from "react";
import { DollarSign, EyeOff, FolderInput, Loader2, Printer, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import {
  alterarCategoriaEmMassa,
  alterarEstoqueMinimoEmMassa,
  alterarPrecosEmMassa,
  desativarProdutosEmMassa,
  type ResultadoEmMassa,
} from "@/app/actions/estoque-em-massa";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deDecimal } from "@/lib/dinheiro";
import { TAMANHOS_DE_ETIQUETA, TAMANHO_DE_ETIQUETA_PADRAO } from "@/lib/dominio/estoque/etiqueta";
import {
  calcularNovoPreco,
  lerRegraDePreco,
  MAXIMO_DE_PRODUTOS_NA_ETIQUETA,
  type ModoDeCopias,
} from "@/lib/dominio/estoque/operacoes-em-massa";

export type ProdutoSelecionado = {
  id: string;
  nome: string;
  precoVenda: number;
  /** null quando quem esta logado nao ve custo */
  custo: number | null;
  quantidadeEstoque: number;
};

type Props = {
  selecionados: ProdutoSelecionado[];
  categorias: Array<{ id: string; nome: string }>;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeVerCustos: boolean;
  onLimpar: () => void;
  /** Depois de uma alteracao: recarrega a lista (a selecao e mantida). */
  onAlterado: () => void;
};

type Acao = "ETIQUETAS" | "PRECO" | "CATEGORIA" | "MINIMO" | "DESATIVAR";

const SELECT =
  "h-11 w-full rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-sm text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco";
const CAMPO = "h-11 border-kx-campo-borda bg-kx-superficie text-kx-texto";

const formatarMoeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Barra que aparece quando ha produtos marcados na lista do estoque, com as
 * operacoes em massa (app/actions/estoque-em-massa.ts).
 */
export function AcoesEmMassa({ selecionados, categorias, podeEditar, podeExcluir, podeVerCustos, onLimpar, onAlterado }: Props) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const quantidade = selecionados.length;
  if (quantidade === 0) return null;

  const fechar = () => setAcao(null);
  const concluir = (resultado: ResultadoEmMassa) => {
    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return false;
    }
    toast.success(resultado.mensagem);
    setAcao(null);
    onAlterado();
    return true;
  };

  return (
    <>
      <div
        role="region"
        aria-label="Ações nos produtos selecionados"
        className="sticky bottom-3 z-kx-sticky flex flex-wrap items-center gap-2 rounded-kx-cartao border border-kx-primaria/40 bg-kx-painel p-2.5 shadow-lg"
      >
        <span className="px-1 text-sm font-bold text-kx-texto">
          {quantidade === 1 ? "1 selecionado" : `${quantidade} selecionados`}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onLimpar}>
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
        <span className="hidden flex-1 sm:block" />
        <Button type="button" variant="outline" size="sm" onClick={() => setAcao("ETIQUETAS")}>
          <Printer className="h-3.5 w-3.5" />
          Etiquetas
        </Button>
        {podeEditar ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setAcao("PRECO")}>
              <DollarSign className="h-3.5 w-3.5" />
              Preço
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAcao("CATEGORIA")}>
              <FolderInput className="h-3.5 w-3.5" />
              Categoria
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAcao("MINIMO")}>
              <ShieldAlert className="h-3.5 w-3.5" />
              Estoque mínimo
            </Button>
          </>
        ) : null}
        {podeExcluir ? (
          <Button type="button" variant="outline" size="sm" className="text-kx-erro-texto" onClick={() => setAcao("DESATIVAR")}>
            <EyeOff className="h-3.5 w-3.5" />
            Desativar
          </Button>
        ) : null}
      </div>

      {acao === "ETIQUETAS" && <DialogoEtiquetas selecionados={selecionados} onFechar={fechar} />}
      {acao === "PRECO" && (
        <DialogoPreco selecionados={selecionados} podeVerCustos={podeVerCustos} onFechar={fechar} onConcluir={concluir} />
      )}
      {acao === "CATEGORIA" && (
        <DialogoCategoria selecionados={selecionados} categorias={categorias} onFechar={fechar} onConcluir={concluir} />
      )}
      {acao === "MINIMO" && <DialogoMinimo selecionados={selecionados} onFechar={fechar} onConcluir={concluir} />}
      {acao === "DESATIVAR" && <DialogoDesativar selecionados={selecionados} onFechar={fechar} onConcluir={concluir} />}
    </>
  );
}

type PropsDialogo = {
  selecionados: ProdutoSelecionado[];
  onFechar: () => void;
  onConcluir: (resultado: ResultadoEmMassa) => boolean;
};

function Moldura({
  titulo,
  descricao,
  children,
  onFechar,
  rodape,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  onFechar: () => void;
  rodape: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">{children}</div>
        <DialogFooter>{rodape}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const contagem = (n: number) => (n === 1 ? "1 produto selecionado" : `${n} produtos selecionados`);

function useEnvio(onConcluir: PropsDialogo["onConcluir"]) {
  const [enviando, setEnviando] = useState(false);
  const enviar = async (acao: () => Promise<ResultadoEmMassa>) => {
    setEnviando(true);
    try {
      onConcluir(await acao());
    } catch {
      onConcluir({ sucesso: false, mensagem: "Não foi possível concluir. Tente de novo." });
    } finally {
      setEnviando(false);
    }
  };
  return { enviando, enviar };
}

// ── Etiquetas ────────────────────────────────────────────────────────────────

function DialogoEtiquetas({ selecionados, onFechar }: { selecionados: ProdutoSelecionado[]; onFechar: () => void }) {
  const [tamanho, setTamanho] = useState(TAMANHO_DE_ETIQUETA_PADRAO);
  const [modo, setModo] = useState<ModoDeCopias>("UMA");
  const [copias, setCopias] = useState("1");
  const demais = selecionados.length > MAXIMO_DE_PRODUTOS_NA_ETIQUETA;
  const total =
    modo === "UMA"
      ? selecionados.length
      : modo === "FIXO"
        ? selecionados.length * Math.max(1, Number.parseInt(copias, 10) || 1)
        : selecionados.reduce((soma, p) => soma + Math.max(1, p.quantidadeEstoque), 0);

  const imprimir = () => {
    const ids = selecionados.slice(0, MAXIMO_DE_PRODUTOS_NA_ETIQUETA).map((p) => p.id).join(",");
    const url = `/estoque/etiquetas?ids=${ids}&tamanho=${tamanho}&modo=${modo}&copias=${Number.parseInt(copias, 10) || 1}`;
    window.open(url, "_blank", "noopener");
    onFechar();
  };

  return (
    <Moldura
      titulo="Imprimir etiquetas"
      descricao={`${contagem(selecionados.length)}. Abre um PDF com todas as etiquetas, prontas para a impressora.`}
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={imprimir}>
            <Printer className="h-4 w-4" />
            Gerar etiquetas
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="massa-tamanho" className="text-xs font-bold text-kx-texto">
          Tamanho do rolo
        </Label>
        <select id="massa-tamanho" className={SELECT} value={tamanho} onChange={(e) => setTamanho(e.target.value)}>
          {TAMANHOS_DE_ETIQUETA.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rotulo} — {t.ajuda}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-bold text-kx-texto">Quantas de cada produto</legend>
        {(
          [
            ["UMA", "Uma de cada"],
            ["FIXO", "Mesma quantidade para todos"],
            ["SALDO", "Uma por unidade em estoque"],
          ] as const
        ).map(([valor, rotulo]) => (
          <label key={valor} className="flex cursor-pointer items-center gap-2 text-sm text-kx-texto">
            <input type="radio" name="massa-modo" value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="accent-kx-primaria" />
            {rotulo}
            {valor === "FIXO" && modo === "FIXO" ? (
              <Input
                aria-label="Cópias de cada produto"
                type="number"
                min={1}
                max={100}
                className="ml-2 h-9 w-20 border-kx-campo-borda bg-kx-superficie"
                value={copias}
                onChange={(e) => setCopias(e.target.value)}
              />
            ) : null}
          </label>
        ))}
      </fieldset>

      <p className="text-sm text-kx-texto-2">
        Total: <strong className="text-kx-texto">{total} etiquetas</strong>
        {total > 500 ? " — o limite é 500 por vez; o resto fica para uma segunda impressão." : ""}
      </p>
      {demais ? (
        <p className="text-sm text-kx-alerta-texto">
          Só os primeiros {MAXIMO_DE_PRODUTOS_NA_ETIQUETA} produtos entram nesta impressão.
        </p>
      ) : null}
    </Moldura>
  );
}

// ── Preco ────────────────────────────────────────────────────────────────────

function DialogoPreco({ selecionados, podeVerCustos, onFechar, onConcluir }: PropsDialogo & { podeVerCustos: boolean }) {
  const [modo, setModo] = useState("PERCENTUAL");
  const [valor, setValor] = useState("");
  const [arredondamento, setArredondamento] = useState("NENHUM");
  const { enviando, enviar } = useEnvio(onConcluir);

  const regra = useMemo(() => lerRegraDePreco({ modo, valor, arredondamento }), [modo, valor, arredondamento]);
  const previa = useMemo(() => {
    if (!regra.ok) return [];
    return selecionados.map((p) => {
      const atual = deDecimal(p.precoVenda);
      const calculo = calcularNovoPreco(atual, p.custo === null ? null : deDecimal(p.custo), regra.regra, regra.arredondamento);
      return { id: p.id, nome: p.nome, atual, novo: calculo.ok ? calculo.novoCentavos : null, motivo: calculo.ok ? null : calculo.motivo };
    });
  }, [regra, selecionados]);

  const rotuloValor = modo === "DEFINIR" ? "Novo preço (R$)" : modo === "MARGEM_SOBRE_CUSTO" ? "Margem sobre o custo (%)" : "Percentual (%)";
  const dica =
    modo === "PERCENTUAL"
      ? "Use número negativo para baixar. Ex.: 10 aumenta 10%, -5 baixa 5%."
      : modo === "MARGEM_SOBRE_CUSTO"
        ? "Ex.: 100 = o dobro do custo. Produto sem custo cadastrado fica de fora."
        : "Todos os produtos selecionados ficam com este preço.";

  return (
    <Moldura
      titulo="Alterar preço"
      descricao={contagem(selecionados.length)}
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={enviando || !regra.ok}
            onClick={() => void enviar(() => alterarPrecosEmMassa(selecionados.map((p) => p.id), { modo, valor, arredondamento }))}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Aplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="massa-preco-modo" className="text-xs font-bold text-kx-texto">
          Como alterar
        </Label>
        <select id="massa-preco-modo" className={SELECT} value={modo} onChange={(e) => setModo(e.target.value)}>
          <option value="PERCENTUAL">Aumentar ou baixar em %</option>
          <option value="DEFINIR">Definir o mesmo preço para todos</option>
          {podeVerCustos ? <option value="MARGEM_SOBRE_CUSTO">Custo + margem</option> : null}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="massa-preco-valor" className="text-xs font-bold text-kx-texto">
            {rotuloValor}
          </Label>
          <Input
            id="massa-preco-valor"
            inputMode="decimal"
            autoFocus
            className={CAMPO}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === "DEFINIR" ? "49,90" : "10"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="massa-preco-arredondar" className="text-xs font-bold text-kx-texto">
            Arredondar
          </Label>
          <select id="massa-preco-arredondar" className={SELECT} value={arredondamento} onChange={(e) => setArredondamento(e.target.value)}>
            <option value="NENHUM">Não arredondar</option>
            <option value="NOVENTA">Para ,90 (ex.: 37,12 → 37,90)</option>
            <option value="INTEIRO">Para o real cheio (ex.: 37,12 → 38,00)</option>
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-kx-legenda">{dica}</p>

      {regra.ok && previa.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie p-3">
          <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Prévia</span>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
            {previa.map((linha) => (
              <li key={linha.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-kx-texto">{linha.nome}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-kx-legenda">{formatarMoeda(linha.atual / 100)}</span>
                  {" → "}
                  {linha.novo === null ? (
                    <span className="text-kx-alerta-texto">fica igual ({linha.motivo})</span>
                  ) : (
                    <strong className="text-kx-texto">{formatarMoeda(linha.novo / 100)}</strong>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Moldura>
  );
}

// ── Categoria ────────────────────────────────────────────────────────────────

function DialogoCategoria({ selecionados, categorias, onFechar, onConcluir }: PropsDialogo & { categorias: Props["categorias"] }) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const { enviando, enviar } = useEnvio(onConcluir);
  return (
    <Moldura
      titulo="Mudar categoria"
      descricao={contagem(selecionados.length)}
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={enviando || !categoriaId}
            onClick={() => void enviar(() => alterarCategoriaEmMassa(selecionados.map((p) => p.id), categoriaId))}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Mover
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="massa-categoria" className="text-xs font-bold text-kx-texto">
          Nova categoria
        </Label>
        <select id="massa-categoria" className={SELECT} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <p className="text-xs text-kx-legenda">O SKU dos produtos não muda.</p>
      </div>
    </Moldura>
  );
}

// ── Estoque minimo ───────────────────────────────────────────────────────────

function DialogoMinimo({ selecionados, onFechar, onConcluir }: PropsDialogo) {
  const [minimo, setMinimo] = useState("3");
  const { enviando, enviar } = useEnvio(onConcluir);
  const numero = Number(minimo);
  const valido = minimo.trim() !== "" && Number.isInteger(numero) && numero >= 0;
  return (
    <Moldura
      titulo="Estoque mínimo"
      descricao={`${contagem(selecionados.length)}. Abaixo deste saldo o produto aparece como "abaixo do mínimo".`}
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={enviando || !valido}
            onClick={() => void enviar(() => alterarEstoqueMinimoEmMassa(selecionados.map((p) => p.id), numero))}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Aplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="massa-minimo" className="text-xs font-bold text-kx-texto">
          Estoque mínimo
        </Label>
        <Input id="massa-minimo" type="number" min={0} className={CAMPO} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
      </div>
    </Moldura>
  );
}

// ── Desativar ────────────────────────────────────────────────────────────────

function DialogoDesativar({ selecionados, onFechar, onConcluir }: PropsDialogo) {
  const { enviando, enviar } = useEnvio(onConcluir);
  const comSaldo = selecionados.filter((p) => p.quantidadeEstoque > 0).length;
  return (
    <Moldura
      titulo={`Desativar ${selecionados.length === 1 ? "1 produto" : `${selecionados.length} produtos`}?`}
      descricao="Saem da lista e do PDV. Saldo, histórico e vendas continuam — nada é apagado, e dá para reativar depois."
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={enviando}
            onClick={() => void enviar(() => desativarProdutosEmMassa(selecionados.map((p) => p.id)))}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Desativar
          </Button>
        </>
      }
    >
      {comSaldo > 0 ? (
        <p className="text-sm text-kx-alerta-texto">
          {comSaldo === 1 ? "1 deles ainda tem saldo em estoque." : `${comSaldo} deles ainda têm saldo em estoque.`}
        </p>
      ) : null}
    </Moldura>
  );
}
