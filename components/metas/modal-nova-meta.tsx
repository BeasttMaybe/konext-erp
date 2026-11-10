"use client";

import { useState } from "react";
import { toast } from "sonner";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atualizarMeta, criarMeta } from "@/app/actions/metas";
import type {
  CategoriaMeta,
  TipoValorMeta,
  PrioridadeMeta,
  OrigemProgressoMeta,
  FonteAutomaticaMeta,
  MetricaAutomaticaMeta,
  DirecaoMeta,
} from "@prisma/client";

/**
 * Os valores de uma meta existente, no formato dos campos do formulario.
 *
 * `atualizarMeta` existia no servidor desde sempre, completa e com
 * auditoria -- so nao tinha tela. Editar uma meta significava apagar e
 * recriar, perdendo o historico de progresso dela.
 */
export type MetaParaEditar = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaMeta;
  tipoValor: TipoValorMeta;
  valorAlvo: string;
  unidade: string;
  /** Em DD/MM/AAAA, como o campo mostra. */
  dataInicio: string;
  dataPrazo: string;
  prioridade: PrioridadeMeta;
  origemProgresso: OrigemProgressoMeta;
  fonteAutomatica: FonteAutomaticaMeta | "";
  metricaAutomatica: MetricaAutomaticaMeta | "";
  direcao: DirecaoMeta;
  dataInicioAutomatica: string;
  dataFimAutomatica: string;
  produtoIdAutomatica: string;
};

type ModalNovaMetaProps = {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: (id: string) => void;
  /**
   * Ausente = criar. Presente = editar aquela meta.
   *
   * O formulario e o MESMO nos dois casos, de proposito: ele tem 17 campos e
   * tres blocos condicionais de meta automatica. Um segundo formulario para
   * editar divergiria do de criar campo a campo, e o dono acabaria com duas
   * telas pedindo coisas diferentes para a mesma meta.
   *
   * Quem usa este componente deve MONTA-LO ao abrir (ver `pagina-metas`), e
   * nao apenas passar `aberto`: assim o estado nasce com os valores certos,
   * sem nenhum `setState` dentro de efeito para re-sincronizar.
   */
  meta?: MetaParaEditar;
};

const categorias: Array<{ value: CategoriaMeta; label: string }> = [
  { value: "FINANCEIRA", label: "Financeira" },
  { value: "OPERACIONAL", label: "Operacional" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "ESTOQUE", label: "Estoque" },
  { value: "ESTRUTURAL", label: "Estrutural" },
  { value: "EQUIPAMENTO", label: "Equipamento" },
  { value: "REFORMA", label: "Reforma" },
  { value: "OUTRA", label: "Outra" },
];

const tiposValor: Array<{ value: TipoValorMeta; label: string }> = [
  { value: "DINHEIRO", label: "Financeiro (R$)" },
  { value: "QUANTIDADE", label: "Quantidade" },
  { value: "PERCENTUAL", label: "Percentual (%)" },
  { value: "CHECKLIST", label: "Checklist" },
];

const prioridades: Array<{ value: PrioridadeMeta; label: string }> = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

