/**
 * Formato de IMEI/nº de série na Fase 3-2B, Parte 4: dígitos, letras e os
 * separadores comuns em números de série (espaço e hífen). Um caso real em
 * produção tinha um e-mail digitado nesse campo — "@" e "." não fazem parte
 * de nenhum formato de IMEI/série real, então ficam de fora de propósito.
 * Campo opcional: string vazia é sempre válida. Não migra nem valida
 * registros existentes — só a entrada nova passa por aqui.
 */
const FORMATO_IMEI_VALIDO = /^[A-Za-z0-9 -]*$/;

export type ResultadoValidacaoImei = { valido: true } | { valido: false; mensagem: string };

export function validarFormatoImei(valor: string | null | undefined): ResultadoValidacaoImei {
  const normalizado = String(valor ?? "").trim();

  if (!normalizado) return { valido: true };

  if (!FORMATO_IMEI_VALIDO.test(normalizado)) {
    return {
      valido: false,
      mensagem: "IMEI/nº de série deve conter apenas letras, números, espaço ou hífen.",
    };
  }

  return { valido: true };
}
