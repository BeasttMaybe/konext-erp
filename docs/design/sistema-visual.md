# Sistema visual Konext

Fase 3-1 — fundação de design system + shell do app. Referência viva: toda
regra descrita aqui é imposta por código (a regra de lint `konext/sem-*`,
`scripts/dev/auditar-contraste.mjs`), não por convenção informal.

## 1. Onde tudo mora

| O quê | Onde |
|---|---|
| Tokens de cor/espaço/raio/sombra/z-index | `app/tokens-konext.css` (`--kx-*`) |
| Ponte pros componentes shadcn/Tailwind | `app/globals.css` (`@layer base` + `@theme inline`) |
| Fonte da marca (Plus Jakarta Sans) | `app/layout.tsx` (raiz) e `app/(auth)/layout.tsx` (login, instância própria) |
| Componentes de UI (shadcn restilado + novos) | `components/ui/**` |
| Shell (barra lateral, barra superior, busca, cabeçalho de página) | `components/shell/**` |
| Regra de lint anti-cor-solta | `eslint-rules/sem-cor-hardcoded.mjs`, ligada em `eslint.config.mjs` |
| Calculadora de contraste WCAG | `scripts/dev/auditar-contraste.mjs` |

## 2. Tokens

Todo token vive em duas cópias — escuro (`:root`, é o padrão da marca) e
claro (`:root:not(.dark)`, sobrescreve) — na mesma classe `.dark` que
`components/provedores/provedor-tema.tsx` já alternava antes desta fase.
Nenhum mecanismo de tema novo foi criado.

### 2.1 Cor — superfícies e texto

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--kx-fundo` | `#1B1D38` | `#F5F6FB` | Fundo da página |
| `--kx-painel` | `#2A2C50` | `#FFFFFF` | Barra lateral, painéis grandes |
| `--kx-painel-borda` | `#353862` | `#E2E4F3` | Divisor decorativo entre painéis (não precisa 3:1 — não é fronteira de componente interativo) |
| `--kx-campo-borda` | `#7B80BD` ¹ | `#7B7FB8` ¹ | Fronteira de campo/input — **precisa** de 3:1 (WCAG 1.4.11) |
| `--kx-superficie` | `#23254A` | `#EEF0FA` | Fundo secundário (hover, blocos dentro de painel) |
| `--kx-cartao` | `#2E3158` | `#FFFFFF` | Cartões de conteúdo |
| `--kx-texto` | `#EEF0FB` | `#1B1D38` | Texto principal |
| `--kx-texto-2` | `#C3C6E4` | `#4B4E76` | Texto secundário |
| `--kx-legenda` | `#A7AACE` | `#6B6E96` | Legenda, rótulo pequeno |
| `--kx-placeholder` | `#9DA0C4` ¹ | `#5F639C` ¹ | Placeholder de campo |

¹ Ajustado do valor original do mockup — ver §3 (auditoria de contraste).

### 2.2 Cor — marca

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--kx-primaria` | `#5A5FE0` | `#5A5FE0` | Botão primário, marca |
| `--kx-destaque` | `#8B91FF` | `#4B50D6` ² | Destaque/acento — mais escuro no claro pra manter contraste sobre branco |
| `--kx-link` | `#A5AAFF` | `#4548C9` ² | Link |
| `--kx-foco` | `#8B91FF` | `#4B50D6` ² | Anel de foco (`--ring`) |

² O mockup só deu o valor escuro; o claro é escolha desta fase, auditada (§3).

### 2.3 Cor — etapas da OS, garantia, feedback

Cada uma é um **indicador** (ponto/borda/ícone — 3:1) mais, quando existe
pílula na tabela, um par fundo/texto **de texto** (4.5:1). Nunca usar o
indicador sozinho como cor de texto corrido.

