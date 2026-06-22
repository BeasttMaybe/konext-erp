"use client";

import { Card } from "@/components/ui/card";
import type { DashboardMetasResult } from "@/app/actions/metas";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

type CartaoProps = {
  titulo: string;
  valor: string;
  descricao?: string;
  destaqueClasse?: string;
};

function Cartao({ titulo, valor, descricao, destaqueClasse = "" }: CartaoProps) {
  return (
    <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${destaqueClasse || "text-slate-900 dark:text-slate-50"}`}>
        {valor}
      </p>
      {descricao && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{descricao}</p>
      )}
    </Card>
  );
}

export function DashboardMetas({ dados }: { dados: DashboardMetasResult }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      <Cartao titulo="Total de metas" valor={String(dados.totalMetas)} />
      <Cartao titulo="Metas manuais" valor={String(dados.metasManuais)} />
      <Cartao titulo="Metas automáticas" valor={String(dados.metasAutomaticas)} />
      <Cartao
        titulo="Em andamento"
        valor={String(dados.emAndamento)}
        destaqueClasse="text-blue-600 dark:text-blue-400"
      />
      <Cartao
        titulo="Concluídas"
        valor={String(dados.concluidas)}
        destaqueClasse="text-emerald-600 dark:text-emerald-400"
      />
      <Cartao
        titulo="Atrasadas"
        valor={String(dados.atrasadas)}
        destaqueClasse={dados.atrasadas > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-50"}
      />
      <Cartao
        titulo="Em atenção"
        valor={String(dados.emAtencao)}
        destaqueClasse={dados.emAtencao > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-slate-900 dark:text-slate-50"}
      />
      <Cartao
        titulo="Automáticas com erro"
        valor={String(dados.automaticasComErroSincronizacao)}
        destaqueClasse={
          dados.automaticasComErroSincronizacao > 0
            ? "text-red-600 dark:text-red-400"
            : "text-slate-900 dark:text-slate-50"
        }
      />
      <Cartao titulo="Pausadas" valor={String(dados.pausadas)} />
      <Cartao
        titulo="Valor total planejado"
        valor={formatarMoeda(dados.valorTotalPlanejado)}
        descricao="Metas financeiras"
      />
      <Cartao
        titulo="Valor já alcançado"
        valor={formatarMoeda(dados.valorAlcancado)}
        descricao="Metas financeiras"
        destaqueClasse="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  );
}
