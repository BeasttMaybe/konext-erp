import { describe, expect, it } from "vitest";
import type { StatusOS } from "@prisma/client";

import { CLASSES_POR_ETAPA, classesDoStatusOS } from "./cores-etapa";
import { paraEstagio } from "./etapas";

const TODOS_OS_STATUS: StatusOS[] = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "GARANTIA_RETORNO",
  "PRONTO",
  "ENTREGUE",
];

describe("lib/dominio/os/cores-etapa", () => {
  it("todo status resolve para alguma etapa, sem buraco", () => {
    for (const status of TODOS_OS_STATUS) {
      expect(classesDoStatusOS(status), status).toBeDefined();
      expect(classesDoStatusOS(status).chip, status).toContain("kx-");
    }
  });

  it("só usa token do design system, nunca cor crua do Tailwind", () => {
    // O mapa que isto substituiu (CLASSES_STATUS_OS) usava sky, cyan, amber,
    // orange, violet, indigo, emerald e rose. O eslint não cobria aquele
    // arquivo; este teste cobre, e não depende de configuração nenhuma.
    const corCrua =
      /\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|emerald|green|sky|blue|indigo|violet|purple|rose|red|amber|yellow|orange|teal|cyan|white|black)(?:-\d{2,3})?\b/;

    for (const [etapa, classes] of Object.entries(CLASSES_POR_ETAPA)) {
      expect(classes.chip, `${etapa}.chip`).not.toMatch(corCrua);
      expect(classes.indicador, `${etapa}.indicador`).not.toMatch(corCrua);
    }
  });

  it("status da mesma etapa recebem a MESMA cor", () => {
    // É o ponto do mapa ser por etapa: aguardando peça e em manutenção são os
    // dois "conserto", então o quadro não pode pintá-los de cores diferentes
    // como se fossem pontos distintos do fluxo.
    expect(classesDoStatusOS("AGUARDANDO_PECA")).toEqual(classesDoStatusOS("EM_MANUTENCAO"));
    expect(classesDoStatusOS("APROVADO")).toEqual(classesDoStatusOS("GARANTIA_RETORNO"));
    expect(classesDoStatusOS("AGUARDANDO_ORCAMENTO")).toEqual(
      classesDoStatusOS("AGUARDANDO_APROVACAO")
    );
  });

  it("etapas diferentes recebem cores diferentes", () => {
    const chips = Object.values(CLASSES_POR_ETAPA).map((c) => c.chip);
    expect(new Set(chips).size).toBe(chips.length);
  });

  it("a cor acompanha a etapa que paraEstagio() decide", () => {
    // Se amanhã um status mudar de etapa em etapas.ts, a cor segue sozinha —
    // é o que evita os dois mapas divergirem com o tempo.
    for (const status of TODOS_OS_STATUS) {
      const etapa = paraEstagio(status).etapa;
      expect(classesDoStatusOS(status)).toBe(CLASSES_POR_ETAPA[etapa]);
    }
  });
});