| Token indicador | Escuro | Claro | Pílula fundo/texto |
|---|---|---|---|
| `--kx-orcamento` | `#FBBF24` | `#92660A` ² | reaproveita o par de `--kx-alerta-*` (mesma cor no mockup) |
| `--kx-conserto` | `#60A5FA` | `#1D63C0` ² | `--kx-conserto-fundo`/`--kx-conserto-texto` (novo — mockup só dava o ponto) |
| `--kx-pronto` | `#34D399` | `#0A7D55` ² | reaproveita o par de `--kx-sucesso-*` (mesma cor no mockup) |
| `--kx-entregue` | `#8B91FF` | `#4548C9` ² | `--kx-entregue-fundo`/`--kx-entregue-texto` (novo) |
| `--kx-garantia` | `#C2408F` | `#C2408F` | `--kx-garantia-pilula-fundo`/`--kx-garantia-pilula-texto` |
| `--kx-sucesso` | `#34D399` | `#0A7D55` ² | `--kx-sucesso-fundo`/`--kx-sucesso-texto`/`--kx-sucesso-icone` |
| `--kx-alerta` | `#FBBF24` | `#92660A` ² | `--kx-alerta-fundo`/`--kx-alerta-texto`/`--kx-alerta-icone` |
| `--kx-erro` | `#F87171` | `#C0392B` ² | `--kx-erro-fundo`/`--kx-erro-texto`/`--kx-erro-icone`/`--kx-erro-borda` |
| `--kx-erro-solido` | `#C0392B` | `#C0392B` | Só pra preenchimento sólido + texto branco (`--destructive`) — `--kx-erro` sozinho (`#F87171`) falha com branco em cima (2.77:1) |

Mais dois tokens sem variação por tema (fazem sentido fixos nos dois):
`--kx-sobreposicao` (fundo de dialog/gaveta, `rgba(8,9,20,.7)`) e
`--kx-controle-bolinha` (bolinha do switch, `#FFFFFF`).

### 2.4 Espaço, raio, sombra, z-index

```
--kx-espaco-{1,2,3,4,5,6,8,10,12,16}  →  4px … 64px (grade de 4px)
--kx-raio-painel   24px    --kx-raio-cartao  16px
--kx-raio-botao    12px    --kx-raio-pilula  999px
--kx-sombra-cartao / --kx-sombra-painel / --kx-sombra-flutuante
--kx-z-base(0) --kx-z-sticky(20) --kx-z-cabecalho(30) --kx-z-barra-lateral(30)
--kx-z-dropdown(40) --kx-z-drawer(50) --kx-z-dialogo(60) --kx-z-toast(70)
```

Todos expostos como utilitário Tailwind (`p-kx-6`, `rounded-kx-cartao`,
`shadow-kx-painel`, `z-kx-dialogo`) via `@theme inline` em `app/globals.css` —
inclusive o z-index, que precisa da própria ponte (`--z-index-kx-*`) porque o
Tailwind v4 só reconhece um utilitário `z-kx-*` se existir uma variável de
tema com esse nome; sem ela a classe é ignorada silenciosamente (era
exatamente o bug do conteúdo passando por cima da barra superior, corrigido
na Fase 3-2A — a barra tinha `z-kx-cabecalho` no JSX, mas nenhum CSS saía
dali).

#### Ordem de camadas (Fase 3-2A)

Uma escala só, pra nunca duas telas brigarem por número solto — cada nível é
estritamente MAIOR que o anterior, então a lista abaixo também é a ordem
visual de baixo pra cima (a de baixo nunca cobre a de cima):

```
conteúdo (base/sticky)  <  barra lateral / barra superior  <  dropdown,
popover, select, autocomplete  <  gaveta (Sheet)  <  diálogo/alert-dialog
<  toast
```

A barra superior fica **sempre** acima do conteúdo da página — é
`position: sticky` com `z-kx-cabecalho` e fundo opaco (`bg-kx-painel`, sólido
nos dois temas, nunca translúcido), então nenhum painel ou card de KPI da
página consegue desenhar por cima dela mesmo com `position: sticky`/`relative`
próprio. A barra lateral fixa usa o mesmo nível (`z-kx-barra-lateral`,
mesmo valor de `z-kx-cabecalho`) — as duas são "casca" do app, nunca
conteúdo de página.

`--kx-z-sticky` é só pra cabeçalho de tabela sticky *dentro* de um painel
(ex.: uma tabela rolável) — fica abaixo da casca do app de propósito, pra
nunca cobrir a barra superior ao rolar.

### 2.5 Como a ponte pro shadcn funciona

