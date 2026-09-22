// Regra local (Fase 2A-2): aritmética/conversão de dinheiro só pode
// acontecer em lib/dinheiro.ts — o único módulo autorizado a converter
// `Decimal` do Prisma pra número, fazer parse de entrada monetária, e
// formatar dinheiro pro usuário. Mesmo motivo da Fase 2A-1 pra
// datas-fronteira-fora-do-modulo.mjs: um fechamento de caixa já calculou
// R$ 1.409,8899999 em vez de R$ 1.409,89 por somar valores em ponto
// flutuante espalhados pelo código — juntar tudo num módulo único, com uma
// única fórmula de arredondamento, é a correção estrutural.
//
// Três regras nesta única implementação:
//   konext-dinheiro/sem-to-number-decimal-fora-do-modulo
//     — bane `algumDecimal.toNumber()` fora de lib/dinheiro.ts. `Decimal#toNumber()`
//       é exatamente a operação que reintroduz ponto flutuante na borda —
//       use `deDecimal` (devolve CENTAVOS INTEIROS), nunca `.toNumber()` cru.
//   konext-dinheiro/sem-parse-float-dinheiro-fora-do-modulo
//     — bane `parseFloat(...)` fora de lib/dinheiro.ts. Este projeto nunca
//       precisa de `parseFloat` pra entrada monetária — `lerReais` já cobre
//       o caso (parse pt-BR, vírgula decimal), e outro `parseFloat` solto
//       quase sempre é um parse de dinheiro feito à mão, sem arredondamento
//       de centavo.
//   konext-dinheiro/sem-to-fixed-dinheiro-fora-do-modulo
//     — bane `algumValorEmDinheiro.toFixed(...)` fora de lib/dinheiro.ts.
//       Heurística pelo NOME do identificador/propriedade acessado (mesmo
//       estilo pragmático de sem-cor-hardcoded.mjs — regex sobre texto, não
//       inferência de tipo): nomes claramente monetários neste projeto
//       (valorTotal, valorBruto, precoUnitario, custoPeca, subtotal, saldo,
//       troco, comissao, faturamento, receita, despesa...) disparam a
//       regra; nomes claramente percentuais/genéricos (taxa*Percentual,
//       *Percentual, participacao, variacao, margem, soma, numero, valor
//       sozinho sem sufixo, ratio) NÃO disparam — `toFixed` pra formatar
//       percentual/tempo/tamanho de arquivo continua permitido em qualquer
//       lugar, esta regra é só sobre DINHEIRO.
//
//       Exceção documentada: `valorAtual`/`valorAnterior`/`valorNovo`/
//       `valorAlvo` (os quatro campos de `Meta`, ver Parte 1 do relatório
//       da Fase 2A-2) são POLIMÓRFICOS — podem representar dinheiro,
//       quantidade OU percentual dependendo de `Meta.tipoValor` em tempo de
//       execução, então não são "dinheiro" no sentido desta regra e ficam
//       de fora do padrão de propósito (não por omissão).
//
// `lib/dinheiro.ts` fica isento das três (é o único lugar autorizado) via
// `ignores` no eslint.config.mjs, mesmo padrão das outras regras locais.

const NOMES_DINHEIRO_TOFIXED =
  /\b(valor(?:Total|Bruto|Liquido|Pago|Cobrado|Recebido|Adicional|Fechamento|Abertura|Pagamento|Venda|Compra|Unitario)|preco\w*|preço\w*|custo\w*|subtotal\w*|saldo\w*|troco\w*|comiss[aã]o\w*|faturamento\w*|receita\w*|despesa\w*)\b/i;

function nomeDoAlvoToFixed(node) {
  // node.callee é sempre `<algo>.toFixed` (MemberExpression) — quem chama
  // já garantiu isso. `<algo>` pode ser um Identifier (`valor.toFixed`), uma
  // outra MemberExpression (`item.pagamentoConfirmado.valorTotal.toFixed`,
  // usamos só a última propriedade), ou qualquer outra expressão (ex.:
  // `(a / b * 100).toFixed` — resultado de conta percentual, não tem nome,
  // devolve null e a regra não dispara pra essa forma, de propósito).
  const alvo = node.callee.object;

  if (alvo.type === "Identifier") {
    return alvo.name;
  }

  if (alvo.type === "MemberExpression" && !alvo.computed && alvo.property.type === "Identifier") {
    return alvo.property.name;
  }

  return null;
}

function ehChamadaToFixed(node) {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "toFixed"
  );
}

function ehChamadaToNumber(node) {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "toNumber"
  );
}

function ehChamadaParseFloat(node) {
  return node.callee.type === "Identifier" && node.callee.name === "parseFloat";
}

const semToNumberDecimalForaDoModulo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Decimal#toNumber() fora de lib/dinheiro.ts — reintroduz ponto flutuante na borda. Use deDecimal (lib/dinheiro.ts), que devolve centavos inteiros.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (ehChamadaToNumber(node)) {
          context.report({
            node,
            message:
              "Decimal#toNumber() fora de lib/dinheiro.ts reintroduz ponto flutuante na borda do servidor. Use deDecimal(valor) de lib/dinheiro.ts, que devolve centavos inteiros.",
          });
        }
      },
    };
  },
};

const semParseFloatDinheiroForaDoModulo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "parseFloat fora de lib/dinheiro.ts — entrada monetária deve ser lida com lerReais (lib/dinheiro.ts), que interpreta o formato pt-BR (vírgula decimal) e devolve centavos inteiros.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (ehChamadaParseFloat(node)) {
          context.report({
            node,
            message:
              "parseFloat fora de lib/dinheiro.ts. Se isto é entrada monetária, use lerReais(texto) de lib/dinheiro.ts (formato pt-BR, devolve centavos inteiros).",
          });
        }
      },
    };
  },
};

const semToFixedDinheiroForaDoModulo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "toFixed sobre um valor com nome claramente monetário, fora de lib/dinheiro.ts — formatação de dinheiro deve usar formatarReais (lib/dinheiro.ts).",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!ehChamadaToFixed(node)) return;

        const nome = nomeDoAlvoToFixed(node);
        if (nome && NOMES_DINHEIRO_TOFIXED.test(nome)) {
          context.report({
            node,
            message: `toFixed sobre "${nome}" (nome monetário) fora de lib/dinheiro.ts. Use formatarReais(centavos) de lib/dinheiro.ts.`,
          });
        }
      },
    };
  },
};

const konextRegrasDinheiro = {
  rules: {
    "sem-to-number-decimal-fora-do-modulo": semToNumberDecimalForaDoModulo,
    "sem-parse-float-dinheiro-fora-do-modulo": semParseFloatDinheiroForaDoModulo,
    "sem-to-fixed-dinheiro-fora-do-modulo": semToFixedDinheiroForaDoModulo,
  },
};

export default konextRegrasDinheiro;
