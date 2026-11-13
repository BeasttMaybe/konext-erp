/**
 * O master tem a raiz do Turbopack no repositorio inteiro (next.config.ts), e
 * sem este arquivo o Next pegaria o instrumentation.ts do ERP, que registra
 * erros com codigo que o master nao tem. Aqui nao ha nada a registrar.
 */
export function register() {}
