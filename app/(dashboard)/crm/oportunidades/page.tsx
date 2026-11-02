import { ChevronLeft, TrendingUp } from "lucide-react";
import Link from "next/link";

import { listarClientesPaginado } from "@/app/actions/crm";
import { listarOportunidades } from "@/app/actions/oportunidades";
import { FunilVendasKanban } from "@/components/crm/funil-vendas-kanban";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function PaginaOportunidades() {
  const [oportunidades, clientes] = await Promise.all([
    listarOportunidades(),
    listarClientesPaginado(1, 500, undefined, undefined, "CLIENTE"),
  ]);

  const totalAberto = oportunidades
    .filter((oportunidade) => oportunidade.estagio !== "GANHO" && oportunidade.estagio !== "PERDIDO")
    .reduce((total, oportunidade) => total + oportunidade.valor, 0);

  return (
    <div className= "min-h-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#f8fafc_50%,_#ffffff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#0f172a_100%)]">
      <div className= "border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className= "mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 xl:flex-row xl:items-end xl:justify-between">
          <div className= "space-y-2">
            <div className= "inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className= "h-3.5 w-3.5 text-kx-info" />
              CRM | Funil de Vendas
            </div>
            <div>
              <h1 className= "text-3xl font-bold tracking-tight text-foreground">Oportunidades em movimento</h1>
              <p className= "mt-2 max-w-3xl text-sm text-muted-foreground">
                Acompanhe cada negociação do primeiro contato ao fechamento, com visualização por etapa, valor e data de encerramento.
              </p>
            </div>
          </div>

          <div className= "flex flex-wrap gap-3">
            <Card className= "min-w-[180px] border-border bg-background/90 p-4 shadow-sm">
              <p className= "text-xs uppercase tracking-wide text-muted-foreground">Clientes disponíveis</p>
              <p className= "mt-1 text-2xl font-bold text-foreground">{clientes.data.length}</p>
            </Card>
            <Card className= "min-w-[180px] border-border bg-background/90 p-4 shadow-sm">
              <p className= "text-xs uppercase tracking-wide text-muted-foreground">Valor em aberto</p>
              <p className= "mt-1 text-2xl font-bold text-foreground">
                {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </Card>
            <Button asChild variant= "outline" className= "self-stretch">
              <Link href= "/crm">
                <ChevronLeft className= "mr-2 h-4 w-4" />
                Voltar ao CRM
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className= "mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <FunilVendasKanban oportunidades={oportunidades} clientes={clientes.data} />
      </div>
    </div>
  );
}