```
--background  →  var(--kx-fundo)       --border  →  var(--kx-painel-borda)
--foreground  →  var(--kx-texto)       --input   →  var(--kx-campo-borda)
--card        →  var(--kx-cartao)      --ring    →  var(--kx-foco)
--primary     →  var(--kx-primaria)    --radius  →  var(--kx-raio-botao)
--destructive →  var(--kx-erro-solido)
```

`@theme inline` para de embrulhar em `hsl(...)`: as variáveis shadcn agora
resolvem pra hex, não pra tripla "H S% L%", e os modificadores de opacidade
do Tailwind (`bg-foreground/50`) continuam funcionando via `color-mix()`
nativo do Tailwind v4, que aceita qualquer formato de cor válido. Todo
componente shadcn (`Button`, `Card`, `Input`, `Dialog`...) herda a paleta
nova automaticamente — nenhum precisou ser reescrito por causa disso.

## 3. Auditoria de contraste (WCAG AA)

Rodada com `node scripts/dev/auditar-contraste.mjs '[["rotulo","#fg","#bg"]]'`
pra cada par texto/fundo real do sistema (4.5:1 texto normal, 3:1
componente não-textual/WCAG 1.4.11). Dois valores do mockup original
falharam e foram ajustados — o token mudou, nunca o uso:

| Par | Original | Resultado original | Ajustado | Resultado ajustado |
|---|---|---|---|---|
| `--kx-placeholder` sobre `--kx-cartao` (escuro) | `#8E91B8` | 4.06:1 ❌ | `#9DA0C4` | 4.87:1 ✅ |
| `--kx-campo-borda` sobre `--kx-cartao` (escuro) | `#383B66` | 1.20:1 ❌ (precisa 3:1) | `#7B80BD` | 3.34–3.95:1 ✅ |

Tokens sem valor claro no mockup (`--kx-destaque`, `--kx-link`, `--kx-foco`,
as etapas de OS) foram desenhados nesta fase especificamente pra bater AA
sobre `--kx-cartao` claro (branco) — os valores escuros do mockup, quando
testados sobre branco, ficavam entre 1.67:1 e 2.77:1 (ex.: `--kx-entregue`
`#8B91FF` sobre branco = 2.77:1). Toda combinação usada de fato no app
passa — tabela completa reproduzível rodando o script acima com os pares
de `app/tokens-konext.css`.

**Duas exceções documentadas, não corrigidas** (uso não-textual, dentro do
limiar de 3:1 que se aplica a elas):
- `--kx-painel-borda`: divisor decorativo entre painéis do mesmo fundo —
  não é "fronteira de componente" no sentido do WCAG 1.4.11.
- `--kx-garantia` (`#C2408F`) sobre `--kx-fundo` claro: 4.40:1 como
  indicador (dot/ícone) passa a exigência de 3:1 com folga; só falharia se
  usado como TEXTO corrido — para isso, sempre a pílula
  (`--kx-garantia-pilula-*`, 6.07:1).

## 4. Componentes (`components/ui/**`)

### 4.1 Novos nesta fase (sem equivalente shadcn)

| Componente | Arquivo | Props principais |
|---|---|---|
| `Painel` + `PainelCabecalho/Titulo/Descricao/Conteudo` | `painel.tsx` | — (composição, como `Card`) |
| `CartaoIndicador` | `cartao-indicador.tsx` | `titulo`, `valor`, `variante` (primaria/sucesso/alerta/erro/neutro), `icone?`, `tendenciaPercentual?`, `descricao?` |
| `PilulaStatus` | `pilula-status.tsx` | `variante` (orcamento/conserto/pronto/entregue/garantia/sucesso/alerta/erro/neutro), `comPonto?` |
| `Aviso` | `aviso.tsx` | `variante` (info/sucesso/alerta/erro), `titulo?`, `onFechar?` |
| `EstadoVazio` | `estado-vazio.tsx` | `icone?`, `titulo`, `descricao?`, `acao?` |
| `Carregando` / `CarregandoTelaCheia` | `carregando.tsx` | `tamanho` (sm/md/lg), `texto?` |

### 4.2 Restilados (já existiam, cor hardcoded trocada por token)

`dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` (overlay → `bg-kx-sobreposicao`),
`badge.tsx` (variantes → `bg-primary`/`bg-secondary`/`bg-destructive`),
`command.tsx` (→ tokens `popover`/`muted`/`accent`; ganhou `CommandDialog`,
que faltava), `progress.tsx` (→ `bg-muted`/`bg-primary`), `switch.tsx`
(→ `bg-primary`/`bg-muted-foreground`, bolinha → `--kx-controle-bolinha`).

