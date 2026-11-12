import { describe, expect, it } from "vitest";

import {
  aparelhoDaOS,
  contarPorFiltro,
  diasParada,
  lerVisaoDaOS,
  montarLista,
  proximaOrdenacao,
  tecnicoPrincipal,
  type OSDaLista,
} from "./lista-de-os";

const AGORA = new Date("2026-11-12T15:00:00-03:00");

function os(parcial: Partial<OSDaLista> & Pick<OSDaLista, "numeroOS">): OSDaLista {
  return {
    id: parcial.numeroOS,
    nomeCliente: "Cliente",
    equipamento: "Smartphone",
    etapa: "ORCAMENTO",
    ehRetornoGarantia: false,
    totalOrcamento: 0,
    dataCriacao: "2026-11-10T12:00:00-03:00",
    dataAtualizacao: "2026-11-12T09:00:00-03:00",
    tecnicos: [],
    ...parcial,
  };
}

const ORDENS = [
  os({ numeroOS: "OS-2026-009", etapa: "ORCAMENTO", nomeCliente: "Bruna", totalOrcamento: 300 }),
  os({ numeroOS: "OS-2026-010", etapa: "CONSERTO", nomeCliente: "ana", totalOrcamento: 1200, dataAtualizacao: "2026-11-01T10:00:00-03:00" }),
  os({ numeroOS: "OS-2026-011", etapa: "PRONTO", nomeCliente: "Carlos", totalOrcamento: 80 }),
  os({ numeroOS: "OS-2026-012", etapa: "CONSERTO", nomeCliente: "Davi", ehRetornoGarantia: true }),
];

describe("contarPorFiltro", () => {
  it("conta cada etapa, a garantia a parte, e o total", () => {
    expect(contarPorFiltro(ORDENS)).toEqual({ TODAS: 4, ORCAMENTO: 1, CONSERTO: 2, PRONTO: 1, ENTREGUE: 0, GARANTIA: 1 });
  });
});

describe("montarLista", () => {
  const base = { filtro: "TODAS", coluna: "numero", direcao: "desc", agora: AGORA } as const;
  const numeros = (lista: OSDaLista[]) => lista.map((item) => item.numeroOS.slice(-3));

  it("filtra por etapa", () => {
    expect(numeros(montarLista(ORDENS, { ...base, filtro: "CONSERTO" }))).toEqual(["012", "010"]);
  });

  it("garantia isola os retornos, em qualquer etapa", () => {
    expect(numeros(montarLista(ORDENS, { ...base, filtro: "GARANTIA" }))).toEqual(["012"]);
  });

  it("ordena numero como numero (010 depois de 009)", () => {
    expect(numeros(montarLista(ORDENS, { ...base, direcao: "asc" }))).toEqual(["009", "010", "011", "012"]);
  });

  it("ordena cliente sem diferenciar maiuscula", () => {
    expect(montarLista(ORDENS, { ...base, coluna: "cliente", direcao: "asc" }).map((item) => item.nomeCliente)).toEqual([
      "ana",
      "Bruna",
      "Carlos",
      "Davi",
    ]);
  });

  it("ordena por valor e por dias parada", () => {
    expect(numeros(montarLista(ORDENS, { ...base, coluna: "valor" }))[0]).toBe("010");
    expect(numeros(montarLista(ORDENS, { ...base, coluna: "parada" }))[0]).toBe("010");
  });

  it("nao altera a lista recebida", () => {
    const copia = [...ORDENS];
    montarLista(ORDENS, { ...base, direcao: "asc" });
    expect(ORDENS).toEqual(copia);
  });
});

describe("diasParada", () => {
  it("conta dias de calendario no fuso da loja", () => {
    expect(diasParada({ dataAtualizacao: "2026-11-11T23:30:00-03:00" }, AGORA)).toBe(1);
    expect(diasParada({ dataAtualizacao: "2026-11-12T00:10:00-03:00" }, AGORA)).toBe(0);
    expect(diasParada({ dataAtualizacao: "2026-11-01T10:00:00-03:00" }, AGORA)).toBe(11);
  });

  it("nunca negativo, mesmo com relogio adiantado", () => {
    expect(diasParada({ dataAtualizacao: "2026-11-13T10:00:00-03:00" }, AGORA)).toBe(0);
  });
});

describe("auxiliares", () => {
  it("proximaOrdenacao inverte a mesma coluna e escolhe a direcao natural da nova", () => {
    expect(proximaOrdenacao({ coluna: "numero", direcao: "desc" }, "numero")).toEqual({ coluna: "numero", direcao: "asc" });
    expect(proximaOrdenacao({ coluna: "numero", direcao: "desc" }, "cliente")).toEqual({ coluna: "cliente", direcao: "asc" });
    expect(proximaOrdenacao({ coluna: "cliente", direcao: "asc" }, "valor")).toEqual({ coluna: "valor", direcao: "desc" });
  });

  it("aparelho prefere marca e modelo; tecnico prefere o principal", () => {
    expect(aparelhoDaOS({ equipamento: "Smartphone", marca: "Apple", modelo: "iPhone 13" })).toBe("Apple iPhone 13");
    expect(aparelhoDaOS({ equipamento: "Tablet" })).toBe("Tablet");
    expect(tecnicoPrincipal({ tecnicos: [{ nome: "Ana", principal: false }, { nome: "Rui", principal: true }] })).toBe("Rui");
    expect(tecnicoPrincipal({ tecnicos: [] })).toBeNull();
  });

  it("visao: so 'lista' abre a lista; qualquer outra coisa e o quadro", () => {
    expect(lerVisaoDaOS("lista")).toBe("lista");
    expect(lerVisaoDaOS(undefined)).toBe("quadro");
    expect(lerVisaoDaOS("<script>")).toBe("quadro");
  });
});
