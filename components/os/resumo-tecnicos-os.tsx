"use client";

import type { TecnicoDaOS } from "@/types/os";

/** Duas letras a partir de um nome completo — reaproveitado pelo avatar de cliente do cartão de OS. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

type PropsResumoTecnicosOS = {
  tecnicos: TecnicoDaOS[];
  className?: string;
};

/** Avatar do técnico principal (iniciais) + "+N" quando há outros — usado no card do Kanban e no detalhe da OS. */
export function ResumoTecnicosOS({ tecnicos, className }: PropsResumoTecnicosOS) {
  if (tecnicos.length === 0) {
    return null;
  }

  const principal = tecnicos.find((tecnico) => tecnico.principal) ?? tecnicos[0];
  const outros = tecnicos.length - 1;

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`} title={tecnicos.map((t) => t.nome).join(", ")}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
        {iniciais(principal.nome)}
      </span>
      {outros > 0 && (
        <span className="flex h-6 items-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          +{outros}
        </span>
      )}
    </div>
  );
}
