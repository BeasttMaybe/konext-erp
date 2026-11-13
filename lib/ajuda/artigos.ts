/**
 * Guias da Central de Ajuda (/ajuda).
 *
 * Escritos com os nomes EXATOS dos botoes e telas do sistema — quem le esta
 * com a tela aberta do lado e procura a palavra. Ao renomear um botao,
 * atualize o guia (os testes conferem que cada "Ir para a tela" aponta para
 * uma rota que existe).
 */

export type CategoriaAjuda =
  | "Primeiros passos"
  | "Ordens de Serviço"
  | "Vendas e caixa"
  | "Clientes e propostas"
  | "Estoque"
  | "Financeiro"
  | "Equipe e configurações";

export const CATEGORIAS_AJUDA: readonly CategoriaAjuda[] = [
  "Primeiros passos",
  "Ordens de Serviço",
  "Vendas e caixa",
  "Clientes e propostas",
  "Estoque",
  "Financeiro",
  "Equipe e configurações",
];

export type ArtigoAjuda = {
  slug: string;
  titulo: string;
  categoria: CategoriaAjuda;
  /** Uma frase: o que o guia resolve. Aparece na lista. */
  resumo: string;
  /** Blocos de passos; um bloco quando o caminho e um so. */
  secoes: Array<{ titulo?: string; passos: string[] }>;
  dicas?: string[];
  /** Botao "Ir para a tela". */
  destino?: { rotulo: string; href: string };
  /** Palavras que a pessoa pode digitar na busca e que nao estao no titulo. */
  palavrasChave?: string[];
};

