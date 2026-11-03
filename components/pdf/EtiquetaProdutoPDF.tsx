import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PALETA_PAPEL } from "@/lib/design/papel";
import {
  encurtarParaEtiqueta,
  limiteDeNomePorTamanho,
  mmParaPontos,
  type TamanhoEtiqueta,
} from "@/lib/dominio/estoque/etiqueta";

export type DadosEtiqueta = {
  nome: string;
  /** Já formatado em reais, porque o PDF não deve decidir formato de moeda. */
  preco: string;
  /** O texto impresso abaixo das barras. */
  legenda: string;
  sku: string | null;
  compatibilidade: string | null;
  /** PNG do código de barras como data URI, gerado no servidor. */
  codigoDeBarrasPng: string;
};

/**
 * Etiqueta de produto para impressora térmica.
 *
 * Uma etiqueta por PÁGINA, e a página tem o tamanho exato do rolo. É assim que
 * impressora de etiqueta funciona: ela corta no picote a cada página, então
 * "duas etiquetas numa folha" sairia uma cortada no meio.
 *
 * As cores vêm de `PALETA_PAPEL` e não dos tokens de tela: etiqueta é papel
 * branco, sempre — o tema escuro do app imprimiria um retângulo preto.
 */
export function EtiquetaProdutoPDF({
  dados,
  tamanho,
  copias,
}: {
  dados: DadosEtiqueta;
  tamanho: TamanhoEtiqueta;
  copias: number;
}) {
  const largura = mmParaPontos(tamanho.larguraMm);
  const altura = mmParaPontos(tamanho.alturaMm);

  // Etiqueta pequena não tem espaço pra nome: o que importa ali é o código e o
  // preço. Tentar encaixar os três deixa os três ilegíveis.
  const cabeNome = tamanho.larguraMm > 35;
  const cabeCompatibilidade = tamanho.larguraMm >= 60;

  const estilos = montarEstilos(tamanho);

  return (
    <Document title={`Etiqueta ${dados.sku ?? dados.legenda}`}>
      {Array.from({ length: Math.max(1, copias) }).map((_, indice) => (
        <Page key={indice} size={{ width: largura, height: altura }} style={estilos.pagina}>
          {cabeNome && (
            <Text style={estilos.nome}>
              {encurtarParaEtiqueta(dados.nome, limiteDeNomePorTamanho(tamanho))}
            </Text>
          )}

          {cabeCompatibilidade && dados.compatibilidade && (
            <Text style={estilos.compatibilidade}>
              {encurtarParaEtiqueta(dados.compatibilidade, 44)}
            </Text>
          )}

          <Text style={estilos.preco}>{dados.preco}</Text>

          <View style={estilos.areaDoCodigo}>
            {/* Imagem e não vetor: ver lib/estoque/codigo-de-barras.ts. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- é o Image do
                @react-pdf/renderer, não o <img> do HTML: não existe alt em PDF. */}
            <Image src={dados.codigoDeBarrasPng} style={estilos.codigo} />
            <Text style={estilos.legenda}>{dados.legenda}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

/**
 * Os tamanhos são calculados a partir dos milímetros da etiqueta, não fixos:
 * uma fonte de 8 pt que funciona em 60 mm é ilegível depois de o conteúdo ser
 * comprimido em 33 mm, e um padding de 4 pt come 12% da largura útil ali.
 */
function montarEstilos(tamanho: TamanhoEtiqueta) {
  const estreita = tamanho.larguraMm <= 35;

  return StyleSheet.create({
    pagina: {
      backgroundColor: PALETA_PAPEL.papel,
      color: PALETA_PAPEL.texto,
      paddingHorizontal: mmParaPontos(estreita ? 1.5 : 2.5),
      paddingVertical: mmParaPontos(estreita ? 1 : 1.5),
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    nome: {
      fontSize: estreita ? 5.5 : 7,
      fontWeight: 700,
      lineHeight: 1.15,
    },
    compatibilidade: {
      fontSize: 6,
      color: PALETA_PAPEL.texto2,
      marginTop: 1,
    },
    preco: {
      fontSize: estreita ? 11 : 14,
      fontWeight: 700,
      marginTop: estreita ? 0 : 1,
    },
    areaDoCodigo: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
    codigo: {
      width: "100%",
      // A altura é o que sobra depois do texto. Fixa em mm pra barra não
      // encolher quando o nome ocupa duas linhas — barra baixa demais deixa de
      // ser lida.
      height: mmParaPontos(estreita ? 7 : 9),
      objectFit: "fill",
    },
    legenda: {
      fontSize: estreita ? 5 : 6,
      letterSpacing: 0.4,
      color: PALETA_PAPEL.texto2,
      marginTop: 0.5,
    },
  });
}

export default EtiquetaProdutoPDF;
