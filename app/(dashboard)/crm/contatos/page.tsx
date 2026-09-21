"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  SquarePen,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ModalNovoCliente } from "@/components/crm/modal-novo-cliente";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesPaginado,
} from "@/app/actions/crm";
import type { FormCliente } from "@/lib/validations/crm";
import { useTemPermissao } from "@/contextos/contexto-permissoes";

const PAGE_SIZE = 20;

type ClientCategory = "CLIENTE_FINAL" | "EMPRESA" | "ORGAO_PUBLICO";
type ViewMode = "CLIENTES" | "FORNECEDORES";

interface ClientRecord {
  id: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  papel: "CLIENTE" | "FORNECEDOR";
  nomeRazaoSocial: string;
  nomeFantasia?: string;
  documento: string;
  inscricaoEstadual?: string;
  email?: string;
  telefone: string;
  isWhatsapp?: boolean;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  categoria: ClientCategory;
  observacoes?: string;
}

const categoryLabelMap: Record<ClientCategory, string> = {
  CLIENTE_FINAL: "Cliente final",
  EMPRESA: "Fornecedor / Empresa",
  ORGAO_PUBLICO: "Órgão público",
};

const categoryColorMap: Record<ClientCategory, string> = {
  CLIENTE_FINAL:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  EMPRESA:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
  ORGAO_PUBLICO:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
};

function mapClientRecord(client: {
  id: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  papel: "CLIENTE" | "FORNECEDOR";
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
  inscricaoEstadual: string | null;
  email: string | null;
  telefone: string;
  isWhatsapp: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  categoria: ClientCategory;
  observacoes: string | null;
}): ClientRecord {
  return {
    id: client.id,
    tipoPessoa: client.tipoPessoa,
    papel: client.papel,
    nomeRazaoSocial: client.nomeRazaoSocial,
    nomeFantasia: client.nomeFantasia || "",
    documento: client.documento,
    inscricaoEstadual: client.inscricaoEstadual || "",
    email: client.email || "",
    telefone: client.telefone,
    isWhatsapp: client.isWhatsapp,
    cep: client.cep || "",
    logradouro: client.logradouro || "",
    numero: client.numero || "",
    bairro: client.bairro || "",
    cidade: client.cidade || "",
    estado: client.estado || "",
    categoria: client.categoria,
    observacoes: client.observacoes || "",
  };
}

