"use client";

import { Check, CircleHelp, Package, PackagePlus, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatarReais } from "@/lib/dinheiro";
import type { ItemConferido } from "@/app/actions/compras";
import type { ProdutoParaCasar } from "@/lib/dominio/compras/casamento";
import type { CustoDoItem } from "@/lib/dominio/compras/custo";
import { unidadeDoCadastro } from "@/lib/dominio/compras/unidade";
import { UNIDADES_DE_MEDIDA } from "@/lib/dominio/estoque/preco";

import { CampoDinheiro } from "./campo-dinheiro";

/**
 * O destino de uma linha da nota.
 *
 * `PENDENTE` é um estado de verdade, e não ausência de escolha. Ele existe
 * só pras linhas em que o sistema achou um produto PARECIDO mas não tem
 * certeza — e é nelas, e só nelas, que a conferência precisa de uma pessoa.
 *
 * O desenho da tela sai daí: linha com identidade (código de barras, SKU,
 * nome igual) já vem vinculada; linha sem nada parecido já vem como produto
 * novo; linha duvidosa fica bloqueando o botão de lançar até alguém olhar.
 * Atenção é um recurso escasso, e gastá-la onde não muda o resultado é o
 * jeito mais rápido de fazer ninguém olhar pra lugar nenhum.
 */
export type Destino =
  | { tipo: "PENDENTE" }
  | { tipo: "IGNORAR" }
  | { tipo: "VINCULAR"; produtoId: string }
  | {
      tipo: "CRIAR";
      nome: string;
      categoriaId: string;
      precoVendaCentavos: number;
      unidade: string;
    };

