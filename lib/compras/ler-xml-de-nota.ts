import { XMLParser } from "fast-xml-parser";

import { lerNotaDeXml, XmlDeNotaInvalido, type NotaXmlLida } from "@/lib/dominio/compras/leitura-xml";

/**
 * Converte o texto do XML em objeto e entrega pro domínio interpretar.
 *
 * Toda a configuração aqui existe por uma razão específica:
 *
 * - `parseTagValue: false` é a mais importante. Sem ela, o parser converte
 *   valor de tag pra número quando "parece número" — e a chave de acesso da
 *   NF-e tem 44 dígitos, muito além do inteiro exato do JavaScript. Ela
 *   viraria `3.5261022000123e+43` e os últimos dígitos sumiriam. O mesmo
 *   vale pro CNPJ com zero à esquerda e pro NCM. Tudo chega como texto, e a
 *   conversão pra número acontece campo a campo no domínio, onde dá pra
 *   saber o que é número de verdade.
 *
 * - `ignoreAttributes: false` porque a chave de acesso mora no atributo
 *   `Id` de `infNFe`, não num elemento.
 *
 * - `removeNSPrefix: true` porque alguns emissores assinam com prefixo de
 *   namespace (`<ns:infNFe>`) e outros não. Sem isso, metade das notas do
 *   mercado não casa com nome de tag nenhum.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

export function lerXmlDeNota(conteudo: string): NotaXmlLida {
  const semBom = conteudo.replace(/^﻿/, "").trim();

  if (semBom === "") {
    throw new XmlDeNotaInvalido("O arquivo está vazio.");
  }

  let documento: unknown;

  try {
    documento = parser.parse(semBom);
  } catch {
    throw new XmlDeNotaInvalido(
      "Não consegui ler este arquivo como XML. Confira se ele não foi aberto e salvo por algum editor de planilha, que costuma corromper o conteúdo."
    );
  }

  if (typeof documento !== "object" || documento === null) {
    throw new XmlDeNotaInvalido("O arquivo não tem conteúdo de XML.");
  }

  return lerNotaDeXml(documento as Record<string, unknown>);
}
