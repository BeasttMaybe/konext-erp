import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Landmark, Scale } from "lucide-react";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { GraficoFluxoCaixa } from "@/components/financeiro/grafico-fluxo-caixa";
import { obterVisaoGeralFinanceiro } from "@/app/actions/financeiro-hub";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function formatarDiasAtraso(dias: number): string {
  if (dias <= 0) return "Vence em breve";
  if (dias === 1) return "1 dia em atraso";
  return `${dias} dias em atraso`;
}

/**
 * Visão geral do Financeiro (Fase 3-2D, Parte 1) — referência:
 * docs/design/referencia-financeiro-visao-geral.html. Substitui o antigo
 * "Centro de Comando Financeiro" (só uma grade de atalhos) por indicadores
 * de verdade + a navegação única do módulo (ver NavFinanceiro).
 */
export default async function FinanceiroPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  const dados = await obterVisaoGeralFinanceiro();
  const totalAtencao = dados.precisaDeAtencao.length;
  const maiorCategoria = [...dados.saidasPorCategoria].sort((a, b) => b.valor - a.valor);
  const maiorForma = [...dados.entradasPorForma].sort((a, b) => b.valor - a.valor);
  const maiorValorBarras = Math.max(1, ...maiorCategoria.map((c) => c.valor), ...maiorForma.map((f) => f.valor));

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Visão geral do mês</span>
          <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Financeiro</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 rounded-kx-botao px-4 text-sm font-bold">Novo lançamento</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/financeiro/receber">Nova conta a receber</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/financeiro/pagar">Nova despesa</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <NavFinanceiro />

      {/* min-[1400px], nao xl (1280px): com 4 colunas a essa largura o valor
          de "-R$ 1.993,48" nao cabe numa linha (transborda ~25px, medido) —
          precisa de mais fôlego que o breakpoint padrão do Tailwind dá. */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <CartaoIndicador
          variante="primaria"
          titulo="Saldo em caixa hoje"
          valor={formatarMoeda(dados.saldoEmCaixa.valor)}
          icone={<Landmark />}
          descricao={dados.saldoEmCaixa.caixaAberto ? "Caixa da loja (sessão aberta)" : "Nenhum caixa aberto agora"}
        />
        <CartaoIndicador
          variante="sucesso"
          titulo="A receber"
          valor={formatarMoeda(dados.receberEmAberto.total)}
          icone={<ArrowUpRight />}
          descricao={
            dados.receberEmAberto.atrasado > 0 ? (
              <span className="text-kx-alerta">{formatarMoeda(dados.receberEmAberto.atrasado)} em atraso</span>
            ) : (
              "Nada em atraso"
            )
          }
        />
        <CartaoIndicador
          variante="erro"
          titulo="A pagar"
          valor={formatarMoeda(dados.pagarEmAberto.total)}
          icone={<ArrowDownRight />}
          descricao={
            dados.pagarEmAberto.atrasado > 0 ? (
              <span className="text-kx-erro">{formatarMoeda(dados.pagarEmAberto.atrasado)} em atraso</span>
            ) : (
              "Nada em atraso"
            )
          }
        />
        <CartaoIndicador
          variante={dados.resultadoDoMes.resultado >= 0 ? "sucesso" : "erro"}
          titulo="Resultado do mês"
          valor={formatarMoeda(dados.resultadoDoMes.resultado)}
          icone={<Scale />}
          descricao={`Entradas ${formatarMoeda(dados.resultadoDoMes.entradas)} · saídas ${formatarMoeda(dados.resultadoDoMes.saidas)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr] xl:items-start">
        <div className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold text-kx-texto">Fluxo de caixa</p>
              <p className="text-xs text-kx-legenda">Realizado até hoje e projeção pelos vencimentos, semana a semana</p>
            </div>
          </div>

          {/* Altura fixa, nao mais flex-1 preso a uma coluna de viewport: o
              ResponsiveContainer do recharts (height="100%") precisa de um
              pai com altura definida pra ter onde desenhar. */}
          <div className="h-[280px]">
            <GraficoFluxoCaixa semanas={dados.fluxoSemanal} />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-kx-painel-borda pt-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-kx-texto">Saídas por categoria</p>
              {maiorCategoria.length === 0 && <p className="text-xs text-kx-legenda">Nenhuma saída paga este mês.</p>}
              {maiorCategoria.map((categoria) => (
                <div key={categoria.nome} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-kx-texto-2">{categoria.nome}</span>
                    <span className="font-semibold tabular-nums text-kx-texto">{formatarMoeda(categoria.valor)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-kx-superficie">
                    <div
                      className="h-1.5 rounded-full bg-kx-erro"
                      style={{ width: `${Math.max(4, (categoria.valor / maiorValorBarras) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-kx-texto">Entradas por forma</p>
              {maiorForma.length === 0 && <p className="text-xs text-kx-legenda">Nenhuma venda este mês.</p>}
              {maiorForma.map((forma) => (
                <div key={forma.nome} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-kx-texto-2">{forma.nome}</span>
                    <span className="font-semibold tabular-nums text-kx-texto">{formatarMoeda(forma.valor)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-kx-superficie">
                    <div
                      className="h-1.5 rounded-full bg-kx-sucesso"
                      style={{ width: `${Math.max(4, (forma.valor / maiorValorBarras) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-bold text-kx-texto">Precisa de atenção</p>
              {totalAtencao > 0 && (
                <span className="rounded-kx-pilula bg-kx-erro-fundo px-2.5 py-1 text-xs font-bold text-kx-erro-texto">
                  {totalAtencao} {totalAtencao === 1 ? "item" : "itens"}
                </span>
              )}
            </div>
            <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
              {totalAtencao === 0 && <p className="text-sm text-kx-legenda">Nada vencido ou vencendo nos próximos 7 dias.</p>}
              {dados.precisaDeAtencao.map((item) => (
                <Link
                  key={`${item.tipo}-${item.id}`}
                  href={item.tipo === "receber" ? "/financeiro/receber" : "/financeiro/pagar"}
                  className="flex items-center gap-3 rounded-kx-botao px-2.5 py-2 transition-colors hover:bg-kx-superficie"
                >
                  <span
                    className={
                      item.tipo === "receber"
                        ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-kx-botao bg-kx-sucesso-fundo text-kx-sucesso-texto"
                        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-kx-botao bg-kx-erro-fundo text-kx-erro-texto"
                    }
                  >
                    {item.tipo === "receber" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-kx-texto">{item.titulo}</span>
                    <span className={`block text-xs ${item.diasAtraso > 0 ? "text-kx-erro" : "text-kx-legenda"}`}>
                      {formatarDiasAtraso(item.diasAtraso)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-kx-texto">{formatarMoeda(item.valor)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <p className="text-base font-bold text-kx-texto">Atalhos</p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-10 justify-center rounded-kx-botao text-xs font-semibold">
                <Link href="/financeiro/receber">Registrar entrada</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 justify-center rounded-kx-botao text-xs font-semibold">
                <Link href="/financeiro/pagar">Registrar despesa</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 justify-center rounded-kx-botao text-xs font-semibold">
                <Link href="/pdv/caixa">Fechar o caixa</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 justify-center rounded-kx-botao text-xs font-semibold">
                <Link href="/financeiro/fluxo">Ver relatórios</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
