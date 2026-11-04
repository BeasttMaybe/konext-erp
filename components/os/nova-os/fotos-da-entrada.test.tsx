// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// O módulo importa a action de envio, que puxa o contexto do tenant e, com
// ele, o cliente do Prisma do banco central — que não existe num teste.
// O painel não chama a action nenhuma vez: quem chama é o hook de estado,
// e aqui o estado é falso.
vi.mock("@/app/actions/fotos-os", () => ({ enviarFotoDaOS: vi.fn() }));

import {
  PainelFotosDaEntrada,
  ProvedorFotosPendentes,
  type FotosPendentes,
} from "./fotos-da-entrada";

/**
 * O painel de fotos do ASSISTENTE de nova OS.
 *
 * Este teste existe por causa de um erro que eu cometi duas vezes: construir
 * a funcionalidade de fotos na tela de DETALHE da OS e deixar o assistente de
 * criação de fora. Aconteceu com a galeria ("não consegui colocar foto") e
 * aconteceu de novo com o link do celular ("não apareceu na criação da OS").
 *
 * As duas telas usam componentes diferentes para a mesma coisa, e nada no
 * sistema notava quando uma ficava para trás — o build passava, os tipos
 * passavam, e o botão simplesmente não estava lá. Agora alguém nota.
 */

function pendentesFalsas(extra: Partial<FotosPendentes> = {}): FotosPendentes {
  return {
    fotos: [],
    preparando: false,
    adicionar: vi.fn(),
    remover: vi.fn(),
    limpar: vi.fn(),
    enviarPara: vi.fn().mockResolvedValue({ enviadas: 0, falhas: 0 }),
    ...extra,
  };
}

afterEach(() => {
  cleanup();
});

describe("PainelFotosDaEntrada — o botão do celular", () => {
  it("aparece no assistente e chama quem sabe salvar", () => {
    const salvar = vi.fn();

    render(
      <ProvedorFotosPendentes valor={pendentesFalsas()} salvarEPedirLinkDoCelular={salvar}>
        <PainelFotosDaEntrada />
      </ProvedorFotosPendentes>
    );

    const botao = screen.getByRole("button", { name: /celular/i });
    fireEvent.click(botao);

    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it("some quando não há como salvar, em vez de aparecer quebrado", () => {
    // O assistente é usado em dois lugares. Onde não há onde mostrar o QR
    // code depois, o botão não deve existir — botão que não faz nada é pior
    // do que botão ausente, porque a pessoa clica e conclui que o sistema
    // está com defeito.
    render(
      <ProvedorFotosPendentes valor={pendentesFalsas()}>
        <PainelFotosDaEntrada />
      </ProvedorFotosPendentes>
    );

    expect(screen.queryByRole("button", { name: /celular/i })).not.toBeInTheDocument();
    // O de sempre continua lá.
    expect(screen.getByRole("button", { name: /adicionar/i })).toBeInTheDocument();
  });

  it("continua desabilitado enquanto uma foto está sendo preparada", () => {
    render(
      <ProvedorFotosPendentes
        valor={pendentesFalsas({ preparando: true })}
        salvarEPedirLinkDoCelular={vi.fn()}
      >
        <PainelFotosDaEntrada />
      </ProvedorFotosPendentes>
    );

    // Salvar a OS no meio da redução de uma imagem perderia essa foto: ela
    // ainda não está na lista que sobe depois do salvamento.
    expect(screen.getByRole("button", { name: /celular/i })).toBeDisabled();
  });
});

describe("PainelFotosDaEntrada — fora do provedor", () => {
  it("não quebra a tela inteira, só não aparece", () => {
    const { container } = render(<PainelFotosDaEntrada />);
    expect(container).toBeEmptyDOMElement();
  });
});
