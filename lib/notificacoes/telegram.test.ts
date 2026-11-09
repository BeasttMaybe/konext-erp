import { describe, expect, it } from "vitest";

import { explicarErroDoTelegram, extrairChats, quebrarEmPartes } from "./telegram";

describe("quebra de mensagem do Telegram", () => {
  it("mensagem curta vai inteira, numa parte", () => {
    expect(quebrarEmPartes("oi", 100)).toEqual(["oi"]);
  });

  it("mensagem vazia não gera parte nenhuma", () => {
    // Senão o envio mandaria uma mensagem em branco pro celular do dono.
    expect(quebrarEmPartes("", 100)).toEqual([]);
  });

  it("quebra em linha, nunca no meio de uma", () => {
    // Cortar no meio partiria um aviso em dois: "R$ 1.2" numa mensagem e
    // "90,00" na seguinte é pior que não avisar.
    const partes = quebrarEmPartes("aaaa\nbbbb\ncccc", 10);

    expect(partes).toEqual(["aaaa\nbbbb", "cccc"]);
    for (const parte of partes) {
      expect(parte.length).toBeLessThanOrEqual(10);
    }
  });

  it("nenhuma parte passa do limite", () => {
    const texto = Array.from({ length: 300 }, (_, i) => `linha ${i} de aviso`).join("\n");

    for (const parte of quebrarEmPartes(texto, 4096)) {
      expect(parte.length).toBeLessThanOrEqual(4096);
    }
  });

  it("nenhuma linha é perdida na quebra", () => {
    const linhas = Array.from({ length: 200 }, (_, i) => `aviso numero ${i}`);
    const partes = quebrarEmPartes(linhas.join("\n"), 100);

    expect(partes.join("\n").split("\n")).toEqual(linhas);
  });

  it("linha maior que o limite é cortada em vez de descartada", () => {
    const gigante = "x".repeat(25);
    const partes = quebrarEmPartes(gigante, 10);

    expect(partes).toEqual(["xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
    expect(partes.join("")).toBe(gigante);
  });

  it("texto exatamente no limite não é quebrado", () => {
    expect(quebrarEmPartes("x".repeat(10), 10)).toHaveLength(1);
    expect(quebrarEmPartes("x".repeat(11), 10)).toHaveLength(2);
  });
});

describe("extrair chats dos updates do Telegram", () => {
  it("acha o chat de uma mensagem comum", () => {
    expect(
      extrairChats([{ message: { chat: { id: 987654321, type: "private", first_name: "Max" } } }])
    ).toEqual([{ id: "987654321", nome: "Max", tipo: "private" }]);
  });

  it("junta nome e sobrenome", () => {
    const [chat] = extrairChats([
      { message: { chat: { id: 1, type: "private", first_name: "Max", last_name: "Lan" } } },
    ]);

    expect(chat.nome).toBe("Max Lan");
  });

  it("grupo aparece pelo título, com id negativo", () => {
    // Id de grupo é negativo no Telegram, e virar string não pode perder o
    // sinal — um id sem o menos aponta pra outra conversa.
    const [chat] = extrairChats([
      { message: { chat: { id: -1001234567890, type: "supergroup", title: "Konext Financeiro" } } },
    ]);

    expect(chat).toEqual({ id: "-1001234567890", nome: "Konext Financeiro", tipo: "supergroup" });
  });

  it("não repete o mesmo chat que mandou várias mensagens", () => {
    const updates = Array.from({ length: 5 }, () => ({
      message: { chat: { id: 42, type: "private", first_name: "Max" } },
    }));

    expect(extrairChats(updates)).toHaveLength(1);
  });

  it("entende os outros formatos de update, não só `message`", () => {
    // A forma do update varia, e é aqui que isto erraria em silêncio.
    const chats = extrairChats([
      { edited_message: { chat: { id: 1, type: "private", first_name: "A" } } },
      { channel_post: { chat: { id: 2, type: "channel", title: "Canal" } } },
      { my_chat_member: { chat: { id: 3, type: "group", title: "Grupo" } } },
    ]);

    expect(chats.map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("update sem chat é ignorado em vez de virar linha vazia", () => {
    expect(extrairChats([{ poll: { id: "x" } }, {}, { message: {} }])).toEqual([]);
  });

  it("chat sem nome nenhum não vira string vazia na lista", () => {
    // Linha em branco pra clicar é pior que um rótulo feio.
    const [chat] = extrairChats([{ message: { chat: { id: 7, type: "private" } } }]);

    expect(chat.nome).toBe("Sem nome");
  });

  it("cai no @username quando não há nome nem título", () => {
    const [chat] = extrairChats([
      { message: { chat: { id: 8, type: "private", username: "maxtrix" } } },
    ]);

    expect(chat.nome).toBe("@maxtrix");
  });

  it("lista vazia não estoura", () => {
    expect(extrairChats([])).toEqual([]);
  });
});

describe("explicar o erro do Telegram", () => {
  it("traduz o erro que o dono viu de verdade", () => {
    const texto = explicarErroDoTelegram(
      'Telegram respondeu 403: {"ok":false,"error_code":403,"description":"Forbidden: the bot can\'t send messages to the bot"}'
    );

    expect(texto).toContain("é o do próprio bot");
    expect(texto).toContain("Procurar meu chat");
  });

  it("traduz conversa inexistente", () => {
    expect(explicarErroDoTelegram('{"description":"Bad Request: chat not found"}')).toContain(
      "Mande uma mensagem pro bot primeiro"
    );
  });

  it("traduz bot bloqueado e bot fora do grupo", () => {
    expect(explicarErroDoTelegram("Forbidden: bot was blocked by the user")).toContain(
      "bloqueou o bot"
    );
    expect(explicarErroDoTelegram("Forbidden: bot is not a member of the supergroup chat")).toContain(
      "não está nesse grupo"
    );
  });

  it("traduz token recusado", () => {
    expect(explicarErroDoTelegram("401 Unauthorized")).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("mantém o texto original no fim, pra dar pra diagnosticar", () => {
    // Esconder o original tornaria impossível diagnosticar um caso que esta
    // função não previu.
    expect(explicarErroDoTelegram("chat not found")).toContain("(Telegram: chat not found)");
  });

  it("erro desconhecido passa inteiro, sem inventar explicação", () => {
    expect(explicarErroDoTelegram("Falha de rede: ECONNRESET")).toBe("Falha de rede: ECONNRESET");
  });
});
