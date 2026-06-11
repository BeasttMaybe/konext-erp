"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SheetHistoricoFechamentos } from "@/components/financeiro/sheet-historico-fechamentos";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

interface CartaoHistoricoFechamentosProps {
  faturamentoCaixaFechadoHoje: number;
}

export function BotaoAtualizarFinanceiro() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const atualizar = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button variant="outline" onClick={atualizar} disabled={isPending}>
      <RefreshCcw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
      Atualizar
    </Button>
  );
}

export function CartaoHistoricoFechamentos({
  faturamentoCaixaFechadoHoje,
}: CartaoHistoricoFechamentosProps) {
  const [sheetHistoricoAberto, setSheetHistoricoAberto] = useState(false);

  return (
    <>
      <Card
        className="border-amber-200/60 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20 cursor-pointer hover:ring-2 hover:ring-amber-400/50 hover:shadow-md transition-all"
        onClick={() => setSheetHistoricoAberto(true)}
        title="Clique para ver o histórico de fechamentos"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-amber-700 dark:text-amber-300">Faturamento (Caixa Fechado)</p>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-2">
              {formatarMoeda(faturamentoCaixaFechadoHoje)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Ver histórico →
            </p>
          </div>
          <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-300" />
        </div>
      </Card>

      <SheetHistoricoFechamentos
        aberto={sheetHistoricoAberto}
        aoFechar={() => setSheetHistoricoAberto(false)}
      />
    </>
  );
}
