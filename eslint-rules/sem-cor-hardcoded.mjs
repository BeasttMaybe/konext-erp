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

function criarRegraTexto(padrao, mensagem) {
  return {
    meta: {
      type: "problem",
      docs: { description: mensagem },
      schema: [],
    },
    create(context) {
      function checar(node, valor) {
        if (typeof valor === "string" && padrao.test(valor)) {
          context.report({ node, message: mensagem });
        }
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

const konextRegrasCor = {
  rules: {
    "sem-hex-hardcoded": semHexHardcoded,
    "sem-cor-tailwind-solta": semCorTailwindSolta,
  },
};

export default konextRegrasCor;
