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
    <Card className="p-4 border border-kx-painel-borda bg-kx-painel">
      <p className="text-sm text-kx-legenda">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${destaqueClasse || "text-kx-texto"}`}>
        {valor}
      </p>
      {descricao && (
        <p className="text-xs text-kx-legenda mt-1">{descricao}</p>
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
        destaqueClasse="text-kx-link"
      />
      <Cartao
        titulo="Concluídas"
        valor={String(dados.concluidas)}
        destaqueClasse="text-kx-sucesso-icone"
      />
      <Cartao
        titulo="Atrasadas"
        valor={String(dados.atrasadas)}
        destaqueClasse={dados.atrasadas > 0 ? "text-kx-erro-texto" : "text-kx-texto"}
      />
      <Cartao
        titulo="Em atenção"
        valor={String(dados.emAtencao)}
        destaqueClasse={dados.emAtencao > 0 ? "text-kx-alerta-icone" : "text-kx-texto"}
      />
      <Cartao
        titulo="Automáticas com erro"
        valor={String(dados.automaticasComErroSincronizacao)}
        destaqueClasse={
          dados.automaticasComErroSincronizacao > 0
            ? "text-kx-erro-texto"
            : "text-kx-texto"
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
        destaqueClasse="text-kx-sucesso-icone"
      />
    </div>
  );
}
