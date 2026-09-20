import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import konextRegrasCor from "./eslint-rules/sem-cor-hardcoded.mjs";

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
const ARQUIVOS_COM_COR_LEGADA = [
  "app/(auth)/layout.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/login/recuperar/page.tsx",
  "app/(dashboard)/configuracoes/page.tsx",
  "app/(dashboard)/crm/contatos/page.tsx",
  "app/(dashboard)/crm/oportunidades/page.tsx",
  "app/(dashboard)/crm/page.tsx",
  "app/(dashboard)/crm/propostas/nova/page.tsx",
  "app/(dashboard)/crm/propostas/page.tsx",
  "app/(dashboard)/crm/propostas/\\[id\\]/page.tsx",
  "app/(dashboard)/estoque/page.tsx",
  "app/(dashboard)/financeiro/inteligencia/page.tsx",
  "app/(dashboard)/financeiro/pagar/components/ConteudoPagar.tsx",
  "app/(dashboard)/financeiro/pagar/page.tsx",
  "app/(dashboard)/financeiro/receber/components/ConteudoReceber.tsx",
  "app/(dashboard)/financeiro/receber/page.tsx",
  "app/(dashboard)/inicio/page.tsx",
  "app/(dashboard)/metas/page.tsx",
  "app/(dashboard)/os/page.tsx",
  "app/(dashboard)/pdv/page.tsx",
  "app/(dashboard)/perfil/page.tsx",
  "app/(dashboard)/vendas/historico/page.tsx",
  "app/(dashboard)/vendas/page.tsx",
  "app/(printer)/os/\\[id\\]/garantia/page.tsx",
  "app/(printer)/recibo/\\[id\\]/page.tsx",
  "app/rastreio/\\[id\\]/page.tsx",
  "components/configuracoes/layout-configuracoes.tsx",
  "components/configuracoes/menu-configuracoes.tsx",
  "components/configuracoes/painel-documentos.tsx",
  "components/configuracoes/painel-empresa.tsx",
  "components/configuracoes/painel-os.tsx",
  "components/configuracoes/painel-pdv.tsx",
  "components/configuracoes/preview-identidade-empresa.tsx",
  "components/configuracoes/usuarios/aba-usuarios.tsx",
  "components/crm/funil-vendas-kanban.tsx",
  "components/crm/proposal-actions-cell.tsx",
  "components/estoque/modal-novo-produto.tsx",
  "components/financeiro/cartao-kpi-financeiro.tsx",
  "components/financeiro/modal-nova-conta-a-pagar.tsx",
  "components/financeiro/modal-novo-recebimento.tsx",
  "components/financeiro/modal-registro-cobranca.tsx",
  "components/financeiro/notas-fiscais/pagina-notas-fiscais.tsx",
  "components/financeiro/seletor-cliente-crm.tsx",
  "components/financeiro/sheet-historico-fechamentos.tsx",
  "components/financeiro/tabela-contas-a-pagar.tsx",
  "components/layout/sino-notificacoes.tsx",
  "components/metas/badge-prioridade-meta.tsx",
  "components/metas/badge-status-meta.tsx",
  "components/metas/barra-progresso-meta.tsx",
  "components/metas/checklist-meta.tsx",
  "components/metas/dashboard-metas.tsx",
  "components/metas/detalhe-meta-cliente.tsx",
  "components/metas/filtros-metas.tsx",
  "components/metas/historico-meta.tsx",
  "components/metas/modal-atualizar-progresso.tsx",
  "components/metas/modal-nova-meta.tsx",
  "components/metas/pagina-metas.tsx",
  "components/metas/card-meta.tsx",
  "components/os/coluna-kanban.tsx",
  "components/os/garantias/acao-garantia-os.tsx",
  "components/os/garantias/modal-registrar-retorno.tsx",
  "components/os/garantias/termo-garantia-documento.tsx",
  "components/os/impressao/estilos-impressao.ts",
  "components/os/impressao/os-impressao-a4.tsx",
  "components/os/modal-entregar-sem-servico.tsx",
  "components/os/modal-finalizar-os.tsx",
  "components/os/modal-finalizar-retorno-garantia.tsx",
  "components/os/modal-reabrir-os.tsx",
  "components/pdf/PropostaPDF.tsx",
  "components/pdf/proposta-pdf-viewer.tsx",
  "components/pdv/modal-pagamento.tsx",
  "components/vendas/new-sales-order-wizard.tsx",
  "components/vendas/sales-history-order-sheet.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ARQUIVOS_COM_COR_LEGADA,
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