function SkeletonContacts() {
  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="h-9 w-64 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-96 rounded bg-slate-100 dark:bg-slate-800 animate-pulse mt-2" />
        </div>
      </div>
      <div className="px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-8 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="h-6 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-80 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [viewMode, setViewMode] = useState<ViewMode>("CLIENTES");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    clientes: 0,
    fornecedores: 0,
    empresas: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [isListLoading, setIsListLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"TODOS" | ClientCategory>("TODOS");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [profileClient, setProfileClient] = useState<ClientRecord | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientRecord | null>(null);
  const podeExcluirCliente = useTemPermissao("crm.excluir");

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let mounted = true;

    const loadClients = async () => {
      try {
        setIsListLoading(true);

        const paperFilter = viewMode === "CLIENTES" ? "CLIENTE" : "FORNECEDOR";

        const result = await listarClientesPaginado(
          currentPage,
          PAGE_SIZE,
          searchTerm,
          categoryFilter,
          paperFilter
        );

        if (!mounted) return;

        setClients(result.data.map(mapClientRecord));
        setSummary(result.resumo);
        setTotalPages(result.totalPages);
      } catch {
        if (!mounted) return;
        toast.error("Não foi possível carregar os contatos cadastrados.");
      } finally {
        if (mounted) setIsListLoading(false);
      }
    };

    loadClients();

    return () => {
      mounted = false;
    };
  }, [currentPage, searchTerm, categoryFilter, viewMode, reloadToken]);

  const currentViewLabel = viewMode === "CLIENTES" ? "Clientes" : "Fornecedores";
  const currentViewIcon = viewMode === "CLIENTES" ? Users : Building2;
  const ViewIcon = currentViewIcon;

  const totalBusiness = summary.empresas;

  const initialClientData = useMemo(
    () =>
      editingClient
        ? {
            tipoPessoa: editingClient.tipoPessoa,
            papel: editingClient.papel,
            nomeRazaoSocial: editingClient.nomeRazaoSocial,
            nomeFantasia: editingClient.nomeFantasia ?? "",
            documento: editingClient.documento,
            inscricaoEstadual: editingClient.inscricaoEstadual ?? "",
            email: editingClient.email ?? "",
            telefone: editingClient.telefone,
            isWhatsapp: editingClient.isWhatsapp ?? true,
            cep: editingClient.cep ?? "",
            logradouro: editingClient.logradouro ?? "",
            numero: editingClient.numero ?? "",
            bairro: editingClient.bairro ?? "",
            cidade: editingClient.cidade ?? "",
            estado: editingClient.estado ?? "",
            categoria: editingClient.categoria,
            observacoes: editingClient.observacoes ?? "",
          }
        : {
            tipoPessoa: "JURIDICA" as const,
            papel: viewMode === "FORNECEDORES" ? ("FORNECEDOR" as const) : ("CLIENTE" as const),
            categoria: viewMode === "FORNECEDORES" ? ("EMPRESA" as const) : ("CLIENTE_FINAL" as const),
            isWhatsapp: true,
          },
    [editingClient, viewMode]
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    goToPage(1);
  };

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value as "TODOS" | ClientCategory);
    goToPage(1);
  };

  const handleSaveClient = async (data: FormCliente): Promise<{ sucesso: boolean }> => {
    if (editingClient) {
      const result = await atualizarCliente(editingClient.id, data);

      if (!result.sucesso) {
        toast.error(result.mensagem);
        return { sucesso: false };
      }

      setEditingClient(null);
      setIsClientModalOpen(false);
      setReloadToken((previous) => previous + 1);
      toast.success("Contato atualizado com sucesso!");
      return { sucesso: true };
    }

    const result = await criarCliente(data);

    if (!result.sucesso) {
      toast.error(result.mensagem);
      return { sucesso: false };
    }

    setIsClientModalOpen(false);
    setReloadToken((previous) => previous + 1);
    toast.success("Contato cadastrado com sucesso!");

    return { sucesso: true };
  };

  const handleDeleteClient = async (clientId: string) => {
    if (deletingClientId) return;

    setDeletingClientId(clientId);

    const result = await excluirCliente(clientId);

    if (!result.sucesso) {
      toast.error(result.mensagem);
      setDeletingClientId(null);
      return;
    }

    setDeletingClientId(null);
    setClientToDelete(null);
    setReloadToken((previous) => previous + 1);

    toast.success("Contato excluído com sucesso!");
  };

  const openNewContact = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const openPlaceholderAction = (message: string) => {
    toast.info(message, {
      description: "Este fluxo será integrado em uma próxima etapa do CRM.",
    });
  };

  const renderContactsTable = (params: {
    titulo: string;
    descricao: string;
    botaoLabel: string;
  }) => (
    <Card className="border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{params.titulo}</h2>
          <p className="text-sm text-muted-foreground mt-1">{params.descricao}</p>
        </div>
        <Button onClick={openNewContact}>
          <UserPlus className="h-4 w-4 mr-2" />
          {params.botaoLabel}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ ou telefone"
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
          <SelectTrigger className="w-full lg:w-[220px]">
            <SelectValue placeholder="Filtrar categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas as categorias</SelectItem>
            <SelectItem value="CLIENTE_FINAL">Cliente final</SelectItem>
            <SelectItem value="EMPRESA">Fornecedor / Empresa</SelectItem>
            <SelectItem value="ORGAO_PUBLICO">Órgão público</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Razão social</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium text-foreground">{client.nomeRazaoSocial}</TableCell>
                <TableCell>{client.documento}</TableCell>
                <TableCell>{client.telefone}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {client.papel === "FORNECEDOR" ? "Fornecedor" : "Cliente"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={categoryColorMap[client.categoria]}>
                    {categoryLabelMap[client.categoria]}
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
                      <DropdownMenuItem onClick={() => setProfileClient(client)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/os?clienteId=${client.id}`)}>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Nova OS para este contato
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingClient(client);
                          setIsClientModalOpen(true);
                        }}
                      >
                        <SquarePen className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {podeExcluirCliente ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setClientToDelete(client)}
                            disabled={deletingClientId === client.id}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {!isListLoading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado para os filtros atuais.
                </TableCell>
              </TableRow>
            )}

            {isListLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando contatos...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        disabled={isListLoading}
      />
    </Card>
  );

  const renderMainContent = () => {
    if (viewMode === "FORNECEDORES") {
      return renderContactsTable({
        titulo: "Lista de Fornecedores",
        descricao: "Use este painel para localizar, editar e excluir fornecedores já cadastrados.",
        botaoLabel: "Novo Fornecedor",
      });
    }

    return renderContactsTable({
      titulo: "Lista de Clientes",
      descricao: "Use este painel para localizar, editar e excluir contatos já cadastrados.",
      botaoLabel: "Novo Cliente",
    });
  };

  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM | Contatos & Fornecedores</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Área dedicada para gerenciar a base de relacionamentos sem interferir no hub principal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/crm") }>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Hub
            </Button>
            <Button onClick={openNewContact}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contato
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Contatos Ativos</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{summary.total}</p>
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Fornecedores</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{summary.fornecedores}</p>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Empresas B2B</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{totalBusiness}</p>
                  </div>
                  <Filter className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Modo Atual</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{currentViewLabel}</p>
                  </div>
                  <ViewIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-5 border-border bg-card">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Papel de cadastro</h2>
                    <Badge variant="secondary" className="text-xs">
                      Cliente ou fornecedor
                    </Badge>
                  </div>

                  <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("CLIENTES");
                        goToPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        viewMode === "CLIENTES"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Clientes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("FORNECEDORES");
                        goToPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        viewMode === "FORNECEDORES"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Fornecedores
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground">Registro com distinção visual</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O formulário usa a mesma base do CRM e permite registrar o contato com perfil de cliente ou fornecedor.
                    </p>
                  </div>
                </Card>

                {renderMainContent()}
              </div>

              <div className="space-y-4">
                <Card className="p-5 border-border bg-card sticky top-4">
                  <h2 className="text-lg font-semibold text-foreground mb-3">Ações Rápidas</h2>
                  <div className="space-y-2">
                    <Button className="w-full justify-start" onClick={openNewContact}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Novo Contato
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => openPlaceholderAction("Nova oportunidade em preparação")}
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Nova Oportunidade
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => openPlaceholderAction("Nova tarefa em preparação")}
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Nova Tarefa
                    </Button>
                  </div>

                  <div className="mt-4 rounded-lg border border-dashed border-border p-3 bg-muted/30">
                    <p className="text-sm font-medium text-foreground">Fluxo dedicado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta página abre separadamente para concentrar o trabalho de contatos e fornecedores.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
      </div>

      <ModalNovoCliente
        aberto={isClientModalOpen}
        aoFechar={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        aoSalvar={handleSaveClient}
        dadosIniciais={initialClientData}
      />

      <Dialog
        open={Boolean(profileClient)}
        onOpenChange={(open) => {
          if (!open) setProfileClient(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Perfil do Contato</DialogTitle>
            <DialogDescription>Informações cadastrais resumidas.</DialogDescription>
          </DialogHeader>

          {profileClient && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm py-1">
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome / Razão social</dt>
                <dd className="mt-0.5 font-medium text-foreground">{profileClient.nomeRazaoSocial}</dd>
              </div>
              {profileClient.nomeFantasia && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome fantasia</dt>
                  <dd className="mt-0.5 text-foreground">{profileClient.nomeFantasia}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</dt>
                <dd className="mt-0.5 text-foreground">{profileClient.documento}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telefone</dt>
                <dd className="mt-0.5 text-foreground">{profileClient.telefone}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfil</dt>
                <dd className="mt-0.5">
                  <Badge variant="outline">{profileClient.papel === "FORNECEDOR" ? "Fornecedor" : "Cliente"}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${categoryColorMap[profileClient.categoria]}`}>
                    {categoryLabelMap[profileClient.categoria]}
                  </span>
                </dd>
              </div>
            </dl>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileClient(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setEditingClient(profileClient);
                setProfileClient(null);
                setIsClientModalOpen(true);
              }}
            >
              <SquarePen className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(clientToDelete)}
        onOpenChange={(open) => {
          if (!open) setClientToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold">{clientToDelete?.nomeRazaoSocial}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingClientId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingClientId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clientToDelete && handleDeleteClient(clientToDelete.id)}
            >
              {deletingClientId ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<SkeletonContacts />}>
      <ContactsPageContent />
    </Suspense>
  );
}
