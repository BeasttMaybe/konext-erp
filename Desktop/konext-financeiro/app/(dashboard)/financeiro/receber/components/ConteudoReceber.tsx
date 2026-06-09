"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ClienteBuscaCRM } from "@/app/actions/crm";
import {
  criarContaReceber,
  darBaixaConta,
  type ContaReceberFinanceiro,
} from "@/app/actions/financeiro-receber";
import { SeletorClienteCRM } from "@/components/financeiro/seletor-cliente-crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";

// ── Tipos e constantes ───────────────────────────────────────────────────────

type StatusExibicao = "PENDENTE" | "ATRASADO" | "RECEBIDO";

const FORMA_RECEBIMENTO_INICIAL: ContaReceberFinanceiro["formaRecebimento"] = "PIX";

const MAPA_FORMA_PAGAMENTO: Record<ContaReceberFinanceiro["formaRecebimento"], string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  DINHEIRO: "Dinheiro",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho Público",
};

interface FormNovaConta {
  descricao: string;
  valorTotal: string;
  qtdParcelas: string;
  dataInicio: string;
  dataVencimentoPrimeiraParcela: string;
  formaRecebimento: ContaReceberFinanceiro["formaRecebimento"];
  observacaoLancamento: string;
}

const FORM_INICIAL: FormNovaConta = {
  descricao: "",
  valorTotal: "",
  qtdParcelas: "1",
  dataInicio: format(new Date(), "yyyy-MM-dd"),
  dataVencimentoPrimeiraParcela: format(new Date(), "yyyy-MM-dd"),
  formaRecebimento: FORMA_RECEBIMENTO_INICIAL,
  observacaoLancamento: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function obterStatusExibicao(
  conta: ContaReceberFinanceiro,
  inicioDiaAtual: Date
): StatusExibicao {
  if (conta.status === "RECEBIDO") return "RECEBIDO";
  if (new Date(conta.dataVencimento) < inicioDiaAtual) return "ATRASADO";
  return "PENDENTE";
}

function badgeStatus(status: StatusExibicao) {
  if (status === "RECEBIDO") {
    return (
      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        Recebido
      </Badge>
    );
  }
  if (status === "ATRASADO") {
    return <Badge variant="destructive">Atrasado</Badge>;
  }
  return (
    <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      Pendente
    </Badge>
  );
}

// ── Componente ───────────────────────────────────────────────────────────────

interface ConteudoReceberProps {
  /** Lista de contas já filtradas, proveniente do Server Component pai. */
  contas: ContaReceberFinanceiro[];
}

/**
 * Camada interativa da página de Contas a Receber.
 * Exibe a tabela, gerencia modais de criação e baixa de contas.
 * Não faz fetching de dados — recebe tudo via props do Server Component.
 * Após cada mutação, chama router.refresh() para acionar novo render do servidor.
 */
export function ConteudoReceber({ contas }: ConteudoReceberProps) {
  const router = useRouter();

  const inicioDiaAtual = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  // ── Estado dos modais ────────────────────────────────────────────────────

  const [contaSelecionada, setContaSelecionada] = useState<ContaReceberFinanceiro | null>(null);
  const [observacaoBaixa, setObservacaoBaixa] = useState("");
  const [baixandoConta, setBaixandoConta] = useState(false);

  const [dialogNovaContaAberto, setDialogNovaContaAberto] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaCRM | null>(null);
  const [formNovaConta, setFormNovaConta] = useState<FormNovaConta>(FORM_INICIAL);

  // ── Handlers: Dar Baixa ──────────────────────────────────────────────────

  async function confirmarBaixa() {
    if (!contaSelecionada) return;
    try {
      setBaixandoConta(true);
      await darBaixaConta(contaSelecionada.id, observacaoBaixa);
      toast.success("Conta baixada com sucesso.");
      setContaSelecionada(null);
      setObservacaoBaixa("");
      router.refresh(); // Aciona novo render do Server Component com dados atualizados
    } catch {
      toast.error("Não foi possível dar baixa nesta conta.");
    } finally {
      setBaixandoConta(false);
    }
  }

  // ── Handlers: Nova Conta a Receber ───────────────────────────────────────

  function abrirNovaConta() {
    setFormNovaConta(FORM_INICIAL);
    setClienteSelecionado(null);
    setDialogNovaContaAberto(true);
  }

  async function salvarNovaConta() {
    const valorTotalNumero = Number(formNovaConta.valorTotal.replace(",", "."));
    const qtdParcelasNumero = Math.max(1, Math.trunc(Number(formNovaConta.qtdParcelas || "1")));

    if (!formNovaConta.descricao.trim()) {
      toast.error("Preencha a descrição da conta.");
      return;
    }
    if (!Number.isFinite(valorTotalNumero) || valorTotalNumero <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!clienteSelecionado) {
      toast.error("Selecione a pessoa no CRM para registrar a conta.");
      return;
    }

    try {
      setSalvandoConta(true);
      await criarContaReceber({
        descricao: formNovaConta.descricao,
        valorTotal: valorTotalNumero,
        clienteId: clienteSelecionado.id,
        qtdParcelas: qtdParcelasNumero,
        dataInicio: new Date(`${formNovaConta.dataInicio}T12:00:00`),
        dataVencimentoPrimeiraParcela: new Date(
          `${formNovaConta.dataVencimentoPrimeiraParcela}T12:00:00`
        ),
        formaRecebimento: formNovaConta.formaRecebimento,
        observacaoLancamento: formNovaConta.observacaoLancamento,
      });
      toast.success("Conta a receber registrada com sucesso.");
      setDialogNovaContaAberto(false);
      router.refresh(); // Aciona novo render do Server Component com dados atualizados
    } catch {
      toast.error("Não foi possível registrar a conta a receber.");
    } finally {
      setSalvandoConta(false);
    }
  }

  // ── Renderização ─────────────────────────────────────────────────────────

  return (
    <>
      {/* Cabeçalho da seção com botão de nova conta */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Contas</h2>
        <Button onClick={abrirNovaConta}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Tabela de contas */}
      <Card className="border-border bg-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem / Forma</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.map((conta) => {
              const statusExibicao = obterStatusExibicao(conta, inicioDiaAtual);
              const origem = conta.vendaId
                ? `Venda ${conta.vendaId.slice(0, 8)} / ${MAPA_FORMA_PAGAMENTO[conta.formaRecebimento]}`
                : MAPA_FORMA_PAGAMENTO[conta.formaRecebimento];
              const parcela =
                conta.totalParcelas > 1
                  ? `${conta.numeroParcela}/${conta.totalParcelas}`
                  : "Única";

              return (
                <TableRow key={conta.id}>
                  <TableCell className="font-medium text-foreground text-sm">{origem}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{conta.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {conta.cliente?.nomeRazaoSocial ?? "Sem cliente"}
                    </p>
                    {conta.observacaoLancamento && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Obs.: {conta.observacaoLancamento}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{parcela}</TableCell>
                  <TableCell>
                    {format(new Date(conta.dataVencimento), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="font-mono">
                    {conta.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{badgeStatus(statusExibicao)}</TableCell>
                  <TableCell className="text-right">
                    {statusExibicao !== "RECEBIDO" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Abrir ações da conta"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setContaSelecionada(conta)}>
                            Dar Baixa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {contas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma conta encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog: Dar Baixa */}
      <Dialog
        open={Boolean(contaSelecionada)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setContaSelecionada(null);
            setObservacaoBaixa("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dar Baixa na Conta</DialogTitle>
            <DialogDescription>
              Registre observações do recebimento para manter histórico financeiro completo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">Descrição:</span> {contaSelecionada?.descricao}
              </p>
              <p>
                <span className="font-medium">Parcela:</span>{" "}
                {contaSelecionada
                  ? contaSelecionada.totalParcelas > 1
                    ? `${contaSelecionada.numeroParcela}/${contaSelecionada.totalParcelas}`
                    : "Única"
                  : "—"}
              </p>
              <p>
                <span className="font-medium">Valor:</span>{" "}
                {contaSelecionada
                  ? contaSelecionada.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : "—"}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="obs-baixa">Observações do Pagamento</Label>
              <Textarea
                id="obs-baixa"
                placeholder="Ex: Recebido via PIX com comprovante enviado pelo cliente"
                value={observacaoBaixa}
                onChange={(e) => setObservacaoBaixa(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setContaSelecionada(null);
                setObservacaoBaixa("");
              }}
              disabled={baixandoConta}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarBaixa} disabled={baixandoConta}>
              {baixandoConta ? "Confirmando..." : "Confirmar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Conta a Receber */}
      <Dialog open={dialogNovaContaAberto} onOpenChange={setDialogNovaContaAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
            <DialogDescription>Registre um título avulso a receber.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <SeletorClienteCRM
              label="Devedor"
              clienteSelecionado={clienteSelecionado}
              onSelecionarCliente={setClienteSelecionado}
              onLimparCliente={() => setClienteSelecionado(null)}
            />

            <div className="space-y-1">
              <Label htmlFor="descricao-conta">Descrição</Label>
              <Input
                id="descricao-conta"
                placeholder="Ex: Serviço de consultoria"
                value={formNovaConta.descricao}
                onChange={(e) =>
                  setFormNovaConta((prev) => ({ ...prev, descricao: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="valor-conta">Valor Total (R$)</Label>
              <Input
                id="valor-conta"
                placeholder="0,00"
                value={formNovaConta.valorTotal}
                onChange={(e) =>
                  setFormNovaConta((prev) => ({ ...prev, valorTotal: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="parcelas-conta">Quantidade de Parcelas</Label>
              <Input
                id="parcelas-conta"
                type="number"
                min={1}
                value={formNovaConta.qtdParcelas}
                onChange={(e) =>
                  setFormNovaConta((prev) => ({ ...prev, qtdParcelas: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inicio-conta">Data de Início</Label>
                <Input
                  id="inicio-conta"
                  type="date"
                  value={formNovaConta.dataInicio}
                  onChange={(e) =>
                    setFormNovaConta((prev) => ({ ...prev, dataInicio: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="vencimento-conta">Primeiro Vencimento</Label>
                <Input
                  id="vencimento-conta"
                  type="date"
                  value={formNovaConta.dataVencimentoPrimeiraParcela}
                  onChange={(e) =>
                    setFormNovaConta((prev) => ({
                      ...prev,
                      dataVencimentoPrimeiraParcela: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="forma-recebimento">Forma de Recebimento</Label>
              <Select
                value={formNovaConta.formaRecebimento}
                onValueChange={(v) =>
                  setFormNovaConta((prev) => ({
                    ...prev,
                    formaRecebimento: v as ContaReceberFinanceiro["formaRecebimento"],
                  }))
                }
              >
                <SelectTrigger id="forma-recebimento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CREDIARIO">Crediário</SelectItem>
                  <SelectItem value="EMPENHO_PUBLICO">Empenho Público</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="obs-lancamento">Observações do Lançamento</Label>
              <Textarea
                id="obs-lancamento"
                placeholder="Ex: Parcelamento negociado em contrato mensal"
                value={formNovaConta.observacaoLancamento}
                onChange={(e) =>
                  setFormNovaConta((prev) => ({ ...prev, observacaoLancamento: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogNovaContaAberto(false)}
              disabled={salvandoConta}
            >
              Cancelar
            </Button>
            <Button onClick={salvarNovaConta} disabled={salvandoConta}>
              {salvandoConta ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
