import { describe, expect, it } from "vitest";

import { formClienteSchema } from "./crm";

/**
 * No cadastro de cliente, só nome e telefone são obrigatórios.
 *
 * Decisão do dono: "mantenha obrigatório apenas nome e telefone". Quem atende
 * no balcão nem sempre tem o CPF do cliente na hora, e exigir um campo que a
 * pessoa não tem leva ao pior dos mundos — alguém digita qualquer coisa só
 * para passar da tela, e o cadastro fica com um documento falso que ninguém
 * sabe que é falso.
 */

const clienteMinimo = {
  nomeRazaoSocial: "Maria Aparecida",
  telefone: "11988887777",
};

describe("obrigatórios do cadastro de cliente", () => {
  it("aceita só com nome e telefone", () => {
    expect(formClienteSchema.safeParse(clienteMinimo).success).toBe(true);
  });

  it("continua exigindo o nome", () => {
    const semNome = formClienteSchema.safeParse({ ...clienteMinimo, nomeRazaoSocial: "" });
    expect(semNome.success).toBe(false);
  });

  it("continua exigindo o telefone", () => {
    const semTelefone = formClienteSchema.safeParse({ ...clienteMinimo, telefone: "" });
    expect(semTelefone.success).toBe(false);
  });

  it("não exige mais o CPF/CNPJ", () => {
    // Era `nonempty("CPF ou CNPJ é obrigatório.")`.
    expect(formClienteSchema.safeParse({ ...clienteMinimo, documento: "" }).success).toBe(true);
    expect(formClienteSchema.safeParse({ ...clienteMinimo }).success).toBe(true);
  });

  it("não exige endereço, e-mail nem os demais", () => {
    const resultado = formClienteSchema.safeParse(clienteMinimo);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      // Os opcionais chegam indefinidos, e não como string vazia — é o que
      // permite a action gravar NULO em vez de "" no documento, que é o que
      // faz dois clientes sem documento conviverem sob o índice único.
      expect(resultado.data.documento).toBeUndefined();
      expect(resultado.data.cep).toBeUndefined();
    }
  });

  it("e-mail continua sendo validado quando preenchido", () => {
    // Opcional não quer dizer aceitar qualquer coisa: um e-mail errado
    // gravado é pior que um e-mail ausente, porque parece que funciona.
    expect(formClienteSchema.safeParse({ ...clienteMinimo, email: "nao-e-email" }).success).toBe(
      false
    );
    expect(
      formClienteSchema.safeParse({ ...clienteMinimo, email: "maria@provedor.com" }).success
    ).toBe(true);
  });
});
