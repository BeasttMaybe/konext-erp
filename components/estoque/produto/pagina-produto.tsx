"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, History, Package, PowerOff, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import {
  desativarProduto,
  reativarProduto,
  salvarProduto,
  sugerirSku,
  type LinhaMovimentacaoProduto,
  type ProdutoParaEdicao,
  type ResumoProduto,
} from "@/app/actions/estoque";
import { ListaMovimentacoes } from "@/components/estoque/lista-movimentacoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { deDecimal, formatarReais } from "@/lib/dinheiro";
import { digitoVerificadorEanConfere } from "@/lib/dominio/estoque/etiqueta";
import {
  UNIDADES_DE_MEDIDA,
  UNIDADE_PADRAO,
  margemPercentual,
  saudeDaMargem,
} from "@/lib/dominio/estoque/preco";

import { PainelEtiqueta } from "./painel-etiqueta";
import { PainelResumo } from "./painel-resumo";
import { SeletorCategoria, type CategoriaOpcao } from "./seletor-categoria";

/**
 * A página do produto, no lugar do modal de oito campos.
 *
 * O modal cabia o que cabia: nome, código de barras, imagem, categoria, custo,
 * preço, saldo, mínimo e descrição. Tudo o que a referência aprovada pede a
 * mais — SKU, unidade, compatibilidade, margem, venda sem estoque, etiqueta,
 * movimentações e resumo — não cabe num modal, e tentar encaixar produziria um
 * modal com rolagem interna, que é a pior forma de preencher formulário.
 *
 * Decisão que vale registrar: é uma página só pra cadastrar e editar. O "novo"
 * e o "editar" são a mesma tela, porque são o mesmo formulário — telas separadas
 * divergem, e a de cadastro é sempre a que fica para trás.
 */

type Campos = {
  nome: string;
  categoriaId: string;
  sku: string;
  unidade: string;
  codigoBarras: string;
  compatibilidade: string;
  imagemUrl: string;
  descricao: string;
  custo: string;
  precoVenda: string;
  quantidadeEstoque: string;
  estoqueMinimo: string;
  permiteVendaSemEstoque: boolean;
  ativo: boolean;
};

function camposIniciais(produto: ProdutoParaEdicao | null, categoriaPadrao: string): Campos {
  if (!produto) {
    return {
      nome: "",
      categoriaId: categoriaPadrao,
      sku: "",
      unidade: UNIDADE_PADRAO,
      codigoBarras: "",
      compatibilidade: "",
      imagemUrl: "",
      descricao: "",
      custo: "",
      precoVenda: "",
      quantidadeEstoque: "0",
      estoqueMinimo: "3",
      permiteVendaSemEstoque: false,
      ativo: true,
    };
  }

  return {
    nome: produto.nome,
    categoriaId: produto.categoriaId,
    sku: produto.sku ?? "",
    unidade: produto.unidade,
    codigoBarras: produto.codigoBarras ?? "",
    compatibilidade: produto.compatibilidade ?? "",
    imagemUrl: produto.imagemUrl ?? "",
    descricao: produto.descricao ?? "",
    // Campo vazio quando o custo é oculto por permissão: zero ali seria
    // mentira, e salvar gravaria zero sobre o custo real.
    custo: produto.custo === null ? "" : String(produto.custo),
    precoVenda: String(produto.precoVenda),
    quantidadeEstoque: String(produto.quantidadeEstoque),
    estoqueMinimo: String(produto.estoqueMinimo),
    permiteVendaSemEstoque: produto.permiteVendaSemEstoque,
    ativo: produto.ativo,
  };
}

