/**
 * Termos de Uso e Politica de Privacidade do Konext ERP.
 *
 * ATENCAO: texto-modelo escrito para a realidade do produto (assistencias
 * tecnicas que usam o Konext para atender os proprios clientes). Precisa da
 * revisao de um advogado antes de o Konext ser vendido para outras lojas —
 * em especial os dados da empresa responsavel e o canal de contato, que
 * devem ser completados com os dados oficiais.
 */

export const VIGENTE_DESDE = "13/11/2026";

export type SecaoLegal = { titulo: string; paragrafos: string[] };

export const TERMOS_DE_USO: SecaoLegal[] = [
  {
    titulo: "1. O que é o Konext",
    paragrafos: [
      "O Konext ERP é um sistema de gestão para assistências técnicas, oferecido pela Konext Tech, usado pela internet. Ele organiza ordens de serviço, garantias, vendas, estoque, financeiro e o cadastro de clientes da loja que o contrata.",
    ],
  },
  {
    titulo: "2. Quem pode usar",
    paragrafos: [
      "O acesso é criado pela loja contratante para as pessoas da equipe dela. Cada pessoa usa o próprio e-mail e a própria senha, e não deve compartilhá-los.",
      "A loja é responsável pelo que a equipe dela faz no sistema e por manter os acessos em dia (criar, desativar e definir o que cada cargo pode fazer).",
    ],
  },
  {
    titulo: "3. Os dados são da loja",
    paragrafos: [
      "Os dados cadastrados — clientes, ordens de serviço, vendas, produtos e lançamentos — pertencem à loja. A Konext Tech os guarda e processa somente para fazer o sistema funcionar para ela.",
      "Cada loja tem um banco de dados próprio, separado das demais.",
    ],
  },
  {
    titulo: "4. Uso correto",
    paragrafos: [
      "Não é permitido usar o sistema para fins ilegais, tentar acessar dados de outras lojas, contornar as travas de segurança ou sobrecarregar o serviço de propósito.",
      "A loja deve cadastrar dados de clientes com base legal adequada (por exemplo, para prestar o serviço contratado) e informar seus clientes sobre esse uso.",
    ],
  },
  {
    titulo: "5. Disponibilidade e cópias de segurança",
    paragrafos: [
      "O sistema é mantido com cópias de segurança e pontos de restauração do banco de dados. Interrupções podem acontecer por manutenção ou por falhas de fornecedores de infraestrutura; nesses casos, o serviço é restabelecido o quanto antes.",
    ],
  },
  {
    titulo: "6. Planos e módulos",
    paragrafos: [
      "As funcionalidades disponíveis dependem do plano contratado pela loja. Módulos não contratados ficam indisponíveis, sem apagar dados já cadastrados.",
    ],
  },
  {
    titulo: "7. Mudanças nestes termos",
    paragrafos: [
      "Estes termos podem ser atualizados. A data da versão vigente fica no topo desta página.",
    ],
  },
];

export const POLITICA_DE_PRIVACIDADE: SecaoLegal[] = [
  {
    titulo: "1. Papéis de cada um (LGPD)",
    paragrafos: [
      "Nos dados dos clientes da loja (nome, telefone, documento, endereço, aparelhos e serviços), a loja é a controladora: é ela quem decide coletar e para quê. A Konext Tech é a operadora: trata esses dados em nome da loja, só para o sistema funcionar.",
      "Nos dados das pessoas que usam o sistema (nome, e-mail, assinatura e registro de acessos), a Konext Tech trata o necessário para dar acesso, proteger a conta e manter a segurança.",
    ],
  },
  {
    titulo: "2. Que dados o sistema guarda",
    paragrafos: [
      "Dos clientes da loja: os dados de cadastro e de atendimento que a equipe registra, fotos dos aparelhos, ordens de serviço, vendas e garantias.",
      "Dos usuários: nome, e-mail, senha (guardada somente como código irreversível), foto e assinatura de perfil, e o registro de acessos e ações importantes (auditoria).",
    ],
  },
  {
    titulo: "3. Como os dados são protegidos",
    paragrafos: [
      "Conexões criptografadas (HTTPS); banco de dados separado por loja; senhas de acesso guardadas com hash; senha e desenho de desbloqueio dos aparelhos guardados cifrados, com chave separada do banco da loja; limite de tentativas no login; e registro de quem vê a senha de um aparelho.",
      "O acesso de cada pessoa da equipe é limitado pelas permissões do cargo dela.",
    ],
  },
  {
    titulo: "4. Com quem os dados são compartilhados",
    paragrafos: [
      "Somente com os fornecedores de infraestrutura necessários para o sistema funcionar (hospedagem, banco de dados, armazenamento de fotos e, quando a loja ativa, envio de mensagens e integração com emissor de notas fiscais). Os dados não são vendidos nem usados para publicidade.",
    ],
  },
  {
    titulo: "5. Por quanto tempo",
    paragrafos: [
      "Enquanto a loja usar o sistema. Registros que a loja precisa manter por obrigação legal (por exemplo, fiscais e de garantia) ficam guardados pelo prazo exigido.",
    ],
  },
  {
    titulo: "6. Direitos do titular",
    paragrafos: [
      "O cliente de uma loja pode pedir à própria loja para ver, corrigir ou apagar os dados dele. A loja consegue atender pelo sistema: editar o cadastro ou usar \"Apagar dados pessoais (LGPD)\", que remove nome, documento, contato e endereço e mantém o histórico obrigatório sem identificação.",
      "Quem usa o sistema pode alterar os próprios dados em \"Meu perfil\" e pedir à loja a desativação do acesso.",
    ],
  },
  {
    titulo: "7. Contato",
    paragrafos: [
      "Dúvidas sobre os dados de um atendimento: fale com a loja que prestou o serviço. Dúvidas sobre o sistema: fale com a Konext Tech pelo canal informado na contratação.",
    ],
  },
];
