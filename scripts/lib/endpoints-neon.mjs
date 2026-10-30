// Endpoints Neon deste projeto, por ambiente. Sao nomes de host — nunca
// credenciais —, os mesmos documentados em AGENTS.md, que e a fonte da verdade.
//
// Ficam num modulo so porque duas coisas dependem deles e divergir seria pior
// que repetir: a conferencia que impede rodar comando no banco errado
// (scripts/verificacao/conferir-conexoes-do-ambiente.mjs) e a resolucao das
// conexoes pela API do Neon (scripts/neon/exportar-conexoes.mjs).

export const ENDPOINTS_NEON = {
  teste: {
    tenant: "ep-purple-field-aq2o0ful",
    central: "ep-weathered-rice-atb8kse4",
  },
  producao: {
    tenant: "ep-orange-recipe-aq2e102u",
    central: "ep-broad-glade-atqpp0f4",
  },
};

export function ambienteValido(ambiente) {
  return Object.prototype.hasOwnProperty.call(ENDPOINTS_NEON, ambiente);
}

export function ambienteOposto(ambiente) {
  return ambiente === "teste" ? "producao" : "teste";
}