export function LinhaDaNota({
  item,
  custo,
  destino,
  catalogo,
  categorias,
  onMudar,
  podeVerCustos,
}: {
  item: ItemConferido;
  custo: CustoDoItem | undefined;
  destino: Destino;
  catalogo: ProdutoParaCasar[];
  categorias: Array<{ id: string; nome: string }>;
  onMudar: (destino: Destino) => void;
  podeVerCustos: boolean;
}) {
  const totalNaoBate = item.problemas.includes("TOTAL_NAO_BATE");
  const pendente = destino.tipo === "PENDENTE";

  const parcelasDoCusto = [
    custo && custo.rateioDeFreteCentavos > 0
      ? `+${formatarReais(custo.rateioDeFreteCentavos)} de frete`
      : null,
    custo && custo.impostosCentavos > 0
      ? `+${formatarReais(custo.impostosCentavos)} de imposto`
      : null,
    custo && custo.rateioDeDescontoCentavos > 0
      ? `−${formatarReais(custo.rateioDeDescontoCentavos)} de desconto`
      : null,
  ].filter((parcela): parcela is string => parcela !== null);

  return (
    <>
      <TableRow
        className={
          pendente
            ? "border-l-2 border-l-kx-alerta-texto bg-kx-alerta-fundo/30"
            : destino.tipo === "IGNORAR"
              ? "opacity-50"
              : undefined
        }
      >
        <TableCell className="align-top text-xs text-kx-legenda">{item.ordem}</TableCell>

        <TableCell className="max-w-[320px] align-top">
          <p className="text-sm font-medium text-kx-texto">{item.descricao}</p>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-kx-legenda">
            {item.codigoFornecedor && <span>cód. {item.codigoFornecedor}</span>}
            {item.ean && <span>EAN {item.ean}</span>}
            {item.unidade && <span>{item.unidade}</span>}
          </div>
        </TableCell>

        <TableCell className="align-top text-right text-sm tabular-nums text-kx-texto">
          {item.quantidade}
        </TableCell>

        <TableCell className="align-top text-right text-sm tabular-nums text-kx-texto">
          {formatarReais(item.valorUnitarioCentavos)}
        </TableCell>

        <TableCell className="align-top text-right text-sm tabular-nums">
          <span className={totalNaoBate ? "font-semibold text-kx-erro-texto" : "text-kx-texto"}>
            {formatarReais(item.valorTotalCentavos)}
          </span>

          {/* A conta da linha é o que prova a leitura. Quando ela não fecha,
              os dois números aparecem juntos: o que o papel diz e o que a
              multiplicação dá. Esconder um dos dois seria pedir confiança. */}
          {totalNaoBate && (
            <p className="mt-0.5 text-xs text-kx-erro-texto">
              a conta dá {formatarReais(item.totalCalculadoCentavos)}
            </p>
          )}
        </TableCell>

        {podeVerCustos && (
          <TableCell className="align-top text-right text-sm tabular-nums">
            <span className="font-semibold text-kx-texto">
              {formatarReais(custo?.custoUnitarioCentavos ?? item.valorUnitarioCentavos)}
            </span>
            {/* As parcelas que separam o preço impresso na linha do custo real.
                O imposto aparece junto do frete porque é o mesmo tipo de
                dinheiro: saiu do caixa, não volta, e sem ele a margem da loja
                parece melhor do que é. Numa nota de acessório com ICMS-ST isso
                é facilmente 20% do custo do item. */}
            {parcelasDoCusto.length > 0 && (
              <p className="mt-0.5 text-xs text-kx-legenda">
                {parcelasDoCusto.join(" · ")}
              </p>
            )}
          </TableCell>
        )}

        <TableCell className="min-w-[280px] align-top">
          {pendente ? (
            <div className="space-y-2">
              <div className="flex items-start gap-1.5 text-xs text-kx-alerta-texto">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Parece ser <strong>{item.sugestao?.nome}</strong>, mas não tenho certeza.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    onMudar({ tipo: "VINCULAR", produtoId: item.sugestao?.produtoId ?? "" })
                  }
                >
                  <Check className="h-3.5 w-3.5" />É esse
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onMudar({
                      tipo: "CRIAR",
                      nome: item.descricao,
                      categoriaId: categorias[0]?.id ?? "",
                      precoVendaCentavos: 0,
                      unidade: unidadeDoCadastro(item.unidade),
                    })
                  }
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Produto novo
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onMudar({ tipo: "IGNORAR" })}
                >
                  Pular
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Select
                value={
                  destino.tipo === "VINCULAR"
                    ? destino.produtoId
                    : destino.tipo === "CRIAR"
                      ? "__criar__"
                      : "__ignorar__"
                }
                onValueChange={(valor) => {
                  if (valor === "__ignorar__") return onMudar({ tipo: "IGNORAR" });

                  if (valor === "__criar__") {
                    return onMudar({
                      tipo: "CRIAR",
                      nome: item.descricao,
                      categoriaId: categorias[0]?.id ?? "",
                      precoVendaCentavos: 0,
                      unidade: unidadeDoCadastro(item.unidade),
                    });
                  }

                  onMudar({ tipo: "VINCULAR", produtoId: valor });
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__criar__">
                    <span className="inline-flex items-center gap-2">
                      <PackagePlus className="h-3.5 w-3.5" aria-hidden />
                      Criar produto novo
                    </span>
                  </SelectItem>

                  <SelectItem value="__ignorar__">
                    <span className="inline-flex items-center gap-2">
                      <SkipForward className="h-3.5 w-3.5" aria-hidden />
                      Não entra no estoque
                    </span>
                  </SelectItem>

                  {catalogo.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      <span className="inline-flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" aria-hidden />
                        {produto.nome}
                        {produto.sku && (
                          <span className="text-xs text-kx-legenda">{produto.sku}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {destino.tipo === "VINCULAR" && item.certeza && (
                <PilulaStatus variante="sucesso">
                  {item.sugestao?.motivo === "CODIGO_DE_BARRAS"
                    ? "Código de barras igual"
                    : item.sugestao?.motivo === "SKU"
                      ? "Código do fornecedor igual"
                      : "Nome igual"}
                </PilulaStatus>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* O cadastro mínimo do produto novo fica numa linha própria embaixo,
          e não espremido numa célula: nome, categoria e preço de venda são
          três decisões, e produto criado sem preço aparece no PDV valendo
          zero — que é o jeito de uma boa importação virar um problema de
          balcão três dias depois. */}
      {destino.tipo === "CRIAR" && (
        <TableRow className="bg-kx-info-fundo/40">
          <TableCell />
          <TableCell colSpan={podeVerCustos ? 5 : 4} className="py-3">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium text-kx-texto-2">Nome do produto</span>
                <Input
                  value={destino.nome}
                  onChange={(evento) => onMudar({ ...destino, nome: evento.target.value })}
                  className="h-9"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-kx-texto-2">Categoria</span>
                <Select
                  value={destino.categoriaId}
                  onValueChange={(valor) => onMudar({ ...destino, categoriaId: valor })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-kx-texto-2">Preço de venda</span>
                <CampoDinheiro
                  valorCentavos={destino.precoVendaCentavos}
                  onChange={(centavos) => onMudar({ ...destino, precoVendaCentavos: centavos })}
                  className="h-9"
                  aria-label={`Preço de venda de ${destino.nome}`}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-kx-texto-2">Unidade</span>
                <Select
                  value={destino.unidade}
                  onValueChange={(valor) => onMudar({ ...destino, unidade: valor })}
                >
                  <SelectTrigger className="h-9 w-24 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_DE_MEDIDA.map((unidade) => (
                      <SelectItem key={unidade.valor} value={unidade.valor}>
                        {unidade.valor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </TableCell>
          <TableCell />
        </TableRow>
      )}
    </>
  );
}
