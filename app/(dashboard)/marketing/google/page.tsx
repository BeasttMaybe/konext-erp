import type { ComponentType } from "react";
import Link from "next/link";
import { Eye, MessageSquare, MousePointerClick, Navigation, Phone, Plug, Star } from "lucide-react";

import { obterAvaliacoesGoogle, obterMetricasGoogle } from "@/app/actions/marketing";
import { GraficoDesempenhoGoogle } from "@/components/marketing/grafico-desempenho-google";
import { ListaAvaliacoesGoogle } from "@/components/marketing/lista-avaliacoes-google";
import { OtimizarDescricaoGoogle } from "@/components/marketing/otimizar-descricao-google";

export const metadata = { title: "Perfil do Google | Marketing | TechOS" };

const numero = (n: number) => n.toLocaleString("pt-BR");

function Indicador({
  rotulo,
  valor,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  icone: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-kx-legenda">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </span>
      <span className="text-2xl font-extrabold text-kx-texto">{valor}</span>
    </div>
  );
}

function AvisoConectar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
        <Plug className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-bold text-kx-texto">{titulo}</p>
      <p className="max-w-md text-sm text-kx-legenda">{texto}</p>
      <Link
        href="/marketing/conexoes"
        className="rounded-kx-botao bg-kx-primaria px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        Ir para Conexões
      </Link>
    </div>
  );
}

export default async function GooglePerfilPage() {
  const [metricas, avaliacoes] = await Promise.all([obterMetricasGoogle(30), obterAvaliacoesGoogle("TODAS")]);

  const precisaChave =
    (!metricas.ok && metricas.motivo === "SEM_CHAVE") || (!avaliacoes.ok && avaliacoes.motivo === "SEM_CHAVE");
  const precisaConta =
    (!metricas.ok && metricas.motivo === "SEM_CONTA") || (!avaliacoes.ok && avaliacoes.motivo === "SEM_CONTA");

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Perfil do Google</h1>
        <p className="text-sm text-kx-legenda">Como a loja aparece no Google — últimos 30 dias (o Google atualiza com 2 a 3 dias de atraso).</p>
      </div>

      {precisaChave ? (
        <AvisoConectar
          titulo="Conecte a Zernio para ver o Perfil do Google"
          texto="O ERP lê as métricas e as avaliações do seu Perfil do Google pela Zernio. Conecte a sua chave em Conexões."
        />
      ) : precisaConta ? (
        <AvisoConectar
          titulo="Ligue o Perfil do Google na Zernio"
          texto="A Zernio está conectada, mas o Perfil da Empresa no Google ainda não aparece entre as contas. Ligue-o em zernio.com e volte aqui."
        />
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
            {metricas.ok ? (
              <>
                <Indicador rotulo="Visualizações" valor={numero(metricas.metricas.totais.impressoes)} icone={Eye} />
                <Indicador rotulo="Ligações" valor={numero(metricas.metricas.totais.ligacoes)} icone={Phone} />
                <Indicador rotulo="Rotas" valor={numero(metricas.metricas.totais.rotas)} icone={Navigation} />
                <Indicador rotulo="Cliques no site" valor={numero(metricas.metricas.totais.cliquesSite)} icone={MousePointerClick} />
              </>
            ) : null}
            {avaliacoes.ok && avaliacoes.resumo ? (
              <>
                <Indicador rotulo="Avaliações" valor={numero(avaliacoes.resumo.total)} icone={MessageSquare} />
                <Indicador rotulo="Nota média" valor={avaliacoes.resumo.media.toFixed(1).replace(".", ",")} icone={Star} />
              </>
            ) : null}
          </div>

          {/* Gráficos de desempenho */}
          <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <h2 className="text-[15px] font-bold text-kx-texto">Desempenho</h2>
            {metricas.ok ? (
              <GraficoDesempenhoGoogle porDia={metricas.metricas.porDia} />
            ) : metricas.motivo === "SEM_ANALYTICS" ? (
              <p className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">{metricas.erro}</p>
            ) : (
              <p className="text-sm text-kx-legenda">{metricas.erro}</p>
            )}
          </div>

          {/* Otimizar a ficha (IA → aplicar) */}
          <OtimizarDescricaoGoogle />

          {/* Avaliações */}
          <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-kx-texto">Avaliações</h2>
              <span className="text-xs text-kx-legenda">Responda com um toque — a IA sugere o texto no seu tom.</span>
            </div>
            {avaliacoes.ok ? (
              <ListaAvaliacoesGoogle inicial={{ avaliacoes: avaliacoes.avaliacoes, proximoCursor: avaliacoes.proximoCursor }} />
            ) : (
              <p className="text-sm text-kx-legenda">{avaliacoes.erro}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
