const CORES = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  alerta: "border-alerta/30 bg-alerta/10 text-alerta",
  erro: "border-erro/30 bg-erro/10 text-erro",
  neutro: "border-borda bg-fundo text-texto-2",
} as const;

export function Selo({ tom, children }: { tom: keyof typeof CORES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${CORES[tom]}`}>{children}</span>;
}

export function tomDoStatus(status: string | null): keyof typeof CORES {
  if (status === "ATIVA" || status === "ATIVO") return "ok";
  if (status === "SUSPENSA" || status === "SUSPENSO" || status === "PROVISIONANDO") return "alerta";
  if (status === "INATIVA") return "erro";
  return "neutro";
}