`table.tsx` ganhou: `TableBody` com prop `zebra` (opt-in), `TableCell` com
prop `numerico` (`text-right tabular-nums`), e os componentes
`TabelaVazia`/`TabelaCarregando` (esqueleto).

### 4.3 Inalterados nesta fase

`button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`,
`textarea.tsx`, `tabs.tsx`, `avatar.tsx`, `label.tsx`, `popover.tsx`,
`dropdown-menu.tsx`, `scroll-area.tsx`, `pagination-controls.tsx`,
`acesso-negado.tsx` — já herdam a paleta nova via §2.5, sem cor hardcoded
própria encontrada neles.

### 4.4 Regra de tamanho de alvo (44px)

O botão padrão (`size="default"`) continua `h-8` (32px) — **não foi
alterado**. Subir a altura padrão do `Button`/`Input`/`Select` empurraria a
altura de toda tela já existente do app, o que o limite de escopo desta
fase pede pra não fazer ainda (isso é trabalho tela-por-tela da Fase 3-2).
A regra de 44px vale de fato nos 6 componentes novos (§4.1) e no shell
(§5) — todo alvo clicável ali (item de navegação, botão de sair, gatilho
de busca) é `h-11` (44px) ou maior.

## 5. Shell (`components/shell/**`)

- **`BarraLateral`**: fixa, 1280px+ com rótulo (`w-[248px]`), 1024–1279px
  vira trilho de só ícone (`w-[72px]`), abaixo de 1024px some (dá lugar à
  `GavetaLateralMobile`). Tudo por classe responsiva do Tailwind (`lg:`/`xl:`),
  sem detectar breakpoint em JS. Item ativo "entalha": fundo igual ao
  `--background` do conteúdo, sem arredondar o lado que encosta nele — como
  as duas superfícies têm a mesma cor, a borda some e dá a impressão de o
  item "entrar" no conteúdo. (Simplificação deliberada da máscara de canto
  côncavo — não haveria como validar visualmente sem navegador nesta fase.)
- **`GavetaLateralMobile`**: mesma fonte de itens/permissão da barra fixa,
  como gaveta (`Sheet`) abaixo de 1024px.
- **`BarraSuperior`**: nome da empresa, campo de busca (abre a paleta),
  `SinoNotificacoes` (já existia), menu do usuário — logout/perfil/tema
  portados de `components/layout/cabecalho.tsx` (agora removido, sem uso).
- **`PaletaComando`** (Ctrl+K/Cmd+K, `command.tsx` + `CommandDialog`): busca
  OS (`escopoOrdemServico`, Fase 1D-2) e clientes (`buscarClientesCRM`
  já existente). **Não busca produto** — não existe ação de busca de
  produto no formato "digite e receba poucos resultados" (só listagem
  paginada); construir uma passaria de um dia de trabalho, e o pedido desta
  fase permite reduzir o escopo da busca global nesse caso.
- **`StatusCaixa`**: usa `verificarStatusCaixa`/`obterResumoCaixaAbertoAtual`
  (`app/actions/caixa-pdv.ts`), que são de escopo do TENANT inteiro, não
  por usuário — não existe hoje uma versão "meu caixa está aberto". Some
  inteiro pra quem não tem `pdv.vender`.
- **`CabecalhoPagina`**: o padrão trilha + título + ações que toda tela da
  Fase 3-2 deve usar uma vez, no topo do conteúdo.
- Todo item de menu continua filtrado por `lib/navegacao/itens-navegacao.ts`
  (`filhosVisiveis`/`caminhoDoItem`), sem nenhuma lógica de permissão
  reimplementada — mesma fonte da Fase 1D-2.

Removidos nesta fase (sem nenhum importador restante depois que o shell
substituiu a navegação em topo): `components/layout/cabecalho.tsx`,
`nav-principal.tsx`, `menu-mobile.tsx`, `rodape.tsx`, `conteudo-principal.tsx`.

## 6. Regra de enforcement

