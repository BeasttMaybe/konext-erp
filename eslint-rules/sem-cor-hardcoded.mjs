// Regra local (Fase 3-1, Parte 4): nenhuma cor hardcoded em app/** e
// components/** — nem hex solto, nem utilitário de cor do Tailwind fora do
// catálogo `--kx-*`/shadcn (ver app/tokens-konext.css e
// docs/design/sistema-visual.md). O ajuste é sempre no TOKEN, nunca criar
// uma exceção pontual na tela.
//
// Duas regras nesta única implementação, porque as duas olham a mesma
// coisa (literais de string — className, style inline, CSS-in-JS):
//   konext/sem-hex-hardcoded        — bane `#RGB`/`#RRGGBB`/`#RRGGBBAA` solto.
//   konext/sem-cor-tailwind-solta   — bane utilitário tipo `bg-red-500`,
//                                     `text-emerald-600` etc. — cor do
//                                     catálogo padrão do Tailwind, não dos
//                                     tokens Konext (que viram `bg-kx-*`,
//                                     `text-primary`, etc.).
//
// Escape hatch documentado: arquivos de gráfico (`components/dashboard/
// grafico-*.tsx`, `medidor.tsx`) ficam de fora via `files`/`ignores` no
// eslint.config.mjs, não aqui — cor de gráfico (`--receita`/`--despesa`/
// `--lucro`, Fase 1A) é uma família à parte, documentada, com contraste
// próprio pra marca de gráfico vs. texto.
//
// Terceira regra (correção do bug de empilhamento sobre a barra superior,
// Fase 3-2A): `konext/sem-z-index-solto` bane `z-<número>`/`z-[...]` solto —
// camada tem que vir de `--kx-z-*` (app/tokens-konext.css), senão duas
// telas voltam a brigar por número sem relação nenhuma entre si. Ver a
// ordem de camadas documentada em docs/design/sistema-visual.md.

const PADRAO_HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/;

const CORES_TAILWIND = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "grey", "zinc", "neutral", "stone", "white", "black",
];

const PREFIXOS_UTILITARIO = [
  "bg", "text", "border", "ring", "fill", "stroke", "from", "to", "via",
  "divide", "outline", "decoration", "caret", "accent", "shadow", "placeholder",
];

const PADRAO_TAILWIND_SOLTO = new RegExp(
  `\\b(?:${PREFIXOS_UTILITARIO.join("|")})-(?:${CORES_TAILWIND.join("|")})(?:-[0-9]{2,3})?\\b`
);

/**
 * Atributos JSX que carregam texto LIDO POR UMA PESSOA, nunca estilo. Cor
 * hardcoded não aparece em nenhum deles; número sim, e com `#` na frente.
 *
 * Existe porque `placeholder="Ex: Fatura #123 - Serviços de Manutenção"` era
 * acusado de cor hex hardcoded: `#123` casa com `#RGB`. As duas saídas ruins
 * eram reescrever o texto que o usuário lê para agradar um lint, ou pôr o
 * arquivo na lista de exceção e perder a regra inteira nele. A terceira é
 * esta: a regra deixa de olhar onde cor nunca mora.
 *
 * `className` e `style` continuam sendo checados, e qualquer string fora de
 * atributo JSX (CSS-in-JS, objeto de estilo, string em `.ts`) também.
 */
const ATRIBUTOS_DE_TEXTO = new Set([
  "placeholder",
  "title",
  "alt",
  "label",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "content",
  "href",
  "src",
  "pattern",
  "autoComplete",
  "id",
  "name",
  "htmlFor",
  "key",
]);

function ehTextoParaPessoa(node) {
  const pai = node.parent;
  if (!pai) return false;

  // <input placeholder="..."> — literal direto no atributo.
  if (pai.type === "JSXAttribute") {
    return ATRIBUTOS_DE_TEXTO.has(nomeDoAtributo(pai));
  }

  // <input placeholder={`...${x}`}> — dentro de template no atributo.
  const container = pai.type === "TemplateLiteral" ? pai.parent : pai;
  if (container?.type === "JSXExpressionContainer" && container.parent?.type === "JSXAttribute") {
    return ATRIBUTOS_DE_TEXTO.has(nomeDoAtributo(container.parent));
  }

  return false;
}

function nomeDoAtributo(atributo) {
  const nome = atributo.name;
  if (!nome) return "";
  return nome.type === "JSXNamespacedName" ? `${nome.namespace.name}:${nome.name.name}` : nome.name;
}

function criarRegraTexto(padrao, mensagem) {
  return {
    meta: {
      type: "problem",
      docs: { description: mensagem },
      schema: [],
    },
    create(context) {
      function checar(node, valor) {
        if (typeof valor !== "string") return;
        if (!padrao.test(valor)) return;
        if (ehTextoParaPessoa(node)) return;

        context.report({ node, message: mensagem });
      }

      return {
        Literal(node) {
          checar(node, node.value);
        },
        TemplateElement(node) {
          checar(node, node.value.raw);
        },
      };
    },
  };
}

const semHexHardcoded = criarRegraTexto(
  PADRAO_HEX,
  "Cor hex hardcoded — use um token --kx-* (app/tokens-konext.css) em vez de um valor solto."
);

const semCorTailwindSolta = criarRegraTexto(
  PADRAO_TAILWIND_SOLTO,
  "Utilitário de cor padrão do Tailwind (fora do catálogo Konext) — use bg-kx-*/text-primary/etc., nunca a paleta crua do Tailwind."
);

// `z-50`, `-z-10`, `z-[100]` — qualquer z-index numérico ou arbitrário solto.
// Não bane `z-kx-*` (o token) nem `z-auto`.
const PADRAO_Z_INDEX_SOLTO = /-?\bz-(?:\[[^\]]+\]|[0-9]+)\b/;

const semZIndexSolto = criarRegraTexto(
  PADRAO_Z_INDEX_SOLTO,
  "Z-index numérico solto — use um token z-kx-* (app/tokens-konext.css) em vez de um número sem relação com as outras camadas."
);

const konextRegrasCor = {
  rules: {
    "sem-hex-hardcoded": semHexHardcoded,
    "sem-cor-tailwind-solta": semCorTailwindSolta,
    "sem-z-index-solto": semZIndexSolto,
  },
};

export default konextRegrasCor;