export const ARTIGOS_AJUDA: readonly ArtigoAjuda[] = [
  // ── Primeiros passos ────────────────────────────────────────────────
  {
    slug: "instalar-no-celular",
    titulo: "Instalar o TechOS no celular",
    categoria: "Primeiros passos",
    resumo: "Deixe o sistema como um aplicativo na tela inicial do iPhone ou do Android.",
    secoes: [
      {
        titulo: "No iPhone",
        passos: [
          "Abra o endereço do sistema no Safari (precisa ser o Safari).",
          "Toque no botão Compartilhar (o quadrado com a seta para cima).",
          "Escolha \"Adicionar à Tela de Início\" e confirme em \"Adicionar\".",
          "Abra o TechOS pelo ícone novo: ele abre em tela cheia, como um aplicativo.",
        ],
      },
      {
        titulo: "No Android",
        passos: [
          "Abra o endereço do sistema no Chrome.",
          "Toque nos três pontinhos ⋮ no canto de cima.",
          "Escolha \"Instalar app\" (ou \"Adicionar à tela inicial\").",
        ],
      },
    ],
    dicas: [
      "Se no celular as telas aparecerem pequenas, iguais às do computador, o Chrome está no modo \"Site para computador\". Desligue em ⋮ → \"Site para computador\" e abra o app de novo.",
      "Depois de uma atualização do sistema, feche o app e abra de novo para ver as novidades.",
    ],
    palavrasChave: ["app", "aplicativo", "pwa", "iphone", "android", "instalar", "tela inicial"],
  },
  {
    slug: "achar-qualquer-coisa",
    titulo: "Encontrar uma OS rápido",
    categoria: "Primeiros passos",
    resumo: "Use a busca do topo para ir direto a uma OS de qualquer tela.",
    secoes: [
      {
        passos: [
          "Clique na busca do topo da tela (no computador, aperte Ctrl + K).",
          "Digite o número da OS, o nome do cliente ou o aparelho.",
          "Escolha o resultado para abrir.",
        ],
      },
    ],
    dicas: [
      "No celular a busca é o ícone de lupa no topo.",
      "Para achar um cliente, use a busca da tela Clientes (CRM).",
    ],
    palavrasChave: ["buscar", "procurar", "pesquisa", "ctrl k"],
  },
  {
    slug: "tema-claro-escuro",
    titulo: "Trocar entre tema claro e escuro",
    categoria: "Primeiros passos",
    resumo: "Escolha o visual que fica melhor para os seus olhos e para o ambiente da loja.",
    secoes: [
      {
        passos: [
          "No topo da tela, toque no ícone de sol (ou de lua).",
          "O sistema troca na hora e lembra da escolha neste aparelho.",
        ],
      },
    ],
    palavrasChave: ["tema", "escuro", "claro", "dark", "cor"],
  },

  // ── Ordens de Serviço ───────────────────────────────────────────────
  {
    slug: "abrir-os",
    titulo: "Abrir uma ordem de serviço",
    categoria: "Ordens de Serviço",
    resumo: "Registrar a entrada de um aparelho, no computador ou no celular.",
    secoes: [
      {
        titulo: "No computador",
        passos: [
          "Vá em Ordens de Serviço e clique em \"Nova Ordem de Serviço\".",
          "Passo 1 — Cliente e aparelho: busque o cliente (ou \"Cadastrar novo cliente\") e preencha o aparelho, a senha e o desenho de desbloqueio, se houver.",
          "Passo 2 — Entrada: o relato do cliente, a condição física, os acessórios e as fotos.",
          "Passo 3 — Orçamento: opcional; dá para lançar as peças agora ou depois.",
          "Salve: o número da OS é gerado na hora.",
        ],
      },
      {
        titulo: "No celular",
        passos: [
          "Em Ordens de Serviço, toque em \"Nova Ordem de Serviço\": abre uma tela só.",
          "Preencha Cliente, Aparelho e Defeito (os únicos obrigatórios).",
          "Se quiser: observações, senha (números/letras ou desenho), foto do aparelho e pré-orçamento.",
          "Toque em \"Abrir OS\": a OS criada abre em seguida.",
        ],
      },
    ],
    dicas: [
      "Cliente novo pode ser cadastrado ali mesmo, só com nome e telefone.",
      "No desenho de desbloqueio, toque os pontos na ordem; o número de cada ponto aparece para o técnico.",
    ],
    destino: { rotulo: "Ir para Ordens de Serviço", href: "/os" },
    palavrasChave: ["nova os", "entrada", "aparelho", "defeito", "orçamento", "senha", "desenho"],
  },
  {
    slug: "acompanhar-os",
    titulo: "Acompanhar e mover as OS de etapa",
    categoria: "Ordens de Serviço",
    resumo: "Ver em que pé está cada OS e passá-la de Orçamento para Conserto e Pronto.",
    secoes: [
      {
        passos: [
          "Em Ordens de Serviço → Em andamento, escolha \"Quadro\" (colunas por etapa) ou \"Lista\" (tabela, como no Bling).",
          "Para mudar de etapa, use os botões do cartão: eles dizem para onde a OS vai (\"Conserto →\", \"← Orçamento\").",
          "No computador também dá para arrastar o cartão de uma coluna para outra.",
          "No celular, toque na etapa no topo do quadro para ver as OS dela.",
          "Para entregar, use \"Entregar e finalizar\" no cartão: a OS sai do quadro e vai para \"Finalizadas\".",
        ],
      },
    ],
    dicas: [
      "Na Lista, ordene por \"Parada\" para ver primeiro a OS que está há mais dias sem movimento.",
      "Cada pessoa escolhe Quadro ou Lista; o sistema lembra da escolha.",
    ],
    destino: { rotulo: "Ir para OS em andamento", href: "/os" },
    palavrasChave: ["kanban", "quadro", "lista", "etapa", "status", "mover", "arrastar"],
  },
  {
    slug: "entregar-os",
    titulo: "Entregar e finalizar uma OS",
    categoria: "Ordens de Serviço",
    resumo: "Encerrar o serviço quando o cliente busca o aparelho, com a garantia já emitida.",
    secoes: [
      {
        passos: [
          "Abra a OS (ou use o cartão no quadro) e clique em \"Entregar e finalizar\".",
          "Confira o prazo de garantia (em dias) e confirme.",
          "O termo de garantia é emitido na entrega e já pode ser impresso.",
          "Para cobrar, use \"Faturar venda\" na OS.",
        ],
      },
    ],
    dicas: ["As OS entregues ficam em Ordens de Serviço → Finalizadas."],
    destino: { rotulo: "Ir para OS em andamento", href: "/os" },
    palavrasChave: ["finalizar", "entregar", "concluir", "garantia", "faturar", "cobrar"],
  },
  {
    slug: "imprimir-os-e-qr",
    titulo: "Imprimir a OS e abrir pelo QR code",
    categoria: "Ordens de Serviço",
    resumo: "Imprimir a via da OS e abrir a OS no celular lendo o QR code do papel.",
    secoes: [
      {
        titulo: "Imprimir",
        passos: [
          "Abra a OS e clique em \"Imprimir\".",
          "Escolha o modelo: A4 (folha comum) ou térmica (cupom).",
          "A via sai com a logo, o número da OS, o QR code e as assinaturas.",
        ],
      },
      {
        titulo: "Abrir pelo QR code",
        passos: [
          "No celular, toque no ícone de QR code no topo da tela (\"Ler QR code da OS\").",
          "Aponte a câmera para o QR code impresso: a OS abre sozinha.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Ordens de Serviço", href: "/os" },
    palavrasChave: ["imprimir", "impressão", "qr", "qrcode", "etiqueta", "a4", "térmica", "cupom"],
  },
  {
    slug: "fotos-do-aparelho",
    titulo: "Tirar fotos do aparelho",
    categoria: "Ordens de Serviço",
    resumo: "Registrar o estado do aparelho na entrada, durante o reparo e na entrega.",
    secoes: [
      {
        passos: [
          "Na nova OS (ou na seção \"Fotos do aparelho\" da OS), toque em \"Tirar foto\": a câmera abre direto.",
          "Para uma foto que já está no celular, use \"Galeria\".",
          "No computador, \"Enviar pelo celular\" mostra um QR code: o técnico lê e manda as fotos pelo telefone.",
        ],
      },
    ],
    dicas: [
      "As fotos dependem do armazenamento de fotos estar configurado (Configurações → Armazenamento de fotos).",
    ],
    destino: { rotulo: "Ir para Ordens de Serviço", href: "/os" },
    palavrasChave: ["foto", "câmera", "camera", "galeria", "imagem"],
  },
  {
    slug: "garantias",
    titulo: "Consultar garantias",
    categoria: "Ordens de Serviço",
    resumo: "Ver as garantias em vigor e imprimir de novo um termo.",
    secoes: [
      {
        passos: [
          "Vá em Ordens de Serviço → Garantias.",
          "Busque pela OS ou pelo cliente para ver o prazo e a situação.",
          "Na OS entregue, o termo de garantia pode ser impresso a qualquer momento.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Garantias", href: "/os?modo=garantia" },
    palavrasChave: ["garantia", "termo", "retorno", "prazo"],
  },
  {
    slug: "relatorio-de-pecas",
    titulo: "Ver o lucro das peças",
    categoria: "Ordens de Serviço",
    resumo: "Comparar o custo das peças com o valor cobrado, por tipo e marca.",
    secoes: [
      {
        passos: [
          "Vá em Ordens de Serviço → Relatório de peças.",
          "Escolha o período no botão de datas.",
          "Veja o custo, o valor cobrado e a sobra de cada tipo e marca de peça.",
        ],
      },
    ],
    destino: { rotulo: "Ir para o Relatório de peças", href: "/os/relatorio-pecas" },
    palavrasChave: ["peças", "custo", "lucro", "margem", "relatório"],
  },

  // ── Vendas e caixa ──────────────────────────────────────────────────
  {
    slug: "vender-no-pdv",
    titulo: "Fazer uma venda no PDV",
    categoria: "Vendas e caixa",
    resumo: "Vender um produto no balcão, pelo leitor de código de barras ou pela busca.",
    secoes: [
      {
        titulo: "No computador",
        passos: [
          "Vá em PDV. Se o caixa estiver fechado, clique em \"Abrir Caixa\", informe o dinheiro da gaveta e \"Confirmar Abertura\".",
          "Produto: passe o leitor ou busque por nome, SKU ou código de barras.",
          "Cliente: escolha o cliente (ou deixe Consumidor Final).",
          "Pagamento: escolha a forma (PIX, dinheiro, cartão) e clique em \"Confirmar venda\" (atalho F9).",
          "Ao concluir, imprima o recibo ou envie pelo WhatsApp.",
        ],
      },
      {
        titulo: "No celular",
        passos: [
          "Em PDV, escolha o cliente (no celular ele é obrigatório).",
          "Toque em \"Ler código de barras\" e aponte para a etiqueta: cada produto lido entra na venda.",
          "Toque na forma de pagamento (no dinheiro, informe o valor recebido para ver o troco).",
          "Toque em \"Finalizar venda\" e depois em \"Imprimir recibo\".",
        ],
      },
    ],
    dicas: ["Produto sem estoque não aparece no PDV: dê entrada no estoque primeiro."],
    destino: { rotulo: "Ir para o PDV", href: "/pdv" },
    palavrasChave: ["venda", "vender", "balcão", "pdv", "leitor", "código de barras", "recibo", "troco"],
  },
  {
    slug: "abrir-e-fechar-caixa",
    titulo: "Abrir e fechar o caixa",
    categoria: "Vendas e caixa",
    resumo: "Começar o dia com o caixa aberto e conferir a gaveta no fechamento.",
    secoes: [
      {
        passos: [
          "Abrir: no PDV, clique em \"Abrir Caixa\", informe o dinheiro que está na gaveta e \"Confirmar Abertura\".",
          "Acompanhar: no PDV, \"Caixa e fechamento\" mostra as vendas do dia e o dinheiro esperado na gaveta.",
          "Fechar: na aba \"Fechar caixa\", informe quanto tem em dinheiro na gaveta; o sistema mostra se sobra ou falta. Depois, \"Confirmar fechamento\".",
        ],
      },
    ],
    dicas: ["Se o fechamento automático estiver ligado, o sistema fecha o caixa sozinho no horário configurado."],
    destino: { rotulo: "Ir para o Caixa", href: "/pdv/caixa" },
    palavrasChave: ["caixa", "abertura", "fechamento", "gaveta", "sangria", "suprimento"],
  },
  {
    slug: "consultar-vendas",
    titulo: "Consultar as vendas",
    categoria: "Vendas e caixa",
    resumo: "Ver tudo o que foi vendido no balcão e por pedido, com filtros.",
    secoes: [
      {
        passos: [
          "Vá em Vendas.",
          "Filtre por cliente, vendedor, situação e período, e clique em \"Aplicar filtros\".",
          "Clique numa venda para ver os itens e os pagamentos.",
          "Para uma venda por pedido, use \"Novo pedido\".",
        ],
      },
    ],
    destino: { rotulo: "Ir para Vendas", href: "/vendas" },
    palavrasChave: ["vendas", "histórico", "pedido", "relatório de vendas"],
  },

  // ── Clientes e propostas ────────────────────────────────────────────
  {
    slug: "cadastrar-cliente",
    titulo: "Cadastrar um cliente",
    categoria: "Clientes e propostas",
    resumo: "Registrar cliente ou fornecedor, com os dados que aparecem nos documentos.",
    secoes: [
      {
        passos: [
          "Vá em Clientes (CRM) e clique em \"Novo Contato\".",
          "Preencha nome e telefone (obrigatórios); CPF/CNPJ e endereço são opcionais.",
          "Escolha se é cliente ou fornecedor e salve.",
        ],
      },
    ],
    dicas: ["Também dá para cadastrar o cliente na hora, dentro da nova OS ou do PDV."],
    destino: { rotulo: "Ir para Clientes", href: "/crm" },
    palavrasChave: ["cliente", "cadastro", "fornecedor", "contato", "crm"],
  },
  {
    slug: "fazer-proposta",
    titulo: "Fazer uma proposta",
    categoria: "Clientes e propostas",
    resumo: "Montar um orçamento formal em PDF para o cliente.",
    secoes: [
      {
        passos: [
          "Vá em Clientes (CRM) → Propostas e clique em \"Nova proposta\".",
          "Preencha o cliente, a validade e os itens com quantidade e preço.",
          "Defina as condições de pagamento e os termos de garantia.",
          "Clique em \"Salvar Proposta\" (ou \"Salvar como Rascunho\" para terminar depois).",
          "Abra a proposta para imprimir ou enviar o PDF: ele sai com a sua assinatura, se você tiver cadastrado uma.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Propostas", href: "/crm/propostas" },
    palavrasChave: ["proposta", "orçamento", "pdf", "cotação"],
  },

  // ── Estoque ─────────────────────────────────────────────────────────
  {
    slug: "cadastrar-produto",
    titulo: "Cadastrar um produto",
    categoria: "Estoque",
    resumo: "Registrar um produto com preço, custo, estoque e código de barras.",
    secoes: [
      {
        passos: [
          "Vá em Estoque e clique em \"Novo produto\".",
          "Preencha nome, categoria, custo, preço de venda e estoque mínimo.",
          "Informe o código de barras da etiqueta: é ele que o leitor do PDV reconhece.",
          "Salve.",
        ],
      },
    ],
    dicas: ["Para cadastrar muitos produtos de uma vez, com o custo certo, use a Entrada de nota."],
    destino: { rotulo: "Ir para Estoque", href: "/estoque" },
    palavrasChave: ["produto", "cadastro", "estoque", "código de barras", "preço"],
  },
  {
    slug: "estoque-em-massa",
    titulo: "Alterar vários produtos de uma vez",
    categoria: "Estoque",
    resumo: "Imprimir etiquetas, mudar preço, categoria ou estoque mínimo de muitos produtos juntos.",
    secoes: [
      {
        passos: [
          "Em Estoque, marque a caixinha ao lado de cada produto (ou a do topo da tabela, para marcar a página toda).",
          "Dá para trocar de página ou de filtro e continuar marcando: a seleção fica guardada.",
          "Na barra que aparece embaixo, escolha: Etiquetas, Preço, Categoria, Estoque mínimo ou Desativar.",
          "No preço, confira a prévia (preço atual → novo) antes de clicar em \"Aplicar\".",
        ],
      },
    ],
    dicas: [
      "Preço por % aceita número negativo para baixar (ex.: -10).",
      "\"Arredondar para ,90\" deixa os preços com final ,90 (37,12 vira 37,90).",
      "Nas etiquetas, \"Uma por unidade em estoque\" imprime a quantidade certa para etiquetar tudo que está na prateleira.",
    ],
    destino: { rotulo: "Ir para Estoque", href: "/estoque" },
    palavrasChave: ["massa", "vários", "lote", "etiquetas", "reajuste", "preço", "aumentar", "categoria", "selecionar"],
  },
  {
    slug: "entrada-de-nota",
    titulo: "Dar entrada em uma nota de compra",
    categoria: "Estoque",
    resumo: "Lançar no estoque os produtos de uma nota do fornecedor, de uma vez.",
    secoes: [
      {
        passos: [
          "Vá em Estoque → Entrada de nota.",
          "Envie o arquivo da nota (XML ou PDF).",
          "Confira os itens: o sistema liga cada um a um produto do seu cadastro (\"VINCULAR\") ou cria um produto novo.",
          "Confira custo, frete e preço de venda e clique em \"Lançar no estoque\".",
        ],
      },
    ],
    destino: { rotulo: "Ir para Entrada de nota", href: "/estoque/notas/nova" },
    palavrasChave: ["nota", "xml", "compra", "fornecedor", "entrada"],
  },

  // ── Financeiro ──────────────────────────────────────────────────────
  {
    slug: "contas-a-receber",
    titulo: "Lançar e receber uma conta",
    categoria: "Financeiro",
    resumo: "Registrar o que o cliente deve e dar baixa quando ele pagar.",
    secoes: [
      {
        passos: [
          "Vá em Financeiro → Contas a Receber.",
          "Para lançar, clique em \"Nova Conta\".",
          "Quando o cliente pagar, marque a conta na lista e use \"Dar baixa\".",
        ],
      },
    ],
    destino: { rotulo: "Ir para Contas a Receber", href: "/financeiro/receber" },
    palavrasChave: ["receber", "conta", "baixa", "cobrança", "fiado"],
  },
  {
    slug: "contas-a-pagar",
    titulo: "Lançar e pagar uma despesa",
    categoria: "Financeiro",
    resumo: "Registrar as despesas da loja e marcar quando forem pagas.",
    secoes: [
      {
        passos: [
          "Vá em Financeiro → Contas a Pagar.",
          "Clique em \"Nova Despesa\" e preencha a descrição, o valor e o vencimento.",
          "Quando pagar, use \"Pagar\" na despesa.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Contas a Pagar", href: "/financeiro/pagar" },
    palavrasChave: ["pagar", "despesa", "boleto", "conta"],
  },
  {
    slug: "agenda",
    titulo: "Agendar um compromisso",
    categoria: "Financeiro",
    resumo: "Marcar compromissos da loja, ver vencimentos e prazos de meta no mesmo calendário.",
    secoes: [
      {
        passos: [
          "Abra a Agenda no menu.",
          "Clique em \"Novo compromisso\", dê um título, escolha a data e o horário (ou marque \"Dia inteiro\").",
          "Escolha quando avisar no sininho (por exemplo, 1 hora antes) e clique em \"Agendar\".",
          "No dia, use ✓ para marcar como feito, o lápis para editar ou a lixeira para remover.",
        ],
      },
    ],
    dicas: [
      "Contas a receber e a pagar pendentes e os prazos das metas aparecem sozinhos na agenda, com cores diferentes.",
      "Os próximos 7 dias aparecem também no Dashboard.",
    ],
    destino: { rotulo: "Ir para a Agenda", href: "/agenda" },
    palavrasChave: ["agenda", "compromisso", "agendar", "calendário", "lembrete", "aviso", "reunião", "horário"],
  },
  {
    slug: "taxas-de-cartao",
    titulo: "Ver quanto foi gasto em taxas de cartão",
    categoria: "Financeiro",
    resumo: "A taxa da maquininha de cada venda já sai das saídas e do resultado do mês.",
    secoes: [
      {
        passos: [
          "Vá em Financeiro → Fluxo e relatórios → \"Taxas de cartão\".",
          "Veja o total gasto no mês, quanto foi vendido no cartão e a taxa média.",
          "A tabela separa por débito, crédito à vista e crédito parcelado (2x, 3x…).",
        ],
      },
    ],
    dicas: [
      "As taxas vêm de Configurações → PDV e Caixa → Taxas e vencimentos. Se a maquininha mudar de preço, atualize lá.",
      "Venda estornada não conta taxa.",
    ],
    destino: { rotulo: "Ir para Fluxo e relatórios", href: "/financeiro/fluxo" },
    palavrasChave: ["taxa", "cartão", "maquininha", "débito", "crédito", "parcelado", "desconto"],
  },
  {
    slug: "metas",
    titulo: "Criar metas",
    categoria: "Financeiro",
    resumo: "Definir metas de venda ou de serviço e acompanhar o progresso.",
    secoes: [
      {
        passos: [
          "Vá em Metas e clique em \"Nova meta\".",
          "Escolha o que medir, o valor alvo e o período.",
          "Use \"Atualizar metas automáticas\" para recalcular as que seguem as vendas.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Metas", href: "/metas" },
    palavrasChave: ["meta", "objetivo", "alvo"],
  },

  // ── Ferramentas ─────────────────────────────────────────────────────
  {
    slug: "remocao-de-virus",
    titulo: "Remover vírus e anúncios de um Android",
    categoria: "Ordens de Serviço",
    resumo: "Conectar o celular pelo cabo, achar os apps de anúncio e remover pelo sistema.",
    secoes: [
      {
        passos: [
          "No celular: Configurações → Sobre o telefone → toque 7 vezes em \"Número de compilação\" (Samsung: Informações do software).",
          "Em Opções do desenvolvedor, ligue a \"Depuração USB\" e ligue o celular no computador com cabo de dados.",
          "No computador, abra o TechOS no Chrome ou no Edge e vá em Ferramentas → Remoção de Vírus.",
          "Clique em \"Selecionar celular\", escolha o aparelho e toque em \"Permitir\" no celular.",
          "Clique em \"Verificar apps\". Os suspeitos aparecem primeiro, com o motivo de cada um.",
          "Use \"Remover\" (apaga o app) ou \"Bloquear\" (desativa sem apagar). Ao final, \"Copiar relatório\" e cole na OS.",
        ],
      },
    ],
    dicas: [
      "Não sabe qual app abre o anúncio? Espere o anúncio aparecer e clique em \"Qual app está na tela?\".",
      "Se o app for administrador do dispositivo, o sistema bloqueia ele e abre no celular a tela de administradores: desative ali e clique em Remover de novo.",
      "Anúncio não deixa entrar nas Configurações? Reinicie no Modo de Segurança (segure \"Desligar\" no menu de energia; Samsung e Xiaomi: ligue segurando volume para baixo). Lá o vírus não roda.",
      "Atalho: na lupa das Configurações, busque \"compilação\" (toque 7 vezes) e depois \"depuração\".",
      "Ao terminar, desligue a Depuração USB do cliente.",
      "Só Android. iPhone não permite remover apps pelo cabo.",
    ],
    destino: { rotulo: "Abrir a Remoção de Vírus", href: "/ferramentas/remocao-de-virus" },
    palavrasChave: ["vírus", "virus", "anúncio", "propaganda", "adware", "malware", "limpar", "usb", "adb", "ferramentas"],
  },

  {
    slug: "rom-samsung",
    titulo: "Ver e baixar a ROM de um Samsung",
    categoria: "Ordens de Serviço",
    resumo: "Saber a versão mais recente da Samsung para o modelo e baixar a ROM pelo Bifrost.",
    secoes: [
      {
        passos: [
          "Vá em Ferramentas → Rom Samsung.",
          "Digite o modelo (ex.: SM-A155M) e escolha a região — ZTO para aparelho livre do Brasil. Ou clique em \"Ler do celular no cabo\" (precisa da Depuração USB).",
          "Clique em Consultar: aparece a versão mais recente, o Android, o mês e o binário.",
          "Com o celular no cabo, o sistema diz se ele está desatualizado e se o binário permite gravar.",
          "Baixe a ROM pelo Bifrost (gratuito, instalado no computador) com o modelo e a região copiados da tela, e grave com o Odin.",
        ],
      },
    ],
    dicas: [
      "Binário: não dá para gravar ROM com binário menor que o do celular.",
      "No Odin, use o HOME_CSC para manter os dados do cliente.",
      "\"Copiar para a OS\" gera o texto com a versão gravada para as observações da OS.",
    ],
    destino: { rotulo: "Abrir a Rom Samsung", href: "/ferramentas/rom-samsung" },
    palavrasChave: ["rom", "firmware", "samsung", "odin", "bifrost", "atualizar", "binário", "csc", "ferramentas"],
  },

  // ── Equipe e configurações ──────────────────────────────────────────
  {
    slug: "novo-usuario",
    titulo: "Cadastrar um funcionário",
    categoria: "Equipe e configurações",
    resumo: "Dar acesso ao sistema para uma pessoa da equipe.",
    secoes: [
      {
        passos: [
          "Clique na sua foto no canto de cima e vá em Configurações → Usuários e Cargos.",
          "Clique em \"Novo usuário\" e preencha nome, e-mail e cargo.",
          "A senha inicial já vem sugerida (fácil de ditar); clique em \"Cadastrar usuário\".",
          "Use \"Copiar acesso\" para mandar o e-mail e a senha para a pessoa.",
        ],
      },
    ],
    dicas: ["O cargo define o que a pessoa vê e pode fazer. Os cargos ficam na aba \"Cargos\"."],
    destino: { rotulo: "Ir para Configurações", href: "/configuracoes" },
    palavrasChave: ["usuário", "funcionário", "acesso", "login", "cargo", "permissão", "equipe"],
  },
  {
    slug: "logo-da-loja",
    titulo: "Colocar a logo da loja",
    categoria: "Equipe e configurações",
    resumo: "A logo aparece no sistema e em todos os documentos.",
    secoes: [
      {
        passos: [
          "Vá em Configurações → Empresa.",
          "Clique em \"Enviar logo\" e escolha o arquivo (PNG, JPG ou WEBP, até 5 MB).",
          "A logo aparece na hora na barra lateral, na OS, no termo, no cupom e na proposta.",
        ],
      },
    ],
    dicas: ["Logo horizontal com fundo transparente (PNG) fica melhor."],
    destino: { rotulo: "Ir para Configurações", href: "/configuracoes" },
    palavrasChave: ["logo", "marca", "empresa", "identidade"],
  },
  {
    slug: "minha-assinatura",
    titulo: "Cadastrar a minha assinatura",
    categoria: "Equipe e configurações",
    resumo: "Sua assinatura sai pronta na OS, no termo de garantia e nas propostas.",
    secoes: [
      {
        passos: [
          "Clique na sua foto no canto de cima e vá em Meu Perfil.",
          "Em \"Minha assinatura\", toque em \"Assinar na tela\" e assine com o dedo ou o mouse.",
          "Toque em \"Salvar assinatura\". Se preferir, use \"Enviar imagem\".",
        ],
      },
    ],
    dicas: [
      "Na OS e no termo sai a assinatura do técnico principal; na proposta, a de quem gera o PDF.",
    ],
    destino: { rotulo: "Ir para Meu Perfil", href: "/perfil" },
    palavrasChave: ["assinatura", "assinar", "rubrica"],
  },
  {
    slug: "trocar-senha",
    titulo: "Trocar a minha senha",
    categoria: "Equipe e configurações",
    resumo: "Alterar a senha de acesso ao sistema.",
    secoes: [
      {
        passos: [
          "Clique na sua foto no canto de cima e vá em Meu Perfil.",
          "Em \"Alterar Senha\", informe a senha atual e a nova (mínimo de 8 caracteres, com letras e números).",
          "Salve. As suas outras sessões abertas são encerradas.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Meu Perfil", href: "/perfil" },
    palavrasChave: ["senha", "password", "acesso", "trocar"],
  },
  {
    slug: "apagar-dados-do-cliente",
    titulo: "Cliente pediu para apagar os dados dele (LGPD)",
    categoria: "Equipe e configurações",
    resumo: "Remover nome, documento, contato e endereço, mantendo o histórico obrigatório.",
    secoes: [
      {
        passos: [
          "Em Clientes (CRM), abra o menu (⋯) do cliente e escolha \"Apagar dados pessoais (LGPD)\".",
          "Confirme. Nome, CPF/CNPJ, telefone, e-mail, endereço e observações são apagados, e a senha dos aparelhos nas OS dele também.",
          "O histórico de OS, vendas e notas continua, sem identificar a pessoa — a loja precisa guardá-lo por garantia e obrigação fiscal.",
          "Não tem como desfazer. Precisa da permissão de excluir clientes.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Clientes", href: "/crm" },
    palavrasChave: ["lgpd", "apagar", "dados pessoais", "privacidade", "anonimizar", "excluir cliente"],
  },
  {
    slug: "importar-planilha",
    titulo: "Importar clientes ou produtos de uma planilha",
    categoria: "Equipe e configurações",
    resumo: "Trazer sua lista do Excel ou do Google Planilhas de uma vez, sem digitar um por um.",
    secoes: [
      {
        passos: [
          "Em Clientes (CRM) ou em Estoque, no computador, clique em \"Importar planilha\".",
          "Baixe a planilha-modelo e preencha uma linha por cliente ou produto (pode colar da sua planilha atual).",
          "Salve como CSV: no Excel, Arquivo → Salvar como → CSV; no Google Planilhas, Arquivo → Fazer download → CSV.",
          "Escolha o arquivo. A tela mostra cada linha: as prontas e as com problema, com o número da linha na planilha.",
          "Clique em \"Importar\". O que já existia é pulado, então pode importar a mesma planilha de novo depois de corrigir.",
          "Produtos: categorias que não existem são criadas, o SKU é gerado e a quantidade entra como saldo inicial.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Clientes", href: "/crm" },
    palavrasChave: ["importar", "planilha", "excel", "csv", "lista", "migrar", "cadastro em massa"],
  },
  {
    slug: "esqueci-a-senha",
    titulo: "Alguém esqueceu a senha",
    categoria: "Equipe e configurações",
    resumo: "Gerar uma senha nova para um funcionário, ou pedir o link por e-mail.",
    secoes: [
      {
        titulo: "Pelo administrador",
        passos: [
          "Vá em Configurações → Usuários e Cargos.",
          "Na linha da pessoa, toque em \"Nova senha\". A senha já vem sugerida — pode trocar se quiser.",
          "Toque em \"Gerar nova senha\" e use \"Copiar acesso\" para mandar o e-mail e a senha para ela.",
          "Os acessos que a pessoa tinha abertos são encerrados; ela entra de novo com a senha nova.",
        ],
      },
      {
        titulo: "Pela própria pessoa",
        passos: [
          "Na tela de login, toque em \"Esqueci minha senha\" e informe o e-mail.",
          "Chega um link (vale 30 minutos). Ele abre a tela para criar a senha nova.",
          "Só funciona depois que o envio de e-mail do sistema estiver configurado; até lá, a tela orienta a falar com o administrador.",
        ],
      },
    ],
    destino: { rotulo: "Ir para Configurações", href: "/configuracoes" },
    palavrasChave: ["senha", "esqueci", "recuperar", "nova senha", "bloqueado", "acesso"],
  },
];

/** Minusculo e sem acento, para a busca achar "orcamento" e "orçamento". */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Busca: cada palavra digitada precisa aparecer em algum lugar do guia
 * (titulo, resumo, passos ou palavras-chave). O titulo pesa mais na ordem.
 */
export function buscarArtigos(termo: string, artigos: readonly ArtigoAjuda[] = ARTIGOS_AJUDA): ArtigoAjuda[] {
  const palavras = normalizar(termo).split(/\s+/).filter((p) => p.length >= 2);
  if (palavras.length === 0) return [...artigos];

  const comPontos = artigos
    .map((artigo) => {
      const titulo = normalizar(artigo.titulo);
      const resto = normalizar(
        [artigo.resumo, ...(artigo.palavrasChave ?? []), ...artigo.secoes.flatMap((s) => s.passos), ...(artigo.dicas ?? [])].join(" ")
      );
      if (!palavras.every((p) => titulo.includes(p) || resto.includes(p))) return null;
      const pontos = palavras.reduce((total, p) => total + (titulo.includes(p) ? 3 : 1), 0);
      return { artigo, pontos };
    })
    .filter((item): item is { artigo: ArtigoAjuda; pontos: number } => item !== null);

  return comPontos.sort((a, b) => b.pontos - a.pontos).map((item) => item.artigo);
}

export function artigoPeloSlug(slug: string): ArtigoAjuda | undefined {
  return ARTIGOS_AJUDA.find((artigo) => artigo.slug === slug);
}
