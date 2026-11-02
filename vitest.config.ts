import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Ambiente padrao "node": a maioria dos testes daqui e de dominio puro
 * (`lib/**`) — nao sobem Next, nao tocam banco e nao precisam de variavel de
 * ambiente. Testes de componente React (`components/**\/*.test.tsx`) pedem
 * DOM de verdade pra @testing-library/react; em vez de trocar o ambiente
 * global (o que deixaria os testes de dominio mais lentos a toa), cada
 * arquivo de componente declara `// @vitest-environment jsdom` no topo —
 * ver components/pdv/balcao/lista-itens-carrinho.test.tsx.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `store/**` entrou na Fase 2A-3: o resumo do carrinho (useCartStore)
    // faz a conta que a pessoa le no balcao antes de cobrar, e o arquivo de
    // teste dele existia fora de qualquer padrao daqui — ou seja, nunca
    // rodava. Teste que nao roda e pior que teste que nao existe, porque
    // passa a impressao de cobertura.
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "store/**/*.test.ts"],
  },
});
