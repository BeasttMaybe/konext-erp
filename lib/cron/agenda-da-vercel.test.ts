import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GUARDA: toda rotina agendada roda no maximo uma vez por dia.
 *
 * O projeto esta no plano Hobby da Vercel, que so aceita rotinas diarias. Uma
 * agenda mais frequente nao gera aviso: a Vercel RECUSA O BUILD INTEIRO
 * ("Hobby accounts are limited to daily cron jobs"). Foi o que aconteceu com
 * o fechamento automatico de caixa agendado de hora em hora: de 10/11 a
 * 11/11/2026 nenhum deploy entrou no ar, e nada no repositorio — tipos,
 * testes, build, CI — acusou, porque so a Vercel conhece essa regra.
 *
 * Se o plano mudar para Pro, este teste e quem deve mudar primeiro.
 */
describe("agenda das rotinas em vercel.json", () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  const rotinas = config.crons ?? [];

  it("existem rotinas para conferir", () => {
    expect(rotinas.length).toBeGreaterThanOrEqual(3);
  });

  it.each(rotinas)("$path roda uma vez por dia ($schedule)", ({ schedule }) => {
    const campos = schedule.trim().split(/\s+/);
    expect(campos).toHaveLength(5);

    const [minuto, hora] = campos;
    // Minuto e hora FIXOS: nada de "*", "*/2", "1,13" ou "8-18".
    expect(minuto).toMatch(/^\d{1,2}$/);
    expect(hora).toMatch(/^\d{1,2}$/);
  });

  it("toda rota agendada existe", () => {
    for (const { path } of rotinas) {
      const pasta = path.replace(/^\/api\//, "app/api/");
      expect(() => readFileSync(join(process.cwd(), pasta, "route.ts"))).not.toThrow();
    }
  });
});
