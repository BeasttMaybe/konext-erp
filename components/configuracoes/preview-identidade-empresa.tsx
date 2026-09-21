"use client";

import { useState } from "react";
import { PilulaStatus } from "@/components/ui/pilula-status";
import type { ConfiguracaoEmpresaDocumentos } from "@/lib/configuracoes-documentos";
import { montarResumoEmpresaDocumentos } from "@/lib/configuracoes-documentos";

type PreviewIdentidadeEmpresaProps = {
  configuracao: Partial<ConfiguracaoEmpresaDocumentos>;
  titulo: string;
  descricao: string;
  id?: string;
  mostrarMensagemCupom?: boolean;
  compacta?: boolean;
};

const mapaStatus = {
  completa: { rotulo: "Configuração completa", variante: "sucesso" },
  parcial: { rotulo: "Configuração parcial", variante: "alerta" },
  pendente: { rotulo: "Configuração pendente", variante: "neutro" },
} as const;

export function PreviewIdentidadeEmpresa({
  configuracao,
  titulo,
  descricao,
  id,
  mostrarMensagemCupom = false,
  compacta = false,
}: PreviewIdentidadeEmpresaProps) {
  const resumo = montarResumoEmpresaDocumentos(configuracao);
  const [falhaLogo, setFalhaLogo] = useState(false);
  const [ultimaLogoUrl, setUltimaLogoUrl] = useState(resumo.logoUrl);

  // Reseta a falha de carregamento quando a URL muda — ajuste de estado
  // durante a renderização (padrão recomendado pelo React), não em efeito,
  // pra não causar um ciclo extra de render.
  if (resumo.logoUrl !== ultimaLogoUrl) {
    setUltimaLogoUrl(resumo.logoUrl);
    setFalhaLogo(false);
  }

  const status = mapaStatus[resumo.status];

  return (
    <div id={id} className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-bold text-kx-texto">{titulo}</p>
          <p className="mt-1 text-xs text-kx-legenda">{descricao}</p>
        </div>
        <PilulaStatus variante={status.variante}>{status.rotulo}</PilulaStatus>
      </div>

      <div className={`rounded-kx-botao border border-dashed border-kx-campo-borda bg-kx-superficie p-4 ${compacta ? "" : "md:p-5"}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao border border-kx-painel-borda bg-kx-painel">
            {resumo.logoUrl && !falhaLogo ? (
              <img
                src={resumo.logoUrl}
                alt={`Logo ${resumo.nomeExibicao}`}
                className="h-full w-full object-contain p-2"
                onError={() => setFalhaLogo(true)}
              />
            ) : (
              <div className="px-3 text-center text-xs font-medium text-kx-legenda">
                Logo não configurada
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-bold leading-tight text-kx-texto">{resumo.nomeExibicao}</p>
            <p className="text-sm text-kx-legenda">{resumo.razaoSocial}</p>
            <p className="text-sm text-kx-texto-2">{resumo.cnpj}</p>
            <p className="text-sm text-kx-texto-2">{resumo.telefone}</p>
            <p className="text-sm text-kx-texto-2">{resumo.cidadeUf}</p>
            <p className="text-sm text-kx-legenda">{resumo.endereco}</p>
          </div>
        </div>

        {mostrarMensagemCupom && (
          <div className="mt-4 rounded-kx-botao border border-kx-painel-borda bg-kx-painel p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">
              Mensagem do cupom / recibo
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-kx-texto-2">
              {resumo.mensagemCupom || "Mensagem padrão ainda não configurada."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}