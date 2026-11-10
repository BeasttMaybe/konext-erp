"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileCheck2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  lancarNota,
  lerNota,
  type ItemConferido,
  type NotaConferida,
} from "@/app/actions/compras";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { aplicarPercentual, formatarReais, somar, subtrair } from "@/lib/dinheiro";
import { unidadeDoCadastro } from "@/lib/dominio/compras/unidade";
import {
  CRITERIOS_DE_RATEIO,
  REGRAS_DE_CUSTO,
  calcularCustos,
  type CriterioDeRateio,
  type RegraDeCusto,
} from "@/lib/dominio/compras/custo";

import { CampoDinheiro } from "@/components/ui/campo-dinheiro";
import { LinhaDaNota, type Destino } from "./linha-da-nota";
import { SoltarArquivo } from "./soltar-arquivo";

/**
 * Entrada de nota de compra, do arquivo ao estoque.
 *
 * A tela inteira existe por causa de uma assimetria: ler um documento é
 * barato e reversível, mexer no saldo e no custo de quinze produtos não é.
 * Então tudo acontece aqui, à vista, e o botão que grava fica no fim.
 *
 * Duas coisas que ela se recusa a fazer:
 *
 * 1. **Não lança sozinha**, nem quando a conta fecha. Importador que grava
 *    direto parece eficiente até o dia em que o layout do fornecedor muda e
 *    ninguém percebe por três semanas.
 * 2. **Não deixa lançar com linha pendente.** Linha pendente é aquela em que
 *    o sistema achou um produto parecido e não tem certeza — a única em que
 *    um palpite aceito em silêncio escreveria o custo de um produto por cima
 *    de outro.
 */

/** Markup sugerido pros produtos novos, em cima do custo já com frete. */
const MARKUP_INICIAL = 150;

type Estado =
  | { fase: "ARQUIVO" }
  | { fase: "CONFERINDO"; nota: NotaConferida }
  | { fase: "LANCADA"; mensagem: string };

function destinoInicial(
  item: ItemConferido,
  categoriaPadrao: string
): Destino {
  // Identidade: já vinculado, sem pedir nada a ninguém.
  if (item.certeza && item.sugestao) {
    return { tipo: "VINCULAR", produtoId: item.sugestao.produtoId };
  }

  // Parecido mas incerto: é exatamente aqui que uma pessoa precisa olhar.
  if (item.sugestao) return { tipo: "PENDENTE" };

  // Nada parecido no catálogo: é produto novo, não há o que decidir.
  return {
    tipo: "CRIAR",
    nome: item.descricao,
    categoriaId: categoriaPadrao,
    precoVendaCentavos: 0,
    unidade: unidadeDoCadastro(item.unidade),
  };
}

