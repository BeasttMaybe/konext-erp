"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, MoreHorizontal, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { IndicadoresEstoque as CartoesIndicadores } from "@/components/estoque/indicadores-estoque";
import { RelatoriosEstoque } from "@/components/estoque/relatorios-estoque";
import { SheetMovimentacoesProduto } from "@/components/estoque/sheet-movimentacoes-produto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  desativarProduto,
  listarProdutosPaginado,
  obterIndicadoresEstoque,
  type IndicadoresEstoque,
  type SituacaoEstoque,
} from "@/app/actions/estoque";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { listarCategoriasAtivas } from "@/app/actions/categorias-produto";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { BotaoImportarProdutos } from "@/components/importacao/importar-cadastros";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LIMITE_POR_PAGINA = 20;

// ── Skeleton de carregamento ───────────────────────────────────────────────────

function SkeletonEstoque() {
  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm lg:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="h-9 w-56 rounded-lg bg-kx-painel-borda animate-pulse" />
          <div className="h-4 w-80 rounded bg-kx-superficie animate-pulse mt-2" />
        </div>
      </div>
      <div className="px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 h-10 rounded-lg bg-kx-superficie animate-pulse" />
              <div className="w-52 h-10 rounded-lg bg-kx-superficie animate-pulse" />
              <div className="w-36 h-10 rounded-lg bg-kx-superficie animate-pulse" />
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4 items-center px-4 py-3 border-b border-border last:border-0"
                >
                  <div className="w-10 h-10 rounded-md bg-kx-superficie animate-pulse shrink-0" />
                  <div className="flex-1 h-4 rounded bg-kx-superficie animate-pulse" />
                  <div className="w-24 h-4 rounded bg-kx-superficie animate-pulse" />
                  <div className="w-20 h-4 rounded bg-kx-superficie animate-pulse" />
                  <div className="w-20 h-4 rounded bg-kx-superficie animate-pulse" />
                  <div className="w-16 h-6 rounded-full bg-kx-superficie animate-pulse" />
                  <div className="w-8 h-8 rounded-md bg-kx-superficie animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProdutoTabela {
  id: string;
  nome: string;
  codigoBarras: string | null;
  imagemUrl: string | null;
  descricao: string | null;
  sku: string | null;
  unidade: string;
  categoriaId: string;
  /** Nome da categoria cadastrada — não há mais mapa fixo de rótulos. */
  categoria: string;
  /** null quando o usuário logado não tem a permissão estoque.ver_custos. */
  custo: number | null;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

function ConteudoEstoque() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const podeEditarEstoque = useTemPermissao("estoque.editar");
  const podeExcluirEstoque = useTemPermissao("estoque.excluir");

  // Página atual lida da URL (?page=N), com fallback para 1
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [produtos, setProdutos] = useState<ProdutoTabela[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("TODAS");
  const [categorias, setCategorias] = useState<Array<{ id: string; nome: string }>>([]);
  const [produtoParaDesativar, setProdutoParaDesativar] = useState<ProdutoTabela | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoEstoque>("TODAS");
  const [aba, setAba] = useState<"produtos" | "relatorios">("produtos");
  const [indicadores, setIndicadores] = useState<IndicadoresEstoque | null>(null);
  const [produtoEmMovimentacao, setProdutoEmMovimentacao] = useState<ProdutoTabela | null>(null);
  // Incrementado após cada mutação para forçar o useEffect a rebuscar a lista
  const [contadorRecarga, setContadorRecarga] = useState(0);

  // Navega para uma página específica, preservando os demais query params
  const irParaPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(pagina));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Ao alterar busca ou filtro, volta para a página 1
  const aoAlterarBusca = (valor: string) => {
    setBusca(valor);
    irParaPagina(1);
  };

  const aoAlterarCategoria = (valor: string) => {
    setCategoriaSelecionada(valor);
    irParaPagina(1);
  };

  const aoAlterarSituacao = (valor: string) => {
    setSituacao(valor as SituacaoEstoque);
    irParaPagina(1);
  };

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        setCarregando(true);
        const resultado = await listarProdutosPaginado(
          currentPage,
          LIMITE_POR_PAGINA,
          busca,
          categoriaSelecionada,
          situacao
        );
        if (!ativo) return;
        setProdutos(
          resultado.data.map((produto) => ({
            id: produto.id,
            nome: produto.nome,
            codigoBarras: produto.codigoBarras,
            imagemUrl: produto.imagemUrl,
            descricao: produto.descricao,
            sku: produto.sku,
            unidade: produto.unidade,
            categoriaId: produto.categoriaId,
            categoria: produto.categoria,
            custo: produto.custo,
            precoVenda: produto.precoVenda,
            quantidadeEstoque: produto.quantidadeEstoque,
            estoqueMinimo: produto.estoqueMinimo,
          }))
        );
        setTotalPages(resultado.totalPages);
      } catch {
        if (!ativo) return;
        toast.error("Não foi possível carregar os produtos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [currentPage, busca, categoriaSelecionada, situacao, contadorRecarga]);

  // As categorias são cadastro: carregam uma vez e recarregam depois de uma
  // mutação, porque uma categoria nova pode ter nascido na página do produto.
  useEffect(() => {
    let ativo = true;

    void listarCategoriasAtivas()
      .then((lista) => {
        if (ativo) setCategorias(lista);
      })
      .catch(() => {
        // O filtro por categoria é conveniência: sem ele a lista continua
        // inteira, e um toast aqui só empilharia erro.
      });

    return () => {
      ativo = false;
    };
  }, [contadorRecarga]);

  // Os indicadores não dependem de página nem de filtro: são do estoque
  // inteiro. Recarregam só depois de uma mutação, que é quando podem mudar.
  useEffect(() => {
    let ativo = true;

    obterIndicadoresEstoque()
      .then((resultado) => {
        if (ativo) setIndicadores(resultado);
      })
      .catch(() => {
        // KPI que falha não derruba a tela: a lista de produtos é o que
        // importa aqui, e um cartão vazio é melhor que uma página em branco.
      });

    return () => {
      ativo = false;
    };
  }, [contadorRecarga]);

  // A filtragem é feita no servidor — exibe a lista recebida diretamente
  const produtosFiltrados = produtos;

  const aoConfirmarDesativacao = async () => {
    if (!produtoParaDesativar) return;

    const resultado = await desativarProduto(produtoParaDesativar.id);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return;
    }

    toast.success(resultado.mensagem);
    setProdutoParaDesativar(null);
    setContadorRecarga((n) => n + 1);
  };

  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Estoque & Produtos</h1>
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
            Gerencie catalogo, custos, precos e alertas de estoque minimo.
          </p>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {indicadores !== null && <CartoesIndicadores dados={indicadores} />}

            <div className="flex items-center gap-2" role="tablist" aria-label="Visão do estoque">
              {([
                ["produtos", "Produtos"],
                ["relatorios", "Relatórios"],
              ] as const).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  aria-selected={aba === valor}
                  onClick={() => setAba(valor)}
                  className={`h-9 rounded-kx-pilula border px-4 text-sm font-bold transition-colors ${
                    aba === valor
                      ? "border-kx-primaria bg-kx-primaria text-primary-foreground"
                      : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {aba === "relatorios" && <RelatoriosEstoque />}

            {aba === "produtos" && (
            <Card className="border-border bg-card p-3 sm:p-5 space-y-4">
              {/* Celular: busca na linha toda, filtros e botoes dois a dois. */}
              <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-row lg:items-center lg:gap-3">
                <div className="relative col-span-2 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(evento) => aoAlterarBusca(evento.target.value)}
                    placeholder="Buscar por nome ou codigo de barras"
                    className="pl-9"
                  />
                </div>

                <Select value={situacao} onValueChange={aoAlterarSituacao}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Situação do saldo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Qualquer saldo</SelectItem>
                    <SelectItem value="ABAIXO_DO_MINIMO">Abaixo do mínimo</SelectItem>
                    <SelectItem value="SEM_ESTOQUE">Sem estoque</SelectItem>
                    <SelectItem value="OK">Saldo saudável</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={categoriaSelecionada}
                  onValueChange={aoAlterarCategoria}
                >
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <SelectValue placeholder="Filtrar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as categorias</SelectItem>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {podeEditarEstoque ? (
                  <>
                    {/* Entrar nota vem ANTES de "novo produto" porque é o
                        caminho que cadastra dezenas de produtos de uma vez,
                        com o custo certo. Cadastrar um a um é a exceção. */}
                    <Button asChild variant="outline">
                      <Link href="/estoque/notas/nova">
                        <FileUp className="h-4 w-4 mr-2" />
                        Entrada de nota
                      </Link>
                    </Button>

                    <span className="hidden sm:inline-flex">
                      <BotaoImportarProdutos />
                    </span>

                    <Button asChild>
                      <Link href="/estoque/produtos/novo">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo produto
                      </Link>
                    </Button>
                  </>
                ) : null}
              </div>

              {/* Celular: um cartao por produto, com foto, codigo, preco e saldo;
                  toque abre o produto. A tabela de sete colunas nao cabia. */}
              <ul className="flex flex-col gap-2 md:hidden" aria-label="Produtos">
                {produtosFiltrados.map((produto) => {
                  const estoqueBaixo = produto.quantidadeEstoque <= produto.estoqueMinimo;
                  return (
                    <li key={produto.id}>
                      <Link
                        href={`/estoque/produtos/${produto.id}`}
                        className="flex items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
                      >
                        {produto.imagemUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto do cadastro, de qualquer endereco.
                          <img src={produto.imagemUrl} alt="" className="h-12 w-12 shrink-0 rounded-kx-botao object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-kx-botao border border-kx-painel-borda bg-kx-cartao">
                            <Package className="h-5 w-5 text-kx-legenda" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold text-kx-texto">{produto.nome}</span>
                          <span className="block truncate text-xs text-kx-legenda">
                            {[produto.sku, produto.categoria].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-base font-bold tabular-nums text-kx-texto">{formatarMoeda(produto.precoVenda)}</span>
                          <Badge variant={estoqueBaixo ? "destructive" : "outline"}>{produto.quantidadeEstoque} un.</Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {!carregando && produtosFiltrados.length === 0 && (
                  <li className="py-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</li>
                )}
                {carregando && <li className="py-8 text-center text-sm text-muted-foreground">Carregando produtos...</li>}
              </ul>

              <div className="hidden rounded-lg border border-border overflow-hidden md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-kx-sticky bg-card">
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preco de Venda</TableHead>
                      <TableHead>Estoque Atual</TableHead>
                      {(podeEditarEstoque || podeExcluirEstoque) && (
                        <TableHead className="text-right">Acoes</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosFiltrados.map((produto) => {
                      const estoqueBaixo = produto.quantidadeEstoque <= produto.estoqueMinimo;

                      return (
                        <TableRow key={produto.id}>
                          <TableCell>
                            {produto.imagemUrl ? (
                              <img
                                src={produto.imagemUrl}
                                alt={produto.nome}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border border-border">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            <Link
                              href={`/estoque/produtos/${produto.id}`}
                              className="hover:underline"
                            >
                              {produto.nome}
                            </Link>
                            {produto.sku && (
                              <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                                {produto.sku}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{produto.categoria}</TableCell>
                          <TableCell>{produto.custo === null ? "—" : formatarMoeda(produto.custo)}</TableCell>
                          <TableCell>{formatarMoeda(produto.precoVenda)}</TableCell>
                          <TableCell>
                            <Badge variant={estoqueBaixo ? "destructive" : "outline"}>
                              {produto.quantidadeEstoque}
                            </Badge>
                          </TableCell>
                          {(podeEditarEstoque || podeExcluirEstoque) && (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {podeEditarEstoque ? (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/estoque/produtos/${produto.id}`}>
                                        Abrir produto
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    onClick={() => setProdutoEmMovimentacao(produto)}
                                  >
                                    Movimentações
                                  </DropdownMenuItem>
                                  {podeExcluirEstoque ? (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setProdutoParaDesativar(produto)}
                                    >
                                      Desativar
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}

                    {!carregando && produtosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={podeEditarEstoque || podeExcluirEstoque ? 7 : 6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Nenhum produto encontrado para os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}

                    {carregando && (
                      <TableRow>
                        <TableCell
                          colSpan={podeEditarEstoque || podeExcluirEstoque ? 7 : 6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Carregando produtos...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={irParaPagina}
                disabled={carregando}
              />
            </Card>
            )}
          </div>
      </div>

      <SheetMovimentacoesProduto
        produtoId={produtoEmMovimentacao?.id ?? null}
        produtoNome={produtoEmMovimentacao?.nome ?? null}
        aberto={Boolean(produtoEmMovimentacao)}
        aoFechar={() => setProdutoEmMovimentacao(null)}
      />

      <AlertDialog
        open={Boolean(produtoParaDesativar)}
        onOpenChange={(aberto) => {
          if (!aberto) setProdutoParaDesativar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {produtoParaDesativar?.nome}?</AlertDialogTitle>
            {/* Antes aqui estava "não pode ser desfeita", e era pior que isso:
                a ação apagava o produto DE VERDADE, levando o livro de
                movimentações dele junto (onDelete: Cascade). Agora desativa, e
                dá pra reativar na página do produto. */}
            <AlertDialogDescription>
              O produto sai da lista e do PDV. Saldo, histórico e vendas continuam — nada é
              apagado, e dá para reativar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aoConfirmarDesativacao}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
// useSearchParams() dentro de ConteudoEstoque precisa estar dentro de <Suspense>
// para compatibilidade com renderização estática do Next.js.

export default function PaginaEstoque() {
  return (
    <Suspense fallback={<SkeletonEstoque />}>
      <ConteudoEstoque />
    </Suspense>
  );
}
