"use client";

import { useMemo, useState } from "react";
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
import type { FormCliente } from "@/lib/validations/crm";

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

const clientesMock: ClienteCadastrado[] = [
  {
    id: "cli-001",
    tipoPessoa: "FISICA",
    nomeRazaoSocial: "Carlos Eduardo Lima",
    documento: "123.456.789-10",
    telefone: "(11) 99111-2222",
    categoria: "CLIENTE_FINAL",
  },
  {
    id: "cli-002",
    tipoPessoa: "JURIDICA",
    nomeRazaoSocial: "Construtora Horizonte LTDA",
    nomeFantasia: "Horizonte Engenharia",
    documento: "12.345.678/0001-10",
    telefone: "(11) 3333-4444",
    categoria: "EMPRESA",
  },
  {
    id: "cli-003",
    tipoPessoa: "JURIDICA",
    nomeRazaoSocial: "Prefeitura Municipal de Itapevi",
    documento: "46.523.031/0001-28",
    telefone: "(11) 4143-7600",
    categoria: "ORGAO_PUBLICO",
  },
  {
    id: "cli-004",
    tipoPessoa: "FISICA",
    nomeRazaoSocial: "Mariana Souza Rocha",
    documento: "987.654.321-00",
    telefone: "(11) 98888-1111",
    categoria: "CLIENTE_FINAL",
  },
  {
    id: "cli-005",
    tipoPessoa: "JURIDICA",
    nomeRazaoSocial: "Distribuidora Prime Comercial SA",
    nomeFantasia: "Prime Comercial",
    documento: "33.222.111/0001-76",
    telefone: "(11) 4002-9000",
    categoria: "EMPRESA",
  },
];

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

export default function PaginaCRM() {
  const [clientes, setClientes] = useState<ClienteCadastrado[]>(clientesMock);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<"TODOS" | CategoriaCliente>(
    "TODOS"
  );
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);

  const metricas = useMemo(() => {
    return {
      totalClientes: clientes.length,
      totalEmpresas: clientes.filter((c) => c.categoria === "EMPRESA").length,
      totalOrgaos: clientes.filter((c) => c.categoria === "ORGAO_PUBLICO").length,
    };
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const buscaNormalizada = normalizarTextoBusca(termoBusca);

    return clientes.filter((cliente) => {
      const passouCategoria =
        filtroCategoria === "TODOS" || cliente.categoria === filtroCategoria;

      if (!passouCategoria) return false;

      if (!buscaNormalizada) return true;

      const campoNome = normalizarTextoBusca(cliente.nomeRazaoSocial);
      const campoDocumento = normalizarTextoBusca(cliente.documento);
      const campoTelefone = normalizarTextoBusca(cliente.telefone);

      return (
        campoNome.includes(buscaNormalizada) ||
        campoDocumento.includes(buscaNormalizada) ||
        campoTelefone.includes(buscaNormalizada)
      );
    });
  }, [clientes, termoBusca, filtroCategoria]);

  const aoSalvarNovoCliente = (dados: FormCliente) => {
    const novoCliente: ClienteCadastrado = {
      id: `cli-${Date.now()}`,
      tipoPessoa: dados.tipoPessoa,
      nomeRazaoSocial: dados.nomeRazaoSocial,
      nomeFantasia: dados.nomeFantasia || "",
      documento: dados.documento,
      telefone: dados.telefone,
      categoria: dados.categoria,
    };

    setClientes((anterior) => [novoCliente, ...anterior]);
    setModalNovoClienteAberto(false);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background">
      <div className="px-6 lg:px-8 py-6 border-b border-border bg-background">
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
                      {metricas.totalClientes}
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
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Buscar por nome, CPF/CNPJ ou telefone"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={filtroCategoria}
                  onValueChange={(valor) =>
                    setFiltroCategoria(valor as "TODOS" | CategoriaCliente)
                  }
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
                                onClick={() => console.log("Excluir cliente", cliente.id)}
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

                    {clientesFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado para os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