`eslint.config.mjs` liga `konext/sem-hex-hardcoded` e
`konext/sem-cor-tailwind-solta` (`eslint-rules/sem-cor-hardcoded.mjs`) como
`error` em `app/**` e `components/**`. A regra varre todo literal de string
(`className`, `style` inline, template literal) procurando `#rgb`/`#rrggbb`
e utilitário Tailwind tipo `bg-red-500`/`text-emerald-600` — cor do
catálogo padrão do Tailwind, fora do conjunto `--kx-*`/shadcn.

**Escape hatch**: arquivos de gráfico (`components/dashboard/grafico-*.tsx`,
`medidor.tsx` etc.) não precisaram de exceção nenhuma — já usam
`var(--receita)`/`var(--despesa)`/`var(--lucro)` (Fase 1A, família de cor
própria pra marca de gráfico vs. texto), que não bate no padrão da regra.

**Grandfather de telas legadas**: 83 arquivos já tinham cor hardcoded antes
desta fase e não foram restilados aqui (é trabalho da Fase 3-2, tela por
tela) — listados em `ARQUIVOS_COM_COR_LEGADA` no topo de
`eslint.config.mjs`, com o comentário explicando o critério. Tirar um
arquivo dali é o sinal de "aquela tela terminou a Fase 3-2"; a lista só
deve encolher, nunca crescer. Nenhum arquivo tocado nesta fase (tokens,
componentes novos, shell) está na lista — os únicos ajustes de cor feitos
em código pré-existente foram os 7 primitivos do §4.2, já corrigidos, não
grandfathered.

**Z-index (Fase 3-2A)**: `konext/sem-z-index-solto`, mesmo arquivo de regras,
bane `z-50`/`z-20`/`z-[100]` etc. soltos — sempre um `z-kx-*` (§2.4). Nasceu
**sem** lista de grandfather: a auditoria que corrigiu o bug do conteúdo
passando por cima da barra superior já substituiu toda ocorrência solta em
`app/**`/`components/**` (`dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`,
`popover.tsx`, `select.tsx`, `dropdown-menu.tsx`, `seletor-cliente-crm.tsx`,
`financeiro/inteligencia/page.tsx`, `crm/propostas/nova/page.tsx`), então
qualquer violação daqui pra frente é regressão nova, não legado a tolerar.

## 7. Regras pra uma tela nova (Fase 3-2 em diante)

1. Cor só por token — `bg-kx-*`, `text-primary`, `border-border` etc.
   Nunca `bg-red-500`, nunca `#RRGGBB` solto. A regra de lint barra isso
   automaticamente; se precisar de uma exceção de verdade (gráfico), o
   padrão é a mesma família `var(--receita)`/`--despesa`/`--lucro`.
2. Toda célula numérica de tabela: `<TableCell numerico>` (tabular-nums +
   alinhado à direita).
3. Todo alvo clicável novo: no mínimo 44px de altura (`h-11`).
4. Todo controle interativo precisa de anel de foco visível
   (`focus-visible:ring-*` — já vem de graça nos primitivos shadcn/Konext).
5. Toda tela usa `CabecalhoPagina` uma vez, no topo do conteúdo — não em
   cada seção.
6. Escopo de visibilidade (OS/caixa/financeiro) sempre via
   `lib/auth/escopos.ts`, nunca reimplementado numa tela nova.
7. Ação que o usuário não pode fazer simplesmente não aparece (regra da
   Fase 1D-2, "esconder, não explicar") — continua valendo pra toda tela
   nova do shell.

## 8. Telas que ficam visualmente inconsistentes até a Fase 3-2

Todo o **conteúdo** de cada módulo (Dashboard, CRM, PDV, Vendas, Estoque,
OS, Financeiro, Metas, Configurações) continua com o visual antigo — só a
casca (barra lateral, barra superior, tokens de cor por trás dos
componentes shadcn) mudou nesta fase. Isso quer dizer: o FUNDO de cada tela
já fica na paleta nova (herdado via `--background`), mas cor hardcoded
dentro do módulo (badge verde-esmeralda do Tailwind puro, texto
`text-slate-900`, etc. — os 83 arquivos do §6) continua igual até ser
restilada tela por tela na Fase 3-2. Lista completa em
`ARQUIVOS_COM_COR_LEGADA` (`eslint.config.mjs`); os módulos com mais
arquivos pendentes são OS (23), Metas (11) e Financeiro (10).
