/**
 * Regras das fotos do aparelho na OS.
 *
 * O que decide quase tudo aqui é que a foto existe para resolver discussão com
 * cliente — "o aparelho já veio com essa trinca", "ele saiu daqui funcionando".
 * Por isso o momento importa, por isso nada é obrigatório (a loja não pode
 * travar um atendimento porque a câmera falhou), e por isso o arquivo é
 * reduzido mas não espremido: arranhão fino some antes do que a gente imagina.
 */

/** Espelha `MomentoFotoOS` do schema. */
export type MomentoFoto = "ENTRADA" | "DURANTE" | "SAIDA";

export const MOMENTOS_DA_FOTO: ReadonlyArray<{
  valor: MomentoFoto;
  rotulo: string;
  ajuda: string;
}> = [
  {
    valor: "ENTRADA",
    rotulo: "Na entrada",
    ajuda: "Como o aparelho chegou. É a foto que responde “já veio assim”.",
  },
  {
    valor: "DURANTE",
    rotulo: "Durante o conserto",
    ajuda: "O que foi encontrado por dentro: oxidação, cola, peça anterior.",
  },
  {
    valor: "SAIDA",
    rotulo: "Na entrega",
    ajuda: "Como o aparelho foi devolvido, já montado e testado.",
  },
] as const;

export function rotuloDoMomento(momento: MomentoFoto): string {
  return MOMENTOS_DA_FOTO.find((item) => item.valor === momento)?.rotulo ?? momento;
}

/**
 * Formatos aceitos. HEIC do iPhone não entra: o navegador converte para JPEG
 * ao redimensionar, antes de enviar, e aceitar HEIC no servidor significaria
 * guardar arquivo que boa parte dos navegadores não exibe.
 */
export const TIPOS_DE_IMAGEM_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

export type TipoDeImagemAceito = (typeof TIPOS_DE_IMAGEM_ACEITOS)[number];

export function ehTipoDeImagemAceito(tipo: string): tipo is TipoDeImagemAceito {
  return (TIPOS_DE_IMAGEM_ACEITOS as readonly string[]).includes(tipo);
}

/**
 * Teto do arquivo que chega ao servidor, DEPOIS da redução no navegador.
 *
 * A redução mira uns 300 KB; 2 MB é folga larga para o caso de uma foto que
 * não comprime bem. O limite real por trás é o da função na Vercel, de 4,5 MB
 * no corpo da requisição — ficar perto dele trocaria uma mensagem clara por um
 * erro de plataforma no meio do envio.
 */
export const TAMANHO_MAXIMO_DA_FOTO_EM_BYTES = 2 * 1024 * 1024;

/**
 * Lado maior da imagem depois da redução.
 *
 * 1600px mostra arranhão e trinca com folga numa tela de computador e no zoom
 * do celular. Guardar os 4000px originais multiplicaria o custo por dez sem
 * acrescentar nada que resolva uma discussão.
 */
export const LADO_MAIOR_APOS_REDUCAO = 1600;

/** Qualidade do JPEG na redução. 0,82 é onde a compressão para de aparecer. */
export const QUALIDADE_DA_REDUCAO = 0.82;

/**
 * Teto de fotos por OS.
 *
 * Não é limite técnico: é para a galeria continuar legível e o custo não
 * escapar. Vinte cobre entrada, achados do conserto e entrega com sobra.
 */
export const MAXIMO_DE_FOTOS_POR_OS = 20;

export type ValidacaoDaFoto = { valido: true } | { valido: false; erro: string };

export function validarFoto(entrada: {
  tipoConteudo: string;
  tamanhoBytes: number;
  fotosJaExistentes: number;
}): ValidacaoDaFoto {
  if (!ehTipoDeImagemAceito(entrada.tipoConteudo)) {
    return {
      valido: false,
      erro: "Esse arquivo não é uma imagem JPG, PNG ou WebP.",
    };
  }

  if (entrada.tamanhoBytes <= 0) {
    return { valido: false, erro: "O arquivo chegou vazio. Tente enviar de novo." };
  }

  if (entrada.tamanhoBytes > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) {
    // Formatação pela mesma função da galeria: a tela é em português, e um
    // "2.0 MB" com ponto no meio de uma frase em pt-BR denuncia número
    // montado à mão num canto solto.
    return {
      valido: false,
      erro: `A imagem tem ${formatarTamanho(entrada.tamanhoBytes)}, acima do limite de ${formatarTamanho(TAMANHO_MAXIMO_DA_FOTO_EM_BYTES)}. Isso não deveria acontecer — a foto é reduzida antes de subir, então pode ser um arquivo que não é foto de câmera.`,
    };
  }

  if (entrada.fotosJaExistentes >= MAXIMO_DE_FOTOS_POR_OS) {
    return {
      valido: false,
      erro: `Esta OS já tem ${MAXIMO_DE_FOTOS_POR_OS} fotos, que é o limite. Apague alguma antes de adicionar outra.`,
    };
  }

  return { valido: true };
}

