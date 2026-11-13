"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { importarClientes, importarProdutos } from "@/app/actions/importacao";
import { Button } from "@/components/ui/button";
import {
  COLUNAS_CLIENTE,
  COLUNAS_PRODUTO,
  converterCliente,
  converterProduto,
  TAMANHO_DO_LOTE_CLIENTES,
  TAMANHO_DO_LOTE_PRODUTOS,
} from "@/lib/importacao/planilha";

import { ModalImportarPlanilha } from "./modal-importar-planilha";

/** Depois de importar, recarrega a lista da tela (as listas buscam no carregamento). */
function recarregarSeCriou(criados: number) {
  if (criados > 0) window.location.reload();
}

export function BotaoImportarClientes() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAberto(true)}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Importar planilha
      </Button>
      <ModalImportarPlanilha
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Importar clientes"
        oQue="clientes"
        colunas={COLUNAS_CLIENTE}
        converter={converterCliente}
        resumir={(r) => [r.nome, r.telefone].filter(Boolean).join(" · ")}
        enviarLote={importarClientes}
        tamanhoDoLote={TAMANHO_DO_LOTE_CLIENTES}
        nomeDoModelo="modelo-clientes-konext.csv"
        onConcluido={recarregarSeCriou}
      />
    </>
  );
}

export function BotaoImportarProdutos() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAberto(true)}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Importar planilha
      </Button>
      <ModalImportarPlanilha
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Importar produtos"
        oQue="produtos"
        colunas={COLUNAS_PRODUTO}
        converter={converterProduto}
        resumir={(r) => [r.nome, r.categoria, r.precoVenda && `R$ ${r.precoVenda}`].filter(Boolean).join(" · ")}
        enviarLote={importarProdutos}
        tamanhoDoLote={TAMANHO_DO_LOTE_PRODUTOS}
        nomeDoModelo="modelo-produtos-konext.csv"
        onConcluido={recarregarSeCriou}
      />
    </>
  );
}
