import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda: a tela de editar proposta tem que ABRIR PREENCHIDA.
 *
 * O DEFEITO QUE ISTO IMPEDE DE VOLTAR
 *
 * A edição foi entregue com o formulário nascendo vazio. O dono clicava em
 * "Editar proposta" e via uma proposta em branco — "some todos itens de
 * dentro da proposta, como se eu tivesse criando uma nova".
 *
 * A causa não foi uma decisão errada: a linha que ligava os valores da
 * proposta ao `defaultValues` do formulário simplesmente não entrou no
 * arquivo, e nada acusou. O componente compilava, o lint passava, os 1209
 * testes passavam — porque nenhum deles olhava para esta ligação.
 *
 * Não houve dano: `cliente` é obrigatório no schema, então o formulário em
 * branco nem chegava a ser enviado. Mas a tela estava inútil.
 *
 * POR QUE LER A FONTE, E NÃO RENDERIZAR
 *
 * Renderizar o formulário exigiria o react-hook-form, o zodResolver e os
 * mocks das actions que ele chama ao montar — muito aparato para checar uma
 * ligação de uma linha. Ler a fonte custa nada e pega exatamente o que
 * quebrou. É o mesmo padrão de `receita-sem-bling.test.ts`.
 */

const FORMULARIO = "components/crm/propostas/formulario-de-proposta.tsx";

function lerFonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("o formulário de proposta abre preenchido quando está editando", () => {
  const fonte = lerFonte(FORMULARIO);

  it("liga os valores da proposta ao estado inicial do formulário", () => {
    // Sem esta ligação, `useForm` começa do `defaultValues` vazio e a tela
    // de editar vira uma tela de criar.
    expect(fonte).toMatch(/defaultValues:\s*proposta\?\.valores\s*\?\?\s*defaultValues/);
  });

  it("não usa o padrão vazio direto no useForm", () => {
    // `defaultValues,` sozinho é exatamente o estado do bug.
    expect(fonte).not.toMatch(/\n\s*defaultValues,\s*\n\s*\}\);/);
  });

  it("os itens vêm do mesmo lugar que o resto do formulário", () => {
    // `useFieldArray` lê do `control`, que nasce do `defaultValues`. Se
    // alguém trocar por uma lista própria, os itens voltam a sumir.
    expect(fonte).toMatch(/useFieldArray\(\{\s*\n?\s*control,\s*\n?\s*name:\s*"itens"/);
  });

  it("recebe a proposta por propriedade, em vez de buscar sozinho", () => {
    // A página de edição carrega e passa pronto. Buscar aqui dentro traria
    // de volta o reset de estado dentro de efeito.
    expect(fonte).toContain("proposta?: PropostaParaEditar");
  });
});

describe("a página de edição entrega os itens convertidos", () => {
  const pagina = lerFonte("app/(dashboard)/crm/propostas/[id]/editar/page.tsx");

  it("mapeia os itens da proposta para o formato do formulário", () => {
    expect(pagina).toMatch(/itens:\s*proposta\.itens\.map/);
  });

  it("converte o preço pelo módulo de dinheiro, não à mão", () => {
    expect(pagina).toContain("paraMoeda(deDecimal(item.precoUnitario))");
  });
});