/**
 * O tipo de imagem que os BYTES dizem ser, pela assinatura no comeco do
 * arquivo — ou `null` se nao for nenhum dos aceitos.
 *
 * POR QUE NAO BASTA O `arquivo.type`
 *
 * O tipo que chega no formulario e escrito por quem envia. Um arquivo HTML
 * declarado como `image/jpeg` passava em `validarFoto`, era gravado no bucket
 * e ficava registrado como foto da OS. O envio pelo celular e uma rota sem
 * login: basta ter um link valido na mao para tentar.
 *
 * A assinatura nao pode ser escolhida a vontade por quem envia sem que o
 * arquivo deixe de ser o que ele queria que fosse.
 */
export function tipoRealDaImagem(bytes: Uint8Array): TipoDeImagemAceito | null {
  const comeca = (assinatura: readonly number[], deslocamento = 0) =>
    bytes.length >= deslocamento + assinatura.length &&
    assinatura.every((byte, indice) => bytes[deslocamento + indice] === byte);

  // JPEG: FF D8 FF
  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 "PNG" CR LF 1A LF
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // WebP: "RIFF" <4 bytes de tamanho> "WEBP"
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";

  return null;
}

/**
 * O conteudo e mesmo do tipo declarado?
 *
 * Exige que os dois CONCORDEM, e nao so que o conteudo seja alguma imagem: o
 * tipo declarado e o que vai para o bucket e volta no cabecalho da resposta,
 * entao um PNG declarado como JPEG tambem e recusado.
 */
export function conteudoConfereComOTipo(bytes: Uint8Array, tipoDeclarado: string): boolean {
  const real = tipoRealDaImagem(bytes);
  return real !== null && real === tipoDeclarado;
}

export const ERRO_DE_CONTEUDO_QUE_NAO_E_IMAGEM =
  "O conteúdo desse arquivo não é uma imagem JPG, PNG ou WebP.";

const EXTENSAO_POR_TIPO: Readonly<Record<TipoDeImagemAceito, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Caminho do objeto no bucket: `os/<id da OS>/<id aleatório>.<ext>`.
 *
 * Agrupar por OS não é enfeite — é o que permite olhar o bucket e entender o
 * que é de quem, e apagar o resto de uma OS de uma vez se um dia for preciso.
 *
 * O nome do arquivo é aleatório, e nunca o nome original: nome de arquivo de
 * celular pode conter o que o dono do aparelho escreveu, e o caminho aparece em
 * URL.
 */
export function montarChaveDaFoto(parametros: {
  ordemServicoId: string;
  tipoConteudo: TipoDeImagemAceito;
  identificador: string;
}): string {
  return `os/${parametros.ordemServicoId}/${parametros.identificador}.${EXTENSAO_POR_TIPO[parametros.tipoConteudo]}`;
}

/**
 * Confere que a chave pertence mesmo à OS informada.
 *
 * Existe porque apagar uma foto recebe um id de linha, e a linha carrega a
 * chave: sem esta conferência, uma linha com a chave adulterada apagaria um
 * objeto de outra OS. É barato, e o custo de não ter é apagar foto alheia.
 */
export function chavePertenceAOrdem(chave: string, ordemServicoId: string): boolean {
  return chave.startsWith(`os/${ordemServicoId}/`);
}

/** Validade do link de envio pelo celular. */
export const HORAS_DE_VALIDADE_DO_LINK = 24;

export type SituacaoDoLink = "VALIDO" | "EXPIRADO" | "REVOGADO";

export function situacaoDoLink(token: {
  expiraEm: Date;
  revogadoEm: Date | null;
  agora: Date;
}): SituacaoDoLink {
  // Revogado vem antes de expirado: quem revogou quer saber que revogou, e
  // "expirou" sugeriria que bastava esperar.
  if (token.revogadoEm !== null) return "REVOGADO";
  if (token.expiraEm.getTime() <= token.agora.getTime()) return "EXPIRADO";
  return "VALIDO";
}

/** Tamanho em bytes como se lê: "312 KB", "1,4 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
