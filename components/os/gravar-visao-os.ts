import { COOKIE_VISAO_OS, type VisaoDaOS } from "@/lib/dominio/os/lista-de-os";

/**
 * Grava a escolha quadro/lista para o servidor ler na proxima abertura.
 * Um ano de validade; so o caminho do proprio sistema; sem dado pessoal.
 */
export function gravarVisaoDaOS(visao: VisaoDaOS): void {
  try {
    document.cookie = `${COOKIE_VISAO_OS}=${visao}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookie bloqueado: a troca vale nesta aba e a proxima abertura volta ao
    // quadro. Nao e motivo para a tela quebrar.
  }
}
