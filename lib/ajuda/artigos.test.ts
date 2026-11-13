import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ARTIGOS_AJUDA, artigoPeloSlug, buscarArtigos, CATEGORIAS_AJUDA } from "./artigos";

const raiz = path.resolve(__dirname, "../..");

/** Uma rota existe se ha um page.tsx no caminho, dentro de algum grupo (pasta entre parenteses) ou nao. */
function rotaExiste(href: string): boolean {
  const caminho = href.split("?")[0].replace(/^\//, "");
  const grupos = ["", "(dashboard)", "(printer)"];
  return grupos.some((grupo) => existsSync(path.join(raiz, "app", grupo, caminho, "page.tsx")));
}

describe("guias da ajuda", () => {
  it("cada guia tem slug unico, categoria conhecida e ao menos um passo", () => {
    const slugs = ARTIGOS_AJUDA.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const artigo of ARTIGOS_AJUDA) {
      expect(CATEGORIAS_AJUDA).toContain(artigo.categoria);
      expect(artigo.secoes.flatMap((s) => s.passos).length, artigo.slug).toBeGreaterThan(0);
      expect(artigo.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("todo 'Ir para a tela' leva a uma tela que existe", () => {
    for (const artigo of ARTIGOS_AJUDA) {
      if (artigo.destino) expect(rotaExiste(artigo.destino.href), `${artigo.slug} -> ${artigo.destino.href}`).toBe(true);
    }
  });

  it("toda categoria tem guia", () => {
    for (const categoria of CATEGORIAS_AJUDA) {
      expect(ARTIGOS_AJUDA.some((a) => a.categoria === categoria), categoria).toBe(true);
    }
  });
});

describe("buscarArtigos", () => {
  it("acha sem acento e por palavra-chave", () => {
    expect(buscarArtigos("orcamento").map((a) => a.slug)).toContain("abrir-os");
    expect(buscarArtigos("kanban").map((a) => a.slug)).toContain("acompanhar-os");
    expect(buscarArtigos("funcionario")[0]?.slug).toBe("novo-usuario");
  });

  it("exige todas as palavras e prioriza o titulo", () => {
    expect(buscarArtigos("assinatura")[0]?.slug).toBe("minha-assinatura");
    expect(buscarArtigos("xml nota").map((a) => a.slug)).toEqual(["entrada-de-nota"]);
    expect(buscarArtigos("palavrainexistente")).toEqual([]);
  });

  it("busca vazia devolve tudo", () => {
    expect(buscarArtigos(" ")).toHaveLength(ARTIGOS_AJUDA.length);
  });

  it("acha o guia pelo slug", () => {
    expect(artigoPeloSlug("trocar-senha")?.titulo).toBe("Trocar a minha senha");
    expect(artigoPeloSlug("nao-existe")).toBeUndefined();
  });
});
