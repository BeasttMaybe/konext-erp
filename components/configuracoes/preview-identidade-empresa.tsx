"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ConfiguracaoEmpresaDocumentos } from "@/lib/configuracoes-documentos";
import { cn } from "@/lib/utils";
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
  completa: { rotulo: "Configuração completa", classe: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  parcial: { rotulo: "Configuração parcial", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  pendente: { rotulo: "Configuração pendente", classe: "bg-slate-100 text-slate-700 border-slate-200" },
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

  useEffect(() => {
    setFalhaLogo(false);
  }, [resumo.logoUrl]);

  const status = mapaStatus[resumo.status];

  return (
    <Card id={id} className="border-border bg-background">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
        </div>
        <Badge variant="outline" className={cn("border", status.classe)}>
          {status.rotulo}
        </Badge>
      </div>

      <div className={cn("rounded-xl border border-dashed border-border/80 bg-slate-50/70 p-4", compacta ? "" : "md:p-5") }>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
            {resumo.logoUrl && !falhaLogo ? (
              <img
                src={resumo.logoUrl}
                alt={`Logo ${resumo.nomeExibicao}`}
                className="h-full w-full object-contain p-2"
                onError={() => setFalhaLogo(true)}
              />
            ) : (
              <div className="px-3 text-center text-xs font-medium text-muted-foreground">
                Logo não configurada
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-semibold leading-tight text-foreground">{resumo.nomeExibicao}</p>
            <p className="text-sm text-muted-foreground">{resumo.razaoSocial}</p>
            <p className="text-sm text-foreground">{resumo.cnpj}</p>
            <p className="text-sm text-foreground">{resumo.telefone}</p>
            <p className="text-sm text-foreground">{resumo.cidadeUf}</p>
            <p className="text-sm text-muted-foreground">{resumo.endereco}</p>
          </div>
        </div>

        {mostrarMensagemCupom && (
          <div className="mt-4 rounded-lg border border-border bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mensagem do cupom / recibo
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {resumo.mensagemCupom || "Mensagem padrão ainda não configurada."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}