export function PaginaEntradaDeNota({
  categorias,
}: {
  categorias: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const podeVerCustos = useTemPermissao("estoque.ver_custos");

  const [estado, setEstado] = useState<Estado>({ fase: "ARQUIVO" });
  const [destinos, setDestinos] = useState<Record<number, Destino>>({});
  const [fornecedor, setFornecedor] = useState("");
  const [freteCentavos, setFreteCentavos] = useState(0);
  const [descontoCentavos, setDescontoCentavos] = useState(0);
  const [criterio, setCriterio] = useState<CriterioDeRateio>("VALOR");
  const [regraDeCusto, setRegraDeCusto] = useState<RegraDeCusto>("MEDIA_PONDERADA");
  const [markup, setMarkup] = useState(MARKUP_INICIAL);
  const [lendo, iniciarLeitura] = useTransition();
  const [lancando, iniciarLancamento] = useTransition();

  const nota = estado.fase === "CONFERINDO" ? estado.nota : null;

  const custos = useMemo(
    () =>
      nota
        ? calcularCustos({
            itens: nota.itens,
            freteCentavos,
            descontoCentavos,
            criterio,
          })
        : [],
    [nota, freteCentavos, descontoCentavos, criterio]
  );

  const custoPorOrdem = useMemo(
    () => new Map(custos.map((custo) => [custo.ordem, custo])),
    [custos]
  );

  function abrirArquivo(arquivo: File) {
    const formData = new FormData();
    formData.append("arquivo", arquivo);

    iniciarLeitura(async () => {
      const resultado = await lerNota(formData);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      const categoriaPadrao = categorias[0]?.id ?? "";

      setEstado({ fase: "CONFERINDO", nota: resultado.nota });
      setFornecedor(resultado.nota.emitenteNome);
      setFreteCentavos(resultado.nota.valorFreteCentavos);
      setDescontoCentavos(resultado.nota.valorDescontoCentavos);
      setDestinos(
        Object.fromEntries(
          resultado.nota.itens.map((item) => [item.ordem, destinoInicial(item, categoriaPadrao)])
        )
      );
    });
  }

  /** Preenche o preço de venda dos produtos novos que ainda estão zerados. */
  function aplicarMarkup() {
    if (!nota) return;

    setDestinos((atuais) => {
      const proximos = { ...atuais };
      let preenchidos = 0;

      for (const item of nota.itens) {
        const destino = proximos[item.ordem];
        if (destino?.tipo !== "CRIAR" || destino.precoVendaCentavos > 0) continue;

        const custo =
          custoPorOrdem.get(item.ordem)?.custoUnitarioCentavos ?? item.valorUnitarioCentavos;

        proximos[item.ordem] = {
          ...destino,
          precoVendaCentavos: somar(custo, aplicarPercentual(custo, markup)),
        };
        preenchidos += 1;
      }

      toast.success(
        preenchidos === 0
          ? "Todos os produtos novos já têm preço."
          : `Preço preenchido em ${preenchidos} produto(s). Confira antes de lançar.`
      );

      return proximos;
    });
  }

  const pendentes = nota
    ? nota.itens.filter((item) => destinos[item.ordem]?.tipo === "PENDENTE").length
    : 0;

  const semPreco = nota
    ? nota.itens.filter((item) => {
        const destino = destinos[item.ordem];
        return destino?.tipo === "CRIAR" && destino.precoVendaCentavos <= 0;
      }).length
    : 0;

  const entrando = nota
    ? nota.itens.filter((item) => {
        const tipo = destinos[item.ordem]?.tipo;
        return tipo === "VINCULAR" || tipo === "CRIAR";
      }).length
    : 0;

  // A mesma conta do servidor, campo por campo: produtos que compõem o total,
  // mais frete, mais o imposto por item, menos desconto. Se a tela mostrasse
  // um número e o banco gravasse outro, a conferência não conferiria nada.
  const produtosDaNota = nota
    ? somar(...nota.itens.filter((item) => item.compoeTotal).map((item) => item.valorTotalCentavos))
    : 0;

  const impostosDaNota = nota ? somar(...nota.itens.map((item) => item.impostosCentavos)) : 0;

  const totalDaNota = nota
    ? subtrair(somar(produtosDaNota, freteCentavos, impostosDaNota), descontoCentavos)
    : 0;

  function lancar() {
    if (!nota) return;

    iniciarLancamento(async () => {
      const resultado = await lancarNota({
        itens: nota.itens.map((item) => ({
          ordem: item.ordem,
          descricao: item.descricao,
          codigoFornecedor: item.codigoFornecedor,
          ean: item.ean,
          ncm: item.ncm,
          unidade: item.unidade,
          quantidade: item.quantidade,
          compoeTotal: item.compoeTotal,
          impostosCentavos: item.impostosCentavos,
          valorUnitarioCentavos: item.valorUnitarioCentavos,
          valorTotalCentavos: item.valorTotalCentavos,
        })),
        decisoes: nota.itens.map((item) => {
          const destino = destinos[item.ordem] ?? { tipo: "IGNORAR" as const };

          if (destino.tipo === "VINCULAR") {
            return { acao: "VINCULAR" as const, ordem: item.ordem, produtoId: destino.produtoId };
          }

          if (destino.tipo === "CRIAR") {
            return {
              acao: "CRIAR" as const,
              ordem: item.ordem,
              nome: destino.nome,
              categoriaId: destino.categoriaId,
              precoVendaCentavos: destino.precoVendaCentavos,
              unidade: destino.unidade,
              // O EAN da nota vira o código de barras do produto novo: é o
              // mesmo número no mundo inteiro, e é o que faz a PRÓXIMA nota
              // deste item casar com certeza em vez de por semelhança.
              codigoBarras: item.ean,
            };
          }

          return { acao: "IGNORAR" as const, ordem: item.ordem };
        }),
        origem: nota.origem,
        chaveAcesso: nota.chaveAcesso,
        numero: nota.numero,
        serie: nota.serie,
        emitenteNome: fornecedor,
        emitenteCnpj: nota.emitenteCnpj,
        emitidaEm: nota.emitidaEm,
        arquivoNome: nota.arquivoNome,
        observacao: null,
        freteCentavos,
        descontoCentavos,
        criterioRateio: criterio,
        regraDeCusto,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      setEstado({ fase: "LANCADA", mensagem: resultado.mensagem });
      router.refresh();
    });
  }

  if (estado.fase === "LANCADA") {
    return (
      <div className="space-y-4">
        <Aviso variante="sucesso">{estado.mensagem}</Aviso>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => router.push("/estoque")}>
            Ver o estoque
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEstado({ fase: "ARQUIVO" });
              setDestinos({});
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Lançar outra nota
          </Button>
        </div>
      </div>
    );
  }

  if (!nota) {
    return <SoltarArquivo onEscolher={abrirArquivo} carregando={lendo} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEstado({ fase: "ARQUIVO" });
            setDestinos({});
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Trocar arquivo
        </Button>

        <PilulaStatus variante={nota.origem === "XML" ? "sucesso" : "neutro"}>
          {nota.origem === "XML" ? "XML da NF-e" : "PDF lido"}
        </PilulaStatus>

        <span className="text-xs text-kx-legenda">{nota.arquivoNome}</span>
      </div>

      {nota.jaLancada && (
        <Aviso variante="erro">
          Esta nota já entrou no estoque em{" "}
          {new Date(nota.jaLancada.lancadaEm).toLocaleDateString("pt-BR")}. Lançar de novo dobraria
          o saldo de todos os itens — por isso o sistema não vai deixar.
        </Aviso>
      )}

      {nota.alertaDeDestinatario === "EMITIDA_PELA_LOJA" && (
        <Aviso variante="erro">
          Esta nota foi emitida PELA sua loja, não para ela. É uma venda, não uma compra — lançar
          aqui somaria no estoque o que deveria ter saído dele.
        </Aviso>
      )}

      {nota.alertaDeDestinatario === "DESTINADA_A_OUTRO_CNPJ" && (
        <Aviso variante="alerta">
          O destinatário desta nota é outro CNPJ, diferente do cadastrado nas configurações.
          Confira se é o arquivo certo.
        </Aviso>
      )}

      {!nota.contaFecha && (
        <Aviso variante="alerta">
          <div>
            <p className="font-semibold">A conta da nota não fechou.</p>
            <p className="mt-1">
              {nota.origem === "PDF"
                ? "Num PDF, isso quase sempre quer dizer que eu li alguma coluna errado. Confira linha por linha antes de lançar — principalmente as marcadas em vermelho."
                : "Os totais declarados não batem com a soma dos itens. Confira as linhas marcadas em vermelho."}
            </p>
          </div>
        </Aviso>
      )}

      {nota.linhasIgnoradas.length > 0 && (
        <Aviso variante="alerta">
          <div>
            <p className="font-semibold">
              {nota.linhasIgnoradas.length} linha(s) com valor que eu não consegui interpretar:
            </p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {nota.linhasIgnoradas.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">
              Se alguma delas for um item de verdade, cadastre à mão depois de lançar.
            </p>
          </div>
        </Aviso>
      )}

      {/* Cabeçalho do documento */}
      <div className="grid gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label htmlFor="fornecedor">Fornecedor</Label>
          <Input
            id="fornecedor"
            value={fornecedor}
            onChange={(evento) => setFornecedor(evento.target.value)}
            placeholder="Nome do fornecedor"
          />
          {nota.origem === "PDF" && (
            <p className="mt-1 text-xs text-kx-legenda">
              Li do topo do documento — confira se está certo.
            </p>
          )}
        </div>

        <div>
          <Label>Nota</Label>
          <p className="mt-2 text-sm text-kx-texto">
            {nota.numero ? `nº ${nota.numero}${nota.serie ? ` / ${nota.serie}` : ""}` : "sem número"}
          </p>
        </div>

        <div>
          <Label>Emissão</Label>
          <p className="mt-2 text-sm text-kx-texto">
            {nota.emitidaEm
              ? new Date(`${nota.emitidaEm}T12:00:00`).toLocaleDateString("pt-BR")
              : "não informada"}
          </p>
        </div>
      </div>

      {/* Itens */}
      <div className="overflow-x-auto rounded-kx-painel border border-kx-painel-borda bg-kx-cartao">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Item na nota</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Unitário</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {podeVerCustos && <TableHead className="text-right">Custo final</TableHead>}
              <TableHead>Destino no estoque</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {nota.itens.map((item) => (
              <LinhaDaNota
                key={item.ordem}
                item={item}
                custo={custoPorOrdem.get(item.ordem)}
                destino={destinos[item.ordem] ?? { tipo: "IGNORAR" }}
                catalogo={nota.catalogo}
                categorias={categorias}
                podeVerCustos={podeVerCustos}
                onMudar={(destino) =>
                  setDestinos((atuais) => ({ ...atuais, [item.ordem]: destino }))
                }
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Frete, critério e regra de custo */}
      <div className="grid gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div>
            <Label htmlFor="frete">Frete da nota</Label>
            <CampoDinheiro id="frete" valorCentavos={freteCentavos} onChange={setFreteCentavos} />
          </div>

          <div>
            <Label htmlFor="desconto">Desconto</Label>
            <CampoDinheiro
              id="desconto"
              valorCentavos={descontoCentavos}
              onChange={setDescontoCentavos}
            />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-kx-texto">Dividir o frete</legend>

          {CRITERIOS_DE_RATEIO.map((opcao) => (
            <label key={opcao.valor} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="criterio"
                className="mt-1"
                checked={criterio === opcao.valor}
                onChange={() => setCriterio(opcao.valor)}
              />
              <span>
                <span className="font-medium text-kx-texto">{opcao.rotulo}</span>
                <span className="block text-xs text-kx-legenda">{opcao.ajuda}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-kx-texto">
            Custo de quem já estava no estoque
          </legend>

          {REGRAS_DE_CUSTO.map((opcao) => (
            <label key={opcao.valor} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="regra-custo"
                className="mt-1"
                checked={regraDeCusto === opcao.valor}
                onChange={() => setRegraDeCusto(opcao.valor)}
              />
              <span>
                <span className="font-medium text-kx-texto">{opcao.rotulo}</span>
                <span className="block text-xs text-kx-legenda">{opcao.ajuda}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      {/* Preço dos produtos novos */}
      {semPreco > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4">
          <div>
            <Label htmlFor="markup">Markup sugerido (%)</Label>
            <Input
              id="markup"
              type="number"
              min={0}
              value={markup}
              onChange={(evento) => setMarkup(Number(evento.target.value) || 0)}
              className="w-28"
            />
          </div>

          <Button type="button" variant="outline" onClick={aplicarMarkup}>
            <Sparkles className="h-4 w-4" />
            Preencher os {semPreco} preço(s) em branco
          </Button>

          <p className="text-xs text-kx-legenda">
            Calculado em cima do custo já com o frete rateado. É sugestão — confira cada um.
          </p>
        </div>
      )}

      {/* Fechamento */}
      <div className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4 lg:flex-row lg:items-center lg:justify-between">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-kx-legenda">Mercadoria</dt>
            <dd className="font-semibold tabular-nums text-kx-texto">
              {formatarReais(produtosDaNota)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-kx-legenda">Frete</dt>
            <dd className="font-semibold tabular-nums text-kx-texto">
              {formatarReais(freteCentavos)}
            </dd>
          </div>
          {/* As parcelas só aparecem quando existem: numa nota sem ST nem
              desconto, mostrar dois zeros é ruído em cima da conta que
              importa. Quando existem, aparecem, porque aí a soma só fecha
              com elas na tela. */}
          {impostosDaNota > 0 && (
            <div>
              <dt className="text-xs text-kx-legenda">Imposto</dt>
              <dd className="font-semibold tabular-nums text-kx-texto">
                {formatarReais(impostosDaNota)}
              </dd>
            </div>
          )}
          {descontoCentavos > 0 && (
            <div>
              <dt className="text-xs text-kx-legenda">Desconto</dt>
              <dd className="font-semibold tabular-nums text-kx-texto">
                −{formatarReais(descontoCentavos)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-kx-legenda">Total da nota</dt>
            <dd className="font-semibold tabular-nums text-kx-texto">
              {formatarReais(totalDaNota)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-kx-legenda">Entram no estoque</dt>
            <dd className="font-semibold tabular-nums text-kx-texto">
              {entrando} de {nota.itens.length}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Button
            type="button"
            size="lg"
            onClick={lancar}
            disabled={
              lancando ||
              pendentes > 0 ||
              semPreco > 0 ||
              entrando === 0 ||
              nota.jaLancada !== null ||
              nota.alertaDeDestinatario === "EMITIDA_PELA_LOJA"
            }
          >
            <FileCheck2 className="h-4 w-4" />
            {lancando ? "Lançando..." : "Lançar no estoque"}
          </Button>

          {pendentes > 0 && (
            <p className="text-xs text-kx-alerta-texto">
              {pendentes} linha(s) esperando você decidir.
            </p>
          )}
          {pendentes === 0 && semPreco > 0 && (
            <p className="text-xs text-kx-alerta-texto">
              {semPreco} produto(s) novo(s) sem preço de venda.
            </p>
          )}
          {pendentes === 0 && semPreco === 0 && entrando === 0 && (
            <p className="text-xs text-kx-alerta-texto">Nenhum item marcado pra entrar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
