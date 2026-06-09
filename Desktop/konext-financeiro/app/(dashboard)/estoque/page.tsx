"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
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
  atualizarProduto,
  criarProduto,
  excluirProduto,
  listarProdutosPaginado,
} from "@/app/actions/estoque";
import { ModalNovoProduto } from "@/components/estoque/modal-novo-produto";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { categoriasProduto, type FormProduto } from "@/lib/validations/estoque";
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

type CategoriaProduto = (typeof categoriasProduto)[number];

interface ProdutoTabela {
  id: string;
  nome: string;
  codigoBarras: string | null;
  imagemUrl: string | null;
  descricao: string | null;
  categoria: CategoriaProduto;
  custo: number;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}

const mapaCategoriaRotulo: Record<CategoriaProduto, string> = {
  ACESSORIO: "Acessorio",
  PECA_REPARO: "Peca de Reparo",
  EQUIPAMENTO_REDE: "Equipamento de Rede",
  SERVICO: "Servico",
  OUTROS: "Outros",
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const normalizarTexto = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]/gi, "");

export default function PaginaEstoque() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Página atual lida da URL (?page=N), com fallback para 1
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [produtos, setProdutos] = useState<ProdutoTabela[]>([]);
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<"TODAS" | CategoriaProduto>("TODAS");
  const [modalNovoProdutoAberto, setModalNovoProdutoAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoTabela | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoTabela | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Navega para uma página específica, preservando os demais query params
  const irParaPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(pagina));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const carregarProdutos = async () => {
    try {
      setCarregando(true);
      const resultado = await listarProdutosPaginado(
        currentPage,
        LIMITE_POR_PAGINA,
        busca,
        categoriaSelecionada
      );
      setProdutos(
        resultado.data.map((produto) => ({
          id: produto.id,
          nome: produto.nome,
          codigoBarras: produto.codigoBarras,
          imagemUrl: produto.imagemUrl,
          descricao: produto.descricao,
          categoria: produto.categoria as CategoriaProduto,
          custo: produto.custo,
          precoVenda: produto.precoVenda,
          quantidadeEstoque: produto.quantidadeEstoque,
          estoqueMinimo: produto.estoqueMinimo,
        }))
      );
      setTotalProdutos(resultado.total);
      setTotalPages(resultado.totalPages);
    } catch {
      toast.error("Não foi possível carregar os produtos.");
    } finally {
      setCarregando(false);
    }
  };

  // Ao alterar busca ou filtro, volta para a página 1
  const aoAlterarBusca = (valor: string) => {
    setBusca(valor);
    irParaPagina(1);
  };

  const aoAlterarCategoria = (valor: string) => {
    setCategoriaSelecionada(valor as "TODAS" | CategoriaProduto);
    irParaPagina(1);
  };

  useEffect(() => {
    carregarProdutos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, busca, categoriaSelecionada]);

  // A filtragem é feita no servidor — exibe a lista recebida diretamente
  const produtosFiltrados = produtos;

  const aoSalvarProduto = async (dados: FormProduto) => {
    const resultado = produtoEditando
      ? await atualizarProduto(produtoEditando.id, dados)
      : await criarProduto(dados);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return resultado;
    }

    toast.success(
      produtoEditando ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!"
    );

    setProdutoEditando(null);
    await carregarProdutos();

    return resultado;
  };

  const aoAbrirNovoProduto = () => {
    setProdutoEditando(null);
    setModalNovoProdutoAberto(true);
  };

  const aoEditarProduto = (produto: ProdutoTabela) => {
    setProdutoEditando(produto);
    setModalNovoProdutoAberto(true);
  };

  const aoConfirmarExclusao = async () => {
    if (!produtoParaExcluir) return;

    const resultado = await excluirProduto(produtoParaExcluir.id);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return;
    }

    toast.success("Produto excluido com sucesso!");
    setProdutoParaExcluir(null);
    await carregarProdutos();
  };

  const aoFecharModalProduto = () => {
    setModalNovoProdutoAberto(false);
    setProdutoEditando(null);
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-foreground">Estoque & Produtos</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Gerencie catalogo, custos, precos e alertas de estoque minimo.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card className="border-border bg-card p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(evento) => aoAlterarBusca(evento.target.value)}
                    placeholder="Buscar por nome ou codigo de barras"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={categoriaSelecionada}
                  onValueChange={aoAlterarCategoria}
                >
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <SelectValue placeholder="Filtrar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as Categorias</SelectItem>
                    {categoriasProduto.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {mapaCategoriaRotulo[categoria]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={aoAbrirNovoProduto}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preco de Venda</TableHead>
                      <TableHead>Estoque Atual</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
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
                          <TableCell className="font-medium text-foreground">{produto.nome}</TableCell>
                          <TableCell>{mapaCategoriaRotulo[produto.categoria]}</TableCell>
                          <TableCell>{formatarMoeda(produto.custo)}</TableCell>
                          <TableCell>{formatarMoeda(produto.precoVenda)}</TableCell>
                          <TableCell>
                            <Badge variant={estoqueBaixo ? "destructive" : "outline"}>
                              {produto.quantidadeEstoque}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => aoEditarProduto(produto)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setProdutoParaExcluir(produto)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!carregando && produtosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum produto encontrado para os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}

                    {carregando && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
          </div>
        </div>
      </div>

      <ModalNovoProduto
        aberto={modalNovoProdutoAberto}
        aoFechar={aoFecharModalProduto}
        produtoInicial={
          produtoEditando
            ? {
                ...produtoEditando,
                codigoBarras: produtoEditando.codigoBarras ?? undefined,
                imagemUrl: produtoEditando.imagemUrl ?? undefined,
                descricao: produtoEditando.descricao ?? undefined,
              }
            : null
        }
        aoSalvar={aoSalvarProduto}
      />

      <AlertDialog
        open={Boolean(produtoParaExcluir)}
        onOpenChange={(aberto) => {
          if (!aberto) setProdutoParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita e removera o produto do estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aoConfirmarExclusao}>Excluir Produto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
