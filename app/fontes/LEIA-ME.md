# Fontes locais

A fonte da marca mora aqui dentro, versionada, em vez de ser baixada do
Google Fonts durante o build.

## Por que

`next/font/google` busca o arquivo da fonte na internet **em tempo de
build**. No dia 02/11/2026 isso derrubou o build três vezes com
`module-not-found` em `plus_jakarta_sans_*.module.css`, sem nenhuma
mudança de código entre as tentativas — e o deploy da Vercel faz
exatamente o mesmo download. Ou seja: não era chateação de CI, era um
deploy que podia falhar sozinho, por causa de um serviço de terceiro.

Com `next/font/local` o build não depende de rede. O arquivo está aqui,
commitado, e é o que vai pro bundle.

## O arquivo

- `plus-jakarta-sans-latin-wght-normal.woff2` — Plus Jakarta Sans
  **variável**, subset latin, eixo de peso 200–800 num único arquivo de
  27 KB. O carregador do Google buscava cinco pesos estáticos separados
  (400, 500, 600, 700, 800); o variável cobre os cinco e mais.
- `LICENSE-plus-jakarta-sans.txt` — SIL Open Font License 1.1, que exige
  que a licença acompanhe o arquivo.

Origem: pacote npm `@fontsource-variable/plus-jakarta-sans@5.3.0`
(`files/plus-jakarta-sans-latin-wght-normal.woff2`). O pacote foi só o
meio de transporte e **não** é dependência do projeto — a fonte da marca
não deve mudar sozinha num `npm update`.

Para atualizar: baixe a versão nova do mesmo pacote, substitua o `.woff2`
e a licença, e anote a versão aqui.

## A Geist saiu

`app/layout.tsx` carregava `Geist_Mono` e `app/global-error.tsx`
carregava `Geist`, definindo `--font-geist-mono` e `--font-geist-sans` no
`<body>`. **Nenhum CSS do projeto lia essas duas variáveis**: o
`--font-mono` do Tailwind nunca foi apontado pra elas, então o utilitário
`font-mono` sempre usou a pilha monoespaçada padrão do sistema. Eram dois
downloads de fonte por build, em troca de nada. Removidas.
