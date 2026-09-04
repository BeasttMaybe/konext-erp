# Primitivos de página

Linguagem visual única do ERP. O dashboard (`app/(dashboard)/page.tsx` +
`components/dashboard/*`) é a implementação de referência: se algo aqui divergir dele,
o primitivo vence e o dashboard se adapta — nunca o contrário, e nunca um segundo estilo.

## Qual primitivo usar

| Situação | Primitivo |
|---|---|
| Título da página + ações | `CabecalhoPagina` |
| Busca, alternador de visão, selects | `BarraFiltros` |
| Qualquer cartão | `Superficie` |
| Listagem tabular | `TabelaDados` |
| Lista/tabela sem resultados | `EstadoVazio` |
| Número grande com comparação | `FiguraKPI` |
| Estado de OS, garantia, conta | `ChipStatus` |

```tsx
import {
  CabecalhoPagina,
  BarraFiltros,
  Superficie,
  TabelaDados,
  formatarMoeda,
} from "@/components/ui/pagina";
```

## Regras

**Títulos não têm subtítulo.** `CabecalhoPagina` aceita só `titulo`. A linha explicativa
sob o título ("Gerenciar entradas, orçamentos e status...") foi removida do sistema e o
componente não oferece slot para ela. Títulos de seção são uma ou duas palavras.

**Três tamanhos de tipo, só.**
- figura: `text-[1.65rem] font-semibold` (números grandes, dígitos proporcionais)
- rótulo: `text-xs text-muted-foreground`
- corpo: `text-sm`

`tabular-nums` apenas em colunas numéricas de tabela e em ticks de eixo — nunca nas
figuras grandes.

**Cor é semântica: azul entra, verde fica, vermelho sai.**

Uma regra, em todo lugar: **azul é receita e o que ainda está por entrar; verde é dinheiro
que fica; vermelho é dinheiro que sai.** Vale para KPI, DRE e movimentações.

Duas famílias de token, deliberadamente separadas — marca de gráfico precisa de saturação,
texto precisa de contraste, e o mesmo hex não faz os dois:

| uso | tokens |
|---|---|
| marcas (barra, linha, arco) | `--receita` `--despesa` `--lucro` |
| texto (valor, célula, delta) | `--t-azul` `--t-verde` `--t-vermelho` |
| status | `--status-ok` `--status-atencao` `--status-critico` |
| rampa ordinal da fila | `--fila-os-1..4` |

**Nunca use a cor de marca como cor de texto** (o verde de marca fica em 2.82:1 sobre
branco) e nunca use a de texto como preenchimento de gráfico. Fora desses papéis: tinta
neutra (`text-foreground` / `text-muted-foreground`).

**Encoding secundário é obrigatório, não decoração.** Verde e vermelho medem ΔE 6.9 (claro)
e 6.5 (escuro) sob daltonismo simulado — dentro da faixa que só é aceitável COM uma segunda
pista. Por isso:
- toda linha de comparação carrega a seta `↑ ↓ →`;
- todo valor com sinal carrega `+` ou `−`;
- no gráfico, Lucro é **linha** enquanto Receita e Despesa são **colunas** — essa diferença
  de forma é a segunda pista, então Lucro nunca vira uma terceira barra.

Nunca deixe um número verde e um vermelho lado a lado sem nenhuma outra distinção.

**Todo token de cor mora em `app/globals.css`**, declarado nos dois temas. Nenhum
componente escreve hex.

**`null → "—"`.** Média sem denominador, comparação sem base anterior, meta inexistente:
mostre travessão. Nunca `R$ 0,00` para média indefinida, nunca `−100,0%` quando a base
é zero. Em `FiguraKPI`, comparação nula rende "—" sem seta e sem cor.

**Direção do "bom" é propriedade da métrica.** Receita subindo é bom; despesa subindo é
ruim. Passe `direcaoBoa` explicitamente — jamais deduza do sinal.

**Vazio é frase, não zero.** "Nenhum aparelho parado", não um cartão com `0`.

**Ícones só como affordance** — em links, ações e chips de status. Nunca ao lado de um
número (a seta de comparação do `FiguraKPI` é parte do chip de variação, não decoração).

**Superfície única:** fundo `bg-card`, fio de 1px `border-border`. Sem gradiente, brilho,
borda colorida ou sombra além do fio.

## Formatação pt-BR

Importe sempre de `@/components/ui/pagina` — não crie um `Intl.NumberFormat` novo.

| Função | Saída |
|---|---|
| `formatarMoeda(1291)` | `R$ 1.291,00` |
| `formatarMoedaCompacta(1291)` | `R$ 1.291` |
| `formatarNumero(13)` | `13` |
| `formatarPercentual(60)` | `60%` |
| `formatarPercentual(0.4)` | `0,4%` (uma casa só abaixo de 1%) |
| `formatarDias(2)` | `2 dias` |
| `formatarDataCurta(iso)` | `04/09` |

## Gráficos

Sem spline, sem área translúcida empilhada, gridlines sólidas de 1px, eixo Y derivado dos
dados (nunca teto fixo, nunca piso negativo sem valor negativo real). Todo gráfico mantém
visão de tabela e tooltip de hover.
