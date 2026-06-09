"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Building2,
  Landmark,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  SquarePen,
  Trash2,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModalNovoCliente } from "@/components/crm/modal-novo-cliente";
import { criarCliente, excluirCliente, listarClientesPaginado } from "@/app/actions/crm";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { FormCliente } from "@/lib/validations/crm";
import { toast } from "sonner";

const LIMITE_POR_PAGINA = 20;

// ── Skeleton de carregamento ───────────────────────────────────────────────────

function SkeletonCRM() {
  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full">
          <div className="h-9 w-48 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-72 rounded bg-slate-100 dark:bg-slate-800 animate-pulse mt-2" />
        </div>
      </div>
      <div className="flex-1 px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Cartões KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-8 w-16 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  </div>
                  <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          {/* Tabela */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="w-52 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="w-36 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4 items-center px-4 py-3 border-b border-border last:border-0"
                >
                  <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="w-28 h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="w-24 h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="w-20 h-6 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type CategoriaCliente = "CLIENTE_FINAL" | "EMPRESA" | "ORGAO_PUBLICO";

interface ClienteCadastrado {
  id: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  nomeRazaoSocial: string;
  nomeFantasia?: string;
  documento: string;
  telefone: string;
  categoria: CategoriaCliente;
}

const mapaCategoriaRotulo: Record<CategoriaCliente, string> = {
  CLIENTE_FINAL: "Cliente Final",
  EMPRESA: "Empresa",
  ORGAO_PUBLICO: "Orgao Publico",
};

const mapaCategoriaCor: Record<CategoriaCliente, string> = {
  CLIENTE_FINAL:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  EMPRESA:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
  ORGAO_PUBLICO:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
};

function normalizarTextoBusca(texto: string): string {
  return texto.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

function ConteudoCRM() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Página atual lida da URL (?page=N), com fallback para 1
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [clientes, setClientes] = useState<ClienteCadastrado[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<"TODOS" | CategoriaCliente>("TODOS");
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [deletandoClienteId, setDeletandoClienteId] = useState<string | null>(null);

  // Navega para uma página específica, preservando os demais query params
  const irParaPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(pagina));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let ativo = true;

    const carregarClientes = async () => {
      try {
        setCarregandoLista(true);
        const resultado = await listarClientesPaginado(
          currentPage,
          LIMITE_POR_PAGINA,
          termoBusca,
          filtroCategoria
        );
        if (!ativo) return;

        setClientes(
          resultado.data.map((cliente) => ({
            id: cliente.id,
            tipoPessoa: cliente.tipoPessoa,
            nomeRazaoSocial: cliente.nomeRazaoSocial,
            nomeFantasia: cliente.nomeFantasia || "",
            documento: cliente.documento,
            telefone: cliente.telefone,
            categoria: cliente.categoria,
          }))
        );
        setTotalClientes(resultado.total);
        setTotalPages(resultado.totalPages);
      } catch {
        if (!ativo) return;
        toast.error("Não foi possível carregar os clientes cadastrados.");
      } finally {
        if (ativo) setCarregandoLista(false);
      }
    };

    carregarClientes();

    return () => {
      ativo = false;
    };
  // Recarrega sempre que a página, busca ou filtro mudam
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, termoBusca, filtroCategoria]);

  // Métricas exibem o total vindo do banco (não apenas a página atual)
  const metricas = useMemo(() => ({
    totalClientes,
    totalEmpresas: clientes.filter((c) => c.categoria === "EMPRESA").length,
    totalOrgaos:   clientes.filter((c) => c.categoria === "ORGAO_PUBLICO").length,
  }), [clientes, totalClientes]);

  // Ao alterar busca ou filtro, volta para a página 1
  const aoAlterarBusca = (valor: string) => {
    setTermoBusca(valor);
    irParaPagina(1);
  };

  const aoAlterarFiltro = (valor: string) => {
    setFiltroCategoria(valor as "TODOS" | CategoriaCliente);
    irParaPagina(1);
  };

  // Filtro e busca são feitos no servidor — exibe a lista recebida diretamente
  const clientesFiltrados = clientes;

  const aoSalvarNovoCliente = async (
    dados: FormCliente
  ): Promise<{ sucesso: boolean }> => {
    const resultado = await criarCliente(dados);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return { sucesso: false };
    }

    const novoCliente: ClienteCadastrado = {
      id: resultado.cliente.id,
      tipoPessoa: resultado.cliente.tipoPessoa,
      nomeRazaoSocial: resultado.cliente.nomeRazaoSocial,
      nomeFantasia: resultado.cliente.nomeFantasia || "",
      documento: resultado.cliente.documento,
      telefone: resultado.cliente.telefone,
      categoria: resultado.cliente.categoria,
    };

    setClientes((anterior) => [novoCliente, ...anterior]);
    setModalNovoClienteAberto(false);
    toast.success("Cliente cadastrado com sucesso!");

    return { sucesso: true };
  };

  const aoExcluirCliente = async (clienteId: string) => {
    if (deletandoClienteId) return;

    setDeletandoClienteId(clienteId);

    const resultado = await excluirCliente(clienteId);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      setDeletandoClienteId(null);
      return;
    }

    setClientes((anterior) => anterior.filter((cliente) => cliente.id !== clienteId));
    toast.success(resultado.mensagem);
    setDeletandoClienteId(null);
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-foreground">CRM / Cadastros</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Gestao de clientes para varejo fisico, B2B e setor publico
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Clientes</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {totalClientes}
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Empresas B2B</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {metricas.totalEmpresas}
                    </p>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Orgaos Publicos</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {metricas.totalOrgaos}
                    </p>
                  </div>
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </div>

            <Card className="border-border bg-card p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={termoBusca}
                    onChange={(e) => aoAlterarBusca(e.target.value)}
                    placeholder="Buscar por nome, CPF/CNPJ ou telefone"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={filtroCategoria}
                  onValueChange={aoAlterarFiltro}
                >
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <SelectValue placeholder="Filtrar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todas as Categorias</SelectItem>
                    <SelectItem value="CLIENTE_FINAL">Cliente Final</SelectItem>
                    <SelectItem value="EMPRESA">Empresa</SelectItem>
                    <SelectItem value="ORGAO_PUBLICO">Orgao Publico</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={() => setModalNovoClienteAberto(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome / Razao Social</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium text-foreground">
                          {cliente.nomeRazaoSocial}
                        </TableCell>
                        <TableCell>{cliente.documento}</TableCell>
                        <TableCell>{cliente.telefone}</TableCell>
                        <TableCell>
                          <Badge className={mapaCategoriaCor[cliente.categoria]}>
                            {mapaCategoriaRotulo[cliente.categoria]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-52">
                              <DropdownMenuItem
                                onClick={() => console.log("Ver perfil", cliente.id)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  console.log("Nova OS para cliente", cliente.id)
                                }
                              >
                                <Wrench className="h-4 w-4 mr-2" />
                                Nova OS para este cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => console.log("Editar cliente", cliente.id)}
                              >
                                <SquarePen className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => aoExcluirCliente(cliente.id)}
                                disabled={deletandoClienteId === cliente.id}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!carregandoLista && clientesFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado para os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                    {carregandoLista && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Carregando clientes...
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
                disabled={carregandoLista}
              />
            </Card>
          </div>
        </div>
      </div>

      <ModalNovoCliente
        aberto={modalNovoClienteAberto}
        aoFechar={() => setModalNovoClienteAberto(false)}
        aoSalvar={aoSalvarNovoCliente}
      />
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
// useSearchParams() dentro de ConteudoCRM precisa estar dentro de <Suspense>
// para compatibilidade com renderização estática do Next.js.

export default function PaginaCRM() {
  return (
    <Suspense fallback={<SkeletonCRM />}>
      <ConteudoCRM />
    </Suspense>
  );
}
