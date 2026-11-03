/**
 * Substituto de `server-only` nos testes.
 *
 * `server-only` nao e um pacote: o bundler do Next resolve o nome e usa o
 * import como marcacao — se um componente de cliente puxar o modulo, o build
 * quebra com uma mensagem explicando por que. Fora do Next o nome nao existe.
 *
 * Este arquivo vazio deixa a marcacao continuar no codigo, onde ela trabalha,
 * sem transformar "modulo so de servidor" em "modulo que nao da pra testar".
 */
export {};