export function ModalNovaMeta({ aberto, aoFechar, aoConcluir, meta }: ModalNovaMetaProps) {
  const editando = meta !== undefined;
  const [titulo, setTitulo] = useState(meta?.titulo ?? "");
  const [descricao, setDescricao] = useState(meta?.descricao ?? "");
  const [categoria, setCategoria] = useState<CategoriaMeta |"">(meta?.categoria ?? "");
  const [tipoValor, setTipoValor] = useState<TipoValorMeta |"">(meta?.tipoValor ?? "");
  const [valorAlvo, setValorAlvo] = useState(meta?.valorAlvo ?? "");
  const [unidade, setUnidade] = useState(meta?.unidade ?? "");
  const [dataInicio, setDataInicio] = useState(meta?.dataInicio ?? "");
  const [dataPrazo, setDataPrazo] = useState(meta?.dataPrazo ?? "");
  const [prioridade, setPrioridade] = useState<PrioridadeMeta>(meta?.prioridade ?? "MEDIA");
  const [origemProgresso, setOrigemProgresso] = useState<OrigemProgressoMeta>(meta?.origemProgresso ?? "MANUAL");
  const [fonteAutomatica, setFonteAutomatica] = useState<FonteAutomaticaMeta |"">(meta?.fonteAutomatica ?? "");
  const [metricaAutomatica, setMetricaAutomatica] = useState<MetricaAutomaticaMeta |"">(meta?.metricaAutomatica ?? "");
  const [direcao, setDirecao] = useState<DirecaoMeta>(meta?.direcao ?? "MAIOR_MELHOR");
  const [dataInicioAutomatica, setDataInicioAutomatica] = useState(meta?.dataInicioAutomatica ?? "");
  const [dataFimAutomatica, setDataFimAutomatica] = useState(meta?.dataFimAutomatica ?? "");
  const [produtoIdAutomatica, setProdutoIdAutomatica] = useState(meta?.produtoIdAutomatica ?? "");
  const [salvando, setSalvando] = useState(false);

  const metricasPorFonte: Record<FonteAutomaticaMeta, Array<{ value: MetricaAutomaticaMeta; label: string }>> = {
    ORDENS_SERVICO: [
      { value: "FATURAMENTO_OS", label: "Faturamento de OS" },
      { value: "QUANTIDADE_OS_FINALIZADAS", label: "Quantidade de OS finalizadas" },
      { value: "QUANTIDADE_OS_CRIADAS", label: "Quantidade de OS criadas" },
      { value: "TICKET_MEDIO_OS", label: "Ticket médio de OS" },
    ],
    GARANTIAS: [
      { value: "RETORNOS_GARANTIA", label: "Retornos de garantia" },
      { value: "TAXA_RETORNO_GARANTIA", label: "Taxa de retorno de garantia" },
      { value: "GARANTIAS_ATIVAS", label: "Garantias ativas" },
    ],
    FINANCEIRO: [
      { value: "RECEBIMENTOS_FINANCEIRO", label: "Recebimentos" },
      { value: "DESPESAS_FINANCEIRO", label: "Despesas" },
    ],
    PDV: [{ value: "FATURAMENTO_PDV", label: "Faturamento do PDV" }],
    VENDAS: [{ value: "QUANTIDADE_VENDAS", label: "Quantidade de vendas" }],
    ESTOQUE: [{ value: "QUANTIDADE_ITEM_ESTOQUE", label: "Quantidade em estoque por produto" }],
  };

  const formatarDataBR = (valor: string) => {
    const digitos = valor.replace(/\D/g, "").slice(0, 8);
    if (digitos.length <= 2) return digitos;
    if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
  };

  const dataBRParaISO = (valor: string) => {
    if (!valor) return undefined;

    const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, dd, mm, yyyy] = match;
    const dia = Number(dd);
    const mes = Number(mm);
    const ano = Number(yyyy);

    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

    const data = new Date(ano, mes - 1, dia);
    const validaDataReal =
      data.getFullYear() === ano &&
      data.getMonth() === mes - 1 &&
      data.getDate() === dia;

    if (!validaDataReal) return null;

    return `${yyyy}-${mm}-${dd}`;
  };

  const limpar = () => {
    setTitulo("");
    setDescricao("");
    setCategoria("");
    setTipoValor("");
    setValorAlvo("");
    setUnidade("");
    setDataInicio("");
    setDataPrazo("");
    setPrioridade("MEDIA");
    setOrigemProgresso("MANUAL");
    setFonteAutomatica("");
    setMetricaAutomatica("");
    setDirecao("MAIOR_MELHOR");
    setDataInicioAutomatica("");
    setDataFimAutomatica("");
    setProdutoIdAutomatica("");
  };

  const fechar = () => {
    if (salvando) return;
    limpar();
    aoFechar();
  };

  const salvar = async () => {
    if (!categoria || !tipoValor) {
      toast.error("Preencha categoria e tipo de valor.");
      return;
    }

    if (origemProgresso === "AUTOMATICA" && (!fonteAutomatica || !metricaAutomatica)) {
      toast.error("Selecione fonte e métrica para meta automática.");
      return;
    }

    const dataInicioIso = dataInicio ? dataBRParaISO(dataInicio) : undefined;
    const dataPrazoIso = dataPrazo ? dataBRParaISO(dataPrazo) : undefined;
    const dataInicioAutoIso = dataInicioAutomatica ? dataBRParaISO(dataInicioAutomatica) : undefined;
    const dataFimAutoIso = dataFimAutomatica ? dataBRParaISO(dataFimAutomatica) : undefined;

    if (dataInicio && !dataInicioIso) {
      toast.error("Data de início inválida. Use DD/MM/AAAA.");
      return;
    }

    if (dataPrazo && !dataPrazoIso) {
      toast.error("Prazo inválido. Use DD/MM/AAAA.");
      return;
    }

    if (dataInicioAutomatica && !dataInicioAutoIso) {
      toast.error("Data inicial automática inválida. Use DD/MM/AAAA.");
      return;
    }

    if (dataFimAutomatica && !dataFimAutoIso) {
      toast.error("Data final automática inválida. Use DD/MM/AAAA.");
      return;
    }

    setSalvando(true);
    try {
      // Editando, a chamada vai para `atualizarMeta`, que ja existia no
      // servidor com validacao e auditoria -- o que faltava era esta tela.
      // `valorAtual` NAO viaja: o progresso realizado nao e campo de
      // formulario (meta manual tem o modal de progresso; meta automatica e
      // sincronizada pelo cron).
      const campos = {
        titulo,
        descricao: descricao || undefined,
        categoria,
        tipoValor,
        origemProgresso,
        fonteAutomatica: origemProgresso === "AUTOMATICA" ? (fonteAutomatica || undefined) : undefined,
        metricaAutomatica: origemProgresso === "AUTOMATICA" ? (metricaAutomatica || undefined) : undefined,
        configuracaoAutomatica:
          origemProgresso === "AUTOMATICA"
            ? {
                dataInicio: dataInicioAutoIso ?? undefined,
                dataFim: dataFimAutoIso ?? undefined,
                produtoId: produtoIdAutomatica || undefined,
              }
            : undefined,
        direcao,
        // `Number(valorAlvo)` cru era o que recusava "8.153,90" (vira NaN) e,
        // pior, aceitava "8.153" como oito reais e quinze. `lerEntradaMonetaria`
        // entende as duas formas que o teclado produz: a pt-BR, com ponto de
        // milhar e vírgula decimal, e a do campo numérico, com ponto decimal.
        // Serve a alvo em dinheiro, em quantidade e em percentual igualmente.
        valorAlvo:
          tipoValor !== "CHECKLIST" && valorAlvo
            ? (() => {
                const centavos = lerEntradaMonetaria(valorAlvo);
                return centavos === null ? undefined : paraMoeda(centavos);
              })()
            : undefined,
        unidade: unidade || undefined,
        dataInicio: dataInicioIso ?? undefined,
        dataPrazo: dataPrazoIso ?? undefined,
        prioridade,
      };

      if (meta) {
        const res = await atualizarMeta({ id: meta.id, ...campos });

        if (!res.sucesso) {
          toast.error(res.erro);
          return;
        }

        toast.success(res.mensagem);
        aoConcluir(meta.id);
        return;
      }

      const res = await criarMeta(campos);

      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }

      toast.success(res.mensagem);
      limpar();
      aoConcluir(res.id);
    } catch {
      toast.error(
        meta ? "Não foi possível salvar a meta." : "Não foi possível criar a meta."
      );
    } finally {
      setSalvando(false);
    }
  };

  const precisaValorAlvo = tipoValor !== "" && tipoValor !== "CHECKLIST";
  const opcoesMetricas = fonteAutomatica ? metricasPorFonte[fonteAutomatica] : [];
  const ehAutomatica = origemProgresso === "AUTOMATICA";

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "O progresso já registrado continua como está — aqui você muda o objetivo, não o realizado."
              : "Crie um objetivo para acompanhar o progresso da empresa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta-titulo">Título *</Label>
            <Input
              id="meta-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Faturar R$ 50.000 em agosto"
              maxLength={120}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-descricao">Descrição</Label>
            <Textarea
              id="meta-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto e detalhes da meta (opcional)"
              maxLength={1000}
              disabled={salvando}
              className="resize-none h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaMeta)} disabled={salvando}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de valor *</Label>
              <Select value={tipoValor} onValueChange={(v) => setTipoValor(v as TipoValorMeta)} disabled={salvando}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposValor.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {precisaValorAlvo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meta-valor-alvo">Valor alvo *</Label>
                <Input
                  id="meta-valor-alvo"
                  type="number"
                  min={0}
                  step={tipoValor === "DINHEIRO" ? "0.01" : "1"}
                  value={valorAlvo}
                  onChange={(e) => setValorAlvo(e.target.value)}
                  placeholder="0"
                  disabled={salvando}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta-unidade">Unidade</Label>
                <Input
                  id="meta-unidade"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder={tipoValor === "PERCENTUAL" ? "%" : "Ex: OS, peças..."}
                  maxLength={30}
                  disabled={salvando}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem do progresso *</Label>
              <Select
                value={origemProgresso}
                onValueChange={(v) => {
                  setOrigemProgresso(v as OrigemProgressoMeta);
                  if (v === "MANUAL") {
                    setFonteAutomatica("");
                    setMetricaAutomatica("");
                  }
                }}
                disabled={salvando}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="AUTOMATICA">Automática</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeMeta)} disabled={salvando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prioridades.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {ehAutomatica && (
            <div className="space-y-3 rounded-md border border-kx-painel-borda p-3">
              <p className="text-xs text-kx-legenda">Configuração automática</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fonte automática *</Label>
                  <Select
                    value={fonteAutomatica}
                    onValueChange={(v) => {
                      setFonteAutomatica(v as FonteAutomaticaMeta);
                      setMetricaAutomatica("");
                    }}
                    disabled={salvando}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORDENS_SERVICO">Ordens de Serviço</SelectItem>
                      <SelectItem value="GARANTIAS">Garantias</SelectItem>
                      <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
                      <SelectItem value="PDV">PDV</SelectItem>
                      <SelectItem value="VENDAS">Vendas</SelectItem>
                      <SelectItem value="ESTOQUE">Estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Métrica *</Label>
                  <Select
                    value={metricaAutomatica}
                    onValueChange={(v) => setMetricaAutomatica(v as MetricaAutomaticaMeta)}
                    disabled={salvando || !fonteAutomatica}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesMetricas.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Direção da meta</Label>
                  <Select value={direcao} onValueChange={(v) => setDirecao(v as DirecaoMeta)} disabled={salvando}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAIOR_MELHOR">Quanto maior, melhor</SelectItem>
                      <SelectItem value="MENOR_MELHOR">Quanto menor, melhor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meta-produto-auto">Produto (quando aplicável)</Label>
                  <Input
                    id="meta-produto-auto"
                    value={produtoIdAutomatica}
                    onChange={(e) => setProdutoIdAutomatica(e.target.value)}
                    placeholder="ID do produto"
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="meta-inicio-auto">Data inicial análise</Label>
                  <Input
                    id="meta-inicio-auto"
                    type="text"
                    value={dataInicioAutomatica}
                    onChange={(e) => setDataInicioAutomatica(formatarDataBR(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    maxLength={10}
                    disabled={salvando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-fim-auto">Data final análise</Label>
                  <Input
                    id="meta-fim-auto"
                    type="text"
                    value={dataFimAutomatica}
                    onChange={(e) => setDataFimAutomatica(formatarDataBR(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    maxLength={10}
                    disabled={salvando}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meta-prazo">Prazo</Label>
              <Input
                id="meta-prazo"
                type="text"
                value={dataPrazo}
                onChange={(e) => setDataPrazo(formatarDataBR(e.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                disabled={salvando}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-inicio">Data de início</Label>
            <Input
              id="meta-inicio"
              type="text"
              value={dataInicio}
              onChange={(e) => setDataInicio(formatarDataBR(e.target.value))}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
              maxLength={10}
              disabled={salvando}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !titulo.trim() || !categoria || !tipoValor}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
