import { Clock } from "lucide-react";

import type { HorarioSlot } from "@/lib/zernio/cliente";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MelhorHorario({ slots }: { slots: HorarioSlot[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-kx-legenda" aria-hidden />
        <h2 className="text-[15px] font-bold text-kx-texto">Melhores horários para postar</h2>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-kx-legenda">
          Ainda sem dados suficientes. Conforme você publicar mais, os horários com melhor engajamento aparecem aqui.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((s, i) => (
            <span
              key={`${s.diaSemana}-${s.hora}-${i}`}
              className="flex items-center gap-1.5 rounded-kx-pilula bg-kx-superficie px-3 py-1.5 text-sm text-kx-texto"
            >
              <span className="font-bold">{DIAS[s.diaSemana] ?? "?"}</span>
              <span className="text-kx-texto-2">{String(s.hora).padStart(2, "0")}h</span>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-kx-legenda">Baseado no engajamento dos seus posts recentes.</p>
    </div>
  );
}