export function PaginaProduto({
  produto,
  valoresIniciais,
  categoriasIniciais,
  resumo,
  movimentacoes,
  fusoHorario,
}: {
  /** `null` é cadastro novo. É isto, e só isto, que decide o modo da tela. */
  produto: ProdutoParaEdicao | null;
  /**
   * Semente do formulário quando o cadastro vem de uma duplicação. Separado de
   * `produto` de propósito: preencher os campos não pode fazer a tela acreditar
   * que está editando um produto existente — o "Salvar" tentaria atualizar um
   * id que não é dela.
   */
  valoresIniciais?: ProdutoParaEdicao | null;
  categoriasIniciais: CategoriaOpcao[];
  resumo: ResumoProduto | null;
  movimentacoes: LinhaMovimentacaoProduto[];
  fusoHorario: string;
}) {
  const router = useRouter();
  const podeEditar = useTemPermissao("estoque.editar");
  const podeDesativar = useTemPermissao("estoque.excluir");
  const podeVerCustos = useTemPermissao("estoque.ver_custos");

  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [campos, setCampos] = useState<Campos>(() =>
    camposIniciais(produto ?? valoresIniciais ?? null, categoriasIniciais[0]?.id ?? "")
  );
  const [emAndamento, iniciarTransicao] = useTransition();

  const alterar = <C extends keyof Campos>(campo: C, valor: Campos[C]) =>
    setCampos((atual) => ({ ...atual, [campo]: valor }));

  const custoEmReais = Number(campos.custo.replace(",", ".")) || 0;
  const precoEmReais = Number(campos.precoVenda.replace(",", ".")) || 0;

  const margem = useMemo(
    () => margemPercentual(deDecimal(custoEmReais), deDecimal(precoEmReais)),
    [custoEmReais, precoEmReais]
  );
  const saude = saudeDaMargem(margem);

  // O verificador é conferido na tela, antes de salvar: um dígito trocado só
  // apareceria na hora de imprimir, e lá a mensagem vem do gerador.
  const eanSuspeito = digitoVerificadorEanConfere(campos.codigoBarras) === false;

  const salvar = () => {
    iniciarTransicao(async () => {
      const resultado = await salvarProduto(produto?.id ?? null, {
        nome: campos.nome,
        categoriaId: campos.categoriaId,
        sku: campos.sku || undefined,
        unidade: campos.unidade,
        codigoBarras: campos.codigoBarras || undefined,
        compatibilidade: campos.compatibilidade || undefined,
        imagemUrl: campos.imagemUrl || undefined,
        descricao: campos.descricao || undefined,
        // Custo oculto por permissão não é enviado como zero: o servidor
        // mantém o que já estava gravado.
        custo: podeVerCustos ? custoEmReais : (produto?.custo ?? 0),
        precoVenda: precoEmReais,
        quantidadeEstoque: Number.parseInt(campos.quantidadeEstoque, 10) || 0,
        estoqueMinimo: Number.parseInt(campos.estoqueMinimo, 10) || 0,
        permiteVendaSemEstoque: campos.permiteVendaSemEstoque,
        ativo: campos.ativo,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);

      if (produto === null) {
        router.replace(`/estoque/produtos/${resultado.produtoId}`);
      } else {
        router.refresh();
      }
    });
  };

  const trocarSituacao = () => {
    if (!produto) return;

    iniciarTransicao(async () => {
      const resultado = campos.ativo
        ? await desativarProduto(produto.id)
        : await reativarProduto(produto.id);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      alterar("ativo", !campos.ativo);
      router.refresh();
    });
  };

  const gerarSku = () => {
    iniciarTransicao(async () => {
      const sugestao = await sugerirSku(campos.categoriaId);
      if (sugestao) alterar("sku", sugestao);
    });
  };

  return (
    <div className="flex w-full flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-3 pl-0 text-kx-legenda hover:bg-transparent hover:text-kx-texto"
          >
            <Link href="/estoque">
              <ArrowLeft className="h-4 w-4" />
              Estoque
            </Link>
          </Button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-bold text-foreground">
                  {campos.nome.trim() || (produto ? produto.nome : "Novo produto")}
                </h1>
                {campos.sku && (
                  <span className="rounded-kx-pilula bg-kx-superficie px-2.5 py-1 text-xs font-bold tabular-nums text-kx-texto-2">
                    {campos.sku}
                  </span>
                )}
                {produto &&
                  (campos.ativo ? (
                    <PilulaStatus variante="sucesso">Ativo</PilulaStatus>
                  ) : (
                    <PilulaStatus variante="neutro">Desativado</PilulaStatus>
                  ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {produto
                  ? "Alterações de custo e preço ficam registradas no histórico."
                  : "O saldo informado aqui entra no livro de movimentações como entrada de cadastro."}
              </p>
            </div>

            {podeEditar && (
              <div className="flex flex-wrap gap-2">
                {produto && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={emAndamento}
                    onClick={() => router.push(`/estoque/produtos/novo?copiarDe=${produto.id}`)}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>
                )}
                <Button type="button" disabled={emAndamento} onClick={salvar}>
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-kx-legenda" aria-hidden />
                <h2 className="text-base font-semibold text-kx-texto">Dados do produto</h2>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={campos.nome}
                    disabled={!podeEditar}
                    placeholder="Capa de silicone iPhone 13"
                    onChange={(evento) => alterar("nome", evento.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <SeletorCategoria
                    categorias={categorias}
                    valor={campos.categoriaId}
                    desabilitado={!podeEditar}
                    aoMudar={(categoriaId) => alterar("categoriaId", categoriaId)}
                    aoCriar={(nova) => {
                      setCategorias((atuais) =>
                        [...atuais, nova].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                      );
                      alterar("categoriaId", nova.id);
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="unidade">Unidade</Label>
                  <Select
                    value={campos.unidade}
                    disabled={!podeEditar}
                    onValueChange={(valor) => alterar("unidade", valor)}
                  >
                    <SelectTrigger id="unidade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_DE_MEDIDA.map((unidade) => (
                        <SelectItem key={unidade.valor} value={unidade.valor}>
                          {unidade.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sku"
                      value={campos.sku}
                      disabled={!podeEditar}
                      placeholder="CAP-0001"
                      onChange={(evento) => alterar("sku", evento.target.value.toUpperCase())}
                    />
                    {podeEditar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Gerar SKU"
                        title="Gerar o próximo SKU desta categoria"
                        disabled={emAndamento || campos.categoriaId === ""}
                        onClick={gerarSku}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-kx-legenda">
                    {produto === null
                      ? "Gerado ao salvar, se deixar vazio. Pode usar o seu próprio código."
                      : "Pode usar o seu próprio código. Vazio mantém o atual."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="codigoBarras">Código de barras</Label>
                  <Input
                    id="codigoBarras"
                    value={campos.codigoBarras}
                    disabled={!podeEditar}
                    placeholder="7891000315507"
                    onChange={(evento) => alterar("codigoBarras", evento.target.value)}
                    className={eanSuspeito ? "border-kx-alerta" : ""}
                  />
                  <p className={`text-xs ${eanSuspeito ? "font-semibold text-kx-alerta-texto" : "text-kx-legenda"}`}>
                    {eanSuspeito
                      ? "O dígito verificador não fecha. Confira o número na embalagem."
                      : "O da embalagem do fabricante. Sem ele, a etiqueta usa o SKU."}
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="compatibilidade">Marca / compatibilidade</Label>
                  <Input
                    id="compatibilidade"
                    value={campos.compatibilidade}
                    disabled={!podeEditar}
                    placeholder="iPhone 13 / 13 Pro"
                    onChange={(evento) => alterar("compatibilidade", evento.target.value)}
                  />
                  <p className="text-xs text-kx-legenda">
                    É por aqui que se acha a peça no balcão. Entra na busca do estoque.
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="descricao">Observações</Label>
                  <Textarea
                    id="descricao"
                    rows={2}
                    value={campos.descricao}
                    disabled={!podeEditar}
                    onChange={(evento) => alterar("descricao", evento.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="imagemUrl">Imagem (URL)</Label>
                  <Input
                    id="imagemUrl"
                    value={campos.imagemUrl}
                    disabled={!podeEditar}
                    placeholder="https://..."
                    onChange={(evento) => alterar("imagemUrl", evento.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-kx-texto">Preço e estoque</h2>
                {podeVerCustos && <PilulaDeMargem margem={margem} saude={saude} />}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {podeVerCustos && (
                  <div className="space-y-1.5">
                    <Label htmlFor="custo">Custo (R$)</Label>
                    <Input
                      id="custo"
                      type="number"
                      min={0}
                      step="0.01"
                      value={campos.custo}
                      disabled={!podeEditar}
                      onChange={(evento) => alterar("custo", evento.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="precoVenda">Preço de venda (R$)</Label>
                  <Input
                    id="precoVenda"
                    type="number"
                    min={0}
                    step="0.01"
                    value={campos.precoVenda}
                    disabled={!podeEditar}
                    onChange={(evento) => alterar("precoVenda", evento.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="quantidadeEstoque">Estoque atual</Label>
                  <Input
                    id="quantidadeEstoque"
                    type="number"
                    step="1"
                    value={campos.quantidadeEstoque}
                    disabled={!podeEditar}
                    onChange={(evento) => alterar("quantidadeEstoque", evento.target.value)}
                  />
                  {produto !== null &&
                    Number.parseInt(campos.quantidadeEstoque, 10) !== produto.quantidadeEstoque && (
                      <p className="text-xs font-semibold text-kx-alerta-texto">
                        Vira um ajuste manual no livro, de {produto.quantidadeEstoque} para{" "}
                        {Number.parseInt(campos.quantidadeEstoque, 10) || 0}.
                      </p>
                    )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="estoqueMinimo">Estoque mínimo</Label>
                  <Input
                    id="estoqueMinimo"
                    type="number"
                    min={0}
                    step="1"
                    value={campos.estoqueMinimo}
                    disabled={!podeEditar}
                    onChange={(evento) => alterar("estoqueMinimo", evento.target.value)}
                  />
                  <p className="text-xs text-kx-legenda">Avisa no painel abaixo disto.</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-kx-botao bg-kx-superficie px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-kx-texto">Vender sem estoque</p>
                  <p className="text-xs text-kx-legenda">
                    Deixa fechar venda com saldo zerado, mesmo que a configuração geral do PDV não
                    permita. Serve para o que você encomenda sob demanda.
                  </p>
                </div>
                <Switch
                  checked={campos.permiteVendaSemEstoque}
                  disabled={!podeEditar}
                  aria-label="Vender sem estoque"
                  onCheckedChange={(marcado) => alterar("permiteVendaSemEstoque", marcado)}
                />
              </div>
            </section>

            {produto !== null && (
              <section className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-kx-legenda" aria-hidden />
                  <h2 className="text-base font-semibold text-kx-texto">Últimas movimentações</h2>
                </div>

                <div className="mt-4">
                  {movimentacoes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-kx-legenda">
                      Nada registrado para este produto ainda. O livro de movimentações começou em
                      02/11/2026 — venda anterior a isso não aparece aqui.
                    </p>
                  ) : (
                    <ListaMovimentacoes linhas={movimentacoes} />
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <PainelEtiqueta
              produtoId={produto?.id ?? null}
              nome={campos.nome}
              precoFormatado={formatarReais(deDecimal(precoEmReais))}
              codigoBarras={campos.codigoBarras}
              sku={campos.sku}
              compatibilidade={campos.compatibilidade}
            />

            {produto !== null && resumo !== null && (
              <PainelResumo
                resumo={resumo}
                saldo={produto.quantidadeEstoque}
                unidade={campos.unidade}
                fusoHorario={fusoHorario}
              />
            )}

            {produto !== null && podeDesativar && (
              <Button
                type="button"
                variant="outline"
                className={
                  campos.ativo
                    ? "w-full border-kx-erro-borda text-kx-erro-texto hover:bg-kx-erro-fundo"
                    : "w-full"
                }
                disabled={emAndamento}
                onClick={trocarSituacao}
              >
                {campos.ativo ? (
                  <>
                    <PowerOff className="h-4 w-4" />
                    Desativar produto
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Reativar produto
                  </>
                )}
              </Button>
            )}

            {produto !== null && campos.ativo && (
              <p className="text-xs text-kx-legenda">
                Desativar tira o produto da lista e do PDV. O saldo, o histórico e as vendas
                continuam — nada é apagado.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function PilulaDeMargem({
  margem,
  saude,
}: {
  margem: number | null;
  saude: ReturnType<typeof saudeDaMargem>;
}) {
  if (saude === "SEM_PRECO") {
    return <PilulaStatus variante="neutro">Sem preço</PilulaStatus>;
  }

  const texto = `Margem ${Math.round(margem ?? 0)}%`;

  if (saude === "PREJUIZO") return <PilulaStatus variante="erro">{texto}</PilulaStatus>;
  if (saude === "APERTADA") return <PilulaStatus variante="alerta">{texto}</PilulaStatus>;

  return <PilulaStatus variante="sucesso">{texto}</PilulaStatus>;
}
