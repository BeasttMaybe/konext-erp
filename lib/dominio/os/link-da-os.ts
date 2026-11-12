/**
 * O endereco de uma OS, e como reconhece-lo num QR code lido.
 *
 * O QR impresso na OS carrega a URL COMPLETA (`https://<sistema>/os/<id>`),
 * para funcionar de dois jeitos: pela camera comum do iPhone, que reconhece
 * link sozinha, e pelo leitor de dentro do app.
 *
 * O leitor de dentro do app NUNCA segue o link lido. Ele extrai so o id da
 * OS e navega para o caminho interno. Um QR de outro site — colado por cima
 * de uma etiqueta, por exemplo — nao leva o sistema a lugar nenhum fora dele.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function caminhoDaOS(osId: string): string {
  return `/os/${osId}`;
}

/** O id da OS que um QR lido aponta, ou `null` se nao for um QR de OS. */
export function idDaOSNoQrLido(lido: string): string | null {
  const texto = lido.trim();
  if (texto === "") return null;

  let caminho: string;
  try {
    // Aceita URL completa (de qualquer dominio — so o id e aproveitado) e
    // tambem o caminho sozinho.
    caminho = new URL(texto, "https://interno.invalid").pathname;
  } catch {
    return null;
  }

  const partes = caminho.split("/").filter(Boolean);
  if (partes.length !== 2 || partes[0] !== "os") return null;

  return UUID.test(partes[1]) ? partes[1].toLowerCase() : null;
}
