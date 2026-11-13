/**
 * Senha facil de ditar: sem letras que se confundem (l/1, O/0) e sempre com
 * letra e numero, para passar na regra de senha nova. Usada ao criar usuario
 * e ao gerar senha nova pelo administrador.
 */
export function gerarSenhaSugerida(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const sorteio = new Uint32Array(8);
  crypto.getRandomValues(sorteio);
  const parte = (alfabeto: string, de: number, ate: number) =>
    Array.from(sorteio.slice(de, ate), (n) => alfabeto[n % alfabeto.length]).join("");
  return `${parte(letras, 0, 5)}${parte(numeros, 5, 8)}`;
}
