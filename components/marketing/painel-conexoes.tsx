"use client";

import { useState } from "react";
import { CheckCircle2, Info, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { iniciarConexao, type SituacaoDaPlataforma } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BADGE: Record<SituacaoDaPlataforma["status"], { rotulo: string; classe: string }> = {
  CONECTADA: { rotulo: "Conectada", classe: "bg-kx-sucesso-fundo text-kx-sucesso-texto" },
  DESCONECTADA: { rotulo: "Pronta para conectar", classe: "bg-kx-info-fundo text-kx-info-texto" },
  NAO_CONFIGURADA: { rotulo: "Falta configurar", classe: "bg-kx-alerta-fundo text-kx-alerta-texto" },
  EXPIRADA: { rotulo: "Expirada", classe: "bg-kx-alerta-fundo text-kx-alerta-texto" },
  ERRO: { rotulo: "Com erro", classe: "bg-kx-erro-fundo text-kx-erro-texto" },
};

export function PainelConexoes({ conexoes }: { conexoes: SituacaoDaPlataforma[] }) {
  const [ocupada, setOcupada] = useState<string | null>(null);

  const conectar = async (id: string) => {
    setOcupada(id);
    try {
      const r = await iniciarConexao(id);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.erro);
    } finally {
      setOcupada(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Conexões</h1>
      </div>

      <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-4 py-3 text-sm text-kx-texto-2">
        Cada plataforma precisa de uma conta de desenvolvedor criada e aprovada por ela antes de conectar — isso é feito uma vez. Abaixo,
        o que já está pronto e o que falta. Assim que uma plataforma estiver liberada, a conexão é por login seguro, sem senha passar pelo
        sistema.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {conexoes.map((c) => {
          const badge = BADGE[c.status];
          return (
            <div key={c.id} className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-kx-texto">{c.nome}</span>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                    {c.organico ? <span className="rounded-kx-pilula bg-kx-superficie px-2 py-0.5 text-kx-texto-2">Posts</span> : null}
                    {c.anuncios ? <span className="rounded-kx-pilula bg-kx-superficie px-2 py-0.5 text-kx-texto-2">Anúncios</span> : null}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-kx-pilula px-2.5 py-1 text-[11px] font-bold", badge.classe)}>{badge.rotulo}</span>
              </div>

              {c.status === "CONECTADA" && c.contaNome ? (
                <p className="flex items-center gap-2 text-sm text-kx-sucesso-texto">
                  <CheckCircle2 className="h-4 w-4" /> Conectada como {c.contaNome}
                </p>
              ) : (
                <p className="flex items-start gap-2 text-xs text-kx-legenda">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {c.pronta
                    ? "O app desta plataforma já está configurado. Clique em Conectar para ligar a conta da loja."
                    : c.preRequisito}
                </p>
              )}

              {c.ultimoErro ? <p className="text-xs text-kx-erro-texto">{c.ultimoErro}</p> : null}

              <div>
                <Button
                  type="button"
                  variant={c.pronta ? "default" : "outline"}
                  size="sm"
                  disabled={!c.pronta || ocupada === c.id}
                  onClick={() => void conectar(c.id)}
                >
                  {ocupada === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plug className="h-3.5 w-3.5" />}
                  {c.status === "CONECTADA" ? "Reconectar" : "Conectar"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
