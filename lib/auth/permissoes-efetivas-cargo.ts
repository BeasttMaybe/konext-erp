import { CATALOGO_PERMISSOES, ehPermissao, type Permissao } from "./permissoes";

/**
 * Permissoes efetivas de um Cargo: catalogo inteiro se fixo (Administrador),
 * senao as linhas gravadas em CargoPermissao. Modulo separado (nao dentro de
 * app/actions/cargos.ts) porque e uma funcao sincrona pura, e todo export de
 * um arquivo "use server" precisa ser async (regra de Server Actions do
 * Next) — varias actions (cargos.ts, usuarios.ts) precisam dela.
 */
export function permissoesEfetivasDoCargo(cargo: { fixo: boolean; permissoes: { permissao: string }[] }): Permissao[] {
  if (cargo.fixo) {
    return [...CATALOGO_PERMISSOES];
  }
  return cargo.permissoes.map((linha) => linha.permissao).filter(ehPermissao);
}
