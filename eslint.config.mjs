import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import konextRegrasCor from "./eslint-rules/sem-cor-hardcoded.mjs";
import konextRegrasDatas from "./eslint-rules/datas-fronteira-fora-do-modulo.mjs";
import konextRegrasDinheiro from "./eslint-rules/dinheiro-fora-do-modulo.mjs";

/**
 * Telas grandfathered da Fase 3-1, Parte 4 (regra `konext/sem-*`): tinham
 * cor hardcoded ANTES desta fase e ainda não foram restiladas — isso é
 * trabalho da Fase 3-2, tela por tela, não desta fase (que só cobre a
 * fundação + o shell). Lista gerada rodando a regra em modo "error" contra
 * `app/**`/`components/**` sem esta exclusão e coletando quem falhou — ver
 * a tabela completa em docs/design/sistema-visual.md. Tirar um arquivo
 * daqui (porque a Fase 3-2 já o restilou) é o critério de "terminou aquela
 * tela"; a lista só deve encolher.
 */
/**
 * Telas que ainda nao passaram pelo design system e por isso ficam fora das
 * regras de cor.
 *
 * ESTA LISTA ESTA VAZIA desde 02/11/2026, e e para continuar assim: todo
 * arquivo de `app/**`, `components/**` e `lib/**` usa os tokens. Ela comecou
 * o dia com 59 arquivos.
 *
 * Nao adicione nada aqui para "fazer o lint passar". Adicionar um arquivo a
 * esta lista desliga a regra de cor nele INTEIRO, inclusive para o proximo
 * que mexer no arquivo — foi assim que um mapa de cor de status com oito
 * matizes crus do Tailwind sobreviveu em `lib/dominio` sem ninguem notar. Se
 * uma cor nova nao encontra token, o caminho e criar o token (ver a familia
 * `--kx-info`, nascida assim) ou usar a familia semantica que corresponde.
 */
const ARQUIVOS_COM_COR_LEGADA = [];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `lib/**` entrou em 02/11/2026: a regra cobria so app/** e components/**, e
  // o resultado foi um mapa de cor de status (CLASSES_STATUS_OS, 8 status x 3
  // strings de Tailwind cru) morando em lib/dominio/os/maquina-estados.ts, fora
  // do alcance dela, parecendo fonte de verdade. Cor nao deixa de ser cor por
  // estar numa pasta de dominio.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    // Teste nao renderiza nada, e um teste de cor precisa conter cor: o
    // contraste-feedback.test.ts afirma sobre `#000000`/`#ffffff` de proposito,
    // e o validacao-imei.test.ts usa "123#456" como IMEI invalido, que nem e
    // cor. Por isso ficam fora, e nao na lista de cor legada — que significa
    // outra coisa (tela antiga ainda por converter).
    // `lib/design/papel.ts` e o UNICO lugar autorizado a escrever os valores
    // da paleta de papel em TypeScript, pela mesma razao que `lib/dinheiro.ts`
    // e o unico a fazer aritmetica de centavo: o PDF e montado por
    // @react-pdf/renderer, que nao resolve variavel CSS. `papel.test.ts` le o
    // CSS de verdade e falha se os dois divergirem.
    ignores: [
      ...ARQUIVOS_COM_COR_LEGADA,
      "lib/design/papel.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    plugins: { konext: konextRegrasCor },
    rules: {
      "konext/sem-hex-hardcoded": "error",
      "konext/sem-cor-tailwind-solta": "error",
    },
  },
  // Regra de z-index (Fase 3-2A): nasce sem lista de exceção — a auditoria
  // que corrigiu o bug de empilhamento sobre a barra superior já limpou
  // toda ocorrência solta em app/**/components/**, então qualquer violação
  // daqui pra frente é regressão nova, não legado.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    plugins: { konext: konextRegrasCor },
    rules: {
      "konext/sem-z-index-solto": "error",
    },
  },
  // Regras de fronteira de data (Fase 2A-1): setHours(0/date-fns puro/
  // CURRENT_DATE em SQL raw só são permitidos dentro de lib/datas.ts — o
  // único módulo autorizado a calcular "hoje"/fronteira de dia/semana/mês no
  // fuso da loja. Nasce sem lista de exceção: a Fase 2A-1 já substituiu toda
  // ocorrência encontrada em app/**, components/** e lib/** por lib/datas.ts,
  // então qualquer violação daqui pra frente é regressão nova.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.mjs"],
    ignores: ["lib/datas.ts"],
    plugins: { "konext-datas": konextRegrasDatas },
    rules: {
      "konext-datas/sem-set-hours-fronteira-fora-do-modulo": "error",
      "konext-datas/sem-date-fns-fronteira-fora-do-modulo": "error",
      "konext-datas/sem-current-date-sql-fora-do-modulo": "error",
    },
  },
  // Regras de dinheiro (Fase 2A-2): Decimal#toNumber()/parseFloat/toFixed
  // monetário só são permitidos dentro de lib/dinheiro.ts — o único módulo
  // autorizado a fazer aritmética/conversão/formatação de dinheiro. Nasce
  // sem lista de exceção: a Fase 2A-2 já substituiu toda ocorrência
  // encontrada por lib/dinheiro.ts, então qualquer violação daqui pra
  // frente é regressão nova.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.mjs"],
    ignores: ["lib/dinheiro.ts"],
    plugins: { "konext-dinheiro": konextRegrasDinheiro },
    rules: {
      "konext-dinheiro/sem-to-number-decimal-fora-do-modulo": "error",
      "konext-dinheiro/sem-parse-float-dinheiro-fora-do-modulo": "error",
      "konext-dinheiro/sem-to-fixed-dinheiro-fora-do-modulo": "error",
    },
  },
  // Fonte da marca (02/11/2026): `next/font/google` baixa o arquivo da fonte
  // em tempo de BUILD. Isso derrubou o build tres vezes no mesmo dia com
  // `module-not-found`, sem nenhuma mudanca de codigo entre as tentativas — e
  // o deploy da Vercel faz o mesmo download, entao nao era chateacao de CI:
  // era um deploy que podia falhar por causa de servico de terceiro. A fonte
  // agora e versionada em `app/fontes/` e carregada por `next/font/local`.
  // Ver `app/fontes/LEIA-ME.md`.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/font/google",
              message:
                "Baixa a fonte em tempo de build e ja derrubou o deploy. Use next/font/local com o arquivo em app/fontes/ — ver app/fontes/LEIA-ME.md.",
            },
          ],
        },
      ],
    },
  },
  // Scripts CommonJS de apoio (scripts/dev/local). O de preparo do driver
  // PRECISA ser CommonJS: e carregado por `node --require`, que nao aceita
  // modulo ES. A regra que proibe `require()` existe para o codigo do
  // sistema, que e todo ESM.
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
