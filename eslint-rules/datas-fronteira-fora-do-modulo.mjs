// Regra local (Fase 2A-1): fronteira de dia/semana/mês e "agora" pra lógica
// de negócio só pode ser calculada em lib/datas.ts — o módulo que resolve
// tudo isso no fuso horário da LOJA (Configuracao.fusoHorario), nunca no
// fuso do processo (a Vercel roda em UTC; a loja fica em America/Sao_Paulo
// por padrão — usar o relógio/fuso cru do processo pra decidir um limite de
// dia/mês dá resultado errado entre 21h e 23:59 no horário da loja).
//
// Três regras nesta única implementação, uma por primitiva que o bug usava:
//   konext/sem-set-hours-fronteira-fora-do-modulo
//     — bane `algumaData.setHours(0, ...)` fora de lib/datas.ts. `setHours`
//       é sempre relativo ao fuso do PROCESSO (ou, no navegador, ao fuso do
//       dispositivo) — nunca ao da loja.
//   konext/sem-date-fns-fronteira-fora-do-modulo
//     — bane importar `startOfDay`/`startOfWeek`/`startOfMonth`/`endOfDay`/
//       `endOfMonth` direto de `date-fns` fora de lib/datas.ts. Usadas sem
//       `@date-fns/tz` (`TZDate`), essas funções também calculam no fuso do
//       processo.
//   konext/sem-current-date-sql-fora-do-modulo
//     — bane `CURRENT_DATE`/`CURRENT_TIMESTAMP` em SQL raw (`$queryRaw`/
//       string/template literal) fora de lib/datas.ts. Essas expressões
//       calculam no fuso da SESSÃO do Postgres, não no da loja.
//
// `lib/datas.ts` fica isento das três (é o único lugar autorizado a usar
// essas primitivas) via `ignores` no eslint.config.mjs, mesmo padrão de
// `eslint-rules/sem-cor-hardcoded.mjs`.

const FUNCOES_DATE_FNS_BANIDAS = new Set([
  "startOfDay",
  "startOfWeek",
  "startOfMonth",
  "endOfDay",
  "endOfMonth",
]);

const PADRAO_CURRENT_DATE_SQL = /\bCURRENT_DATE\b|\bCURRENT_TIMESTAMP\b/i;

function ehChamadaSetHoursZero(node) {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "setHours" &&
    node.arguments.length > 0 &&
    node.arguments[0].type === "Literal" &&
    node.arguments[0].value === 0
  );
}

const semSetHoursFronteira = {
  meta: {
    type: "problem",
    docs: {
      description:
        "setHours(0, ...) fora de lib/datas.ts — calcula no fuso do processo/dispositivo, não no da loja. Use inicioDoDia/fimDoDia (lib/datas.ts).",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (ehChamadaSetHoursZero(node)) {
          context.report({
            node,
            message:
              "setHours(0, ...) fora de lib/datas.ts calcula fronteira de dia no fuso do processo/dispositivo, não no fuso da loja. Use inicioDoDia/fimDoDia de lib/datas.ts.",
          });
        }
      },
    };
  },
};

const semDateFnsFronteiraForaDoModulo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "startOfDay/startOfWeek/startOfMonth/endOfDay/endOfMonth do date-fns puro, fora de lib/datas.ts — calcula no fuso do processo, não no da loja.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const origem = String(node.source.value ?? "");
        if (origem !== "date-fns" && !origem.startsWith("date-fns/")) {
          return;
        }

        for (const especificador of node.specifiers) {
          if (
            especificador.type === "ImportSpecifier" &&
            FUNCOES_DATE_FNS_BANIDAS.has(especificador.imported.name)
          ) {
            context.report({
              node: especificador,
              message: `${especificador.imported.name} importado direto de date-fns fora de lib/datas.ts calcula fronteira de dia/semana/mês no fuso do processo, não no fuso da loja. Use lib/datas.ts.`,
            });
          }
        }
      },
    };
  },
};

const semCurrentDateSqlForaDoModulo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "CURRENT_DATE/CURRENT_TIMESTAMP em SQL raw, fora de lib/datas.ts — calcula no fuso da sessão do Postgres, não no da loja.",
    },
    schema: [],
  },
  create(context) {
    function checar(node, valor) {
      if (typeof valor === "string" && PADRAO_CURRENT_DATE_SQL.test(valor)) {
        context.report({
          node,
          message:
            "CURRENT_DATE/CURRENT_TIMESTAMP em SQL raw, fora de lib/datas.ts, calcula no fuso da sessão do Postgres, não no fuso da loja. Calcule a fronteira em lib/datas.ts e passe como parâmetro.",
        });
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

const konextRegrasDatas = {
  rules: {
    "sem-set-hours-fronteira-fora-do-modulo": semSetHoursFronteira,
    "sem-date-fns-fronteira-fora-do-modulo": semDateFnsFronteiraForaDoModulo,
    "sem-current-date-sql-fora-do-modulo": semCurrentDateSqlForaDoModulo,
  },
};

export default konextRegrasDatas;
