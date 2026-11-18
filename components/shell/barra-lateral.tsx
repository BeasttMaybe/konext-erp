"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  DollarSign,
  CalendarDays,
  Flag,
  Hammer,
  Megaphone,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  ShoppingCart,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/contextos/contexto-permissoes";
import type { Permissao } from "@/lib/auth/permissoes";
import {
  caminhoDoItem,
  filhosVisiveis,
  indiceFilhoAtivo,
  itensDaNavegacao,
  itemEstaAtivo,
} from "@/lib/navegacao/itens-navegacao";
import { logout } from "@/app/actions/auth";
import { usePerfilDaMoldura } from "@/contextos/contexto-perfil";
import { StatusCaixa } from "./status-caixa";

const ICONES: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  CRM: Users,
  PDV: ShoppingCart,
  Vendas: Briefcase,
  Estoque: Package,
  OS: Wrench,
  Financeiro: DollarSign,
  Agenda: CalendarDays,
  Metas: Flag,
  Marketing: Megaphone,
  Ferramentas: Hammer,
  Ajuda: LifeBuoy,
};

// useLayoutEffect avisa no console durante SSR (não existe DOM lá pra medir) —
// no cliente é exatamente o que queremos (mede e aplica ANTES do paint, sem
// flash de 1 frame na posição errada); no servidor cai pra useEffect, que
// simplesmente não roda nada (não há efeito nenhum a rodar do lado do servidor).
const useEfeitoDeLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Barra lateral (Fase 3-1, Parte 3) — 1024–1279px vira trilho de só
 * ícones, 1280px+ mostra rótulo, abaixo de 1024px some inteira (dá lugar à
 * `GavetaLateralMobile`). Tudo por classe responsiva do Tailwind — sem
 * detectar breakpoint em JS, pra não arriscar descompasso entre servidor e
 * cliente na primeira renderização.
 *
 * Não é mais `fixed` (Fase 3-2C): é um item flex normal dentro da linha do
 * cartão flutuante do app (`ShellDashboard`), com a altura vindo do
 * `stretch` padrão do flex — o cartão que a contém já tem `overflow-hidden`
 * e altura travada, então não precisa mais se ancorar no viewport sozinha.
 * Continua `relative` + `z-kx-barra-lateral` mesmo sem ser `fixed`: um
 * `position` + `z-index` explícito aqui é o que estabelece um contexto de
 * empilhamento PRÓPRIO pra esta barra — sem ele, o `z-index` negativo do
 * indicador ativo (`.kx-notch-ativo`, ver comentário mais abaixo) escapa
 * pra fora da barra e passa a pintar atrás do fundo (`bg-kx-painel`) dela
 * mesma, porque esse fundo, sem a barra ser posicionada, deixa de ser a raiz
 * do contexto de empilhamento e vira só mais um irmão pintado por cima do
 * indicador — foi exatamente essa regressão que sumiu com o indicador
 * quando a barra virou item flex sem `position` nenhum.
 *
 * O item ativo "entalha" na área de conteúdo (Fase 3-2A, Spec B — porte
 * fiel de `docs/design/referencia-menu-lateral.html`, a referência
 * aprovada) via um indicador ÚNICO, absolutamente posicionado, que desliza
 * (`transform: translateY`) até a linha do item ativo em vez de cada item
 * pintar o próprio fundo — navegação troca de página re-renderiza a barra
 * inteira, então uma transição no item em si nunca animaria (ele já nasce
 * no lugar final); só um elemento que PERSISTE entre renders pode animar
 * posição.
 *
 * A posição do indicador vem de medir o item ativo de verdade
 * (`offsetTop`, em `useLayoutEffect`), nunca de índice × constante — um
 * cálculo fixo desalinha assim que um item some por permissão ou qualquer
 * altura acima do `<nav>` muda, porque ele não sabe nada sobre o layout
 * real, só assume uma grade uniforme. Medir o DOM está sempre certo,
 * independente de quantos itens existem ou do que veio antes deles.
 *
 * Fica rente à borda direita (por isso o `<nav>` só tem padding à
 * esquerda), arredondado só à esquerda, com fundo `--kx-fundo` — a mesma
 * cor do conteúdo — mais os dois cantos côncavos de `.kx-notch-ativo`
 * (app/globals.css, técnica idêntica à referência: box-shadow, não
 * gradiente, com z-index explícito ATRÁS de `.kx-item-nav` — garantido por
 * token, não por ordem de DOM). O `pt-kx-5`/`pb-kx-5` do `<nav>` (20px, não
 * os 8px de antes) são de propósito: é exatamente o alcance do notch (20px
 * pra cima/baixo), pra ele nunca ser cortado pelo `overflow-y-auto` quando
 * o item ativo é o primeiro ou o último da lista. A barra não tem
 * `border-r`: a separação de `--kx-painel` (barra) pra `--kx-fundo`
 * (conteúdo) já é só a diferença de cor, mesmo padrão do painel de marca em
 * `app/(auth)/layout.tsx`.
 */
export function BarraLateral() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissoes, modulos } = usePermissoes();
  // Vem pronto do servidor (ver contextos/contexto-perfil.tsx). Antes esta
  // barra buscava o logo num efeito, depois de montada: uma requisicao a mais
  // por tela, e a marca "K" piscando antes de o logo aparecer.
  const { logoUrl, nomeDaLoja } = usePerfilDaMoldura();
  const [falhaLogo, setFalhaLogo] = useState(false);
  // Descoberto quando a imagem carrega: horizontal ganha a largura da barra.
  const [logoLarga, setLogoLarga] = useState(false);
  const [topoIndicador, setTopoIndicador] = useState<number | null>(null);
  const refsItens = useRef<Array<HTMLAnchorElement | null>>([]);
  const temAlgumaPermissao = useMemo(
    () => (lista: readonly Permissao[]) => lista.some((permissao) => permissoes.has(permissao)),
    [permissoes]
  );

  // Só os itens de fato renderizados (filtro de permissão já aplicado) —
  // o índice do ativo tem que vir DAQUI, nunca do array bruto, senão um
  // item escondido por permissão desalinha o indicador de uma posição.
  const itensRenderizados = itensDaNavegacao(modulos).map((item) => ({
    item,
    filhos: filhosVisiveis(item, temAlgumaPermissao),
  })).filter(({ item, filhos }) => !(item.filhos?.length && filhos.length === 0));

  const indiceAtivo = itensRenderizados.findIndex(({ item }) => itemEstaAtivo(item, pathname, searchParams));

  // Os filhos da seção ABERTA, e só dela.
  //
  // A barra vinha calculando `filhosVisiveis` e não renderizando nada com o
  // resultado: todo submenu do sistema era navegação morta. Propostas,
  // Histórico de Vendas, Contas a Receber, Contas a Pagar, Fluxo e Notas
  // Fiscais existiam, funcionavam e não tinham link em lugar nenhum — quem
  // não soubesse a URL de cor não chegava.
  //
  // Só a seção ativa abre porque abrir todas daria vinte linhas numa barra
  // de oito: o menu deixaria de ser um mapa e viraria uma lista pra ler.
  const filhosAbertos = indiceAtivo >= 0 ? itensRenderizados[indiceAtivo].filhos : [];

  const indiceDoFilhoAtivo = indiceFilhoAtivo(filhosAbertos, pathname, searchParams);

  // Mede a posição real do item ativo a cada troca de rota ou de lista
  // (permissão carregando de forma assíncrona pode mudar quantos itens
  // aparecem) — nunca calcula, sempre lê do elemento de verdade.
  useEfeitoDeLayout(() => {
    if (indiceAtivo < 0) {
      setTopoIndicador(null);
      return;
    }
    const elementoAtivo = refsItens.current[indiceAtivo];
    if (elementoAtivo) {
      setTopoIndicador(elementoAtivo.offsetTop);
    }
    // `filhosAbertos.length` entra nas dependências porque os filhos da seção
    // aberta empurram pra baixo todo item que vem depois dela: sem isso o
    // indicador fica medido na posição antiga e flutua sozinho na barra.
  }, [indiceAtivo, itensRenderizados.length, filhosAbertos.length]);

  return (
    <aside className="relative z-kx-barra-lateral hidden w-[72px] shrink-0 flex-col bg-kx-painel lg:flex xl:w-[248px]">
      <div className="flex h-16 shrink-0 items-center justify-center gap-2.5 px-2 xl:h-20 xl:justify-start xl:px-4">
        {logoUrl && !falhaLogo ? (
          logoLarga ? (
            // Logo horizontal (mais que ~1,6x mais larga que alta): ocupa a
            // largura da barra numa placa clara, sem texto ao lado — o
            // proprio desenho ja traz o nome.
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao bg-kx-papel p-1 xl:h-12 xl:w-full xl:max-w-[212px] xl:px-3 xl:py-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de logo enviada pelo tenant, fora do domínio otimizado pelo next/image. */}
              <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain" onError={() => setFalhaLogo(true)} />
            </span>
          ) : (
            // Logo quadrada ou vertical (foto, simbolo): um quadrado que ela
            // preenche, com o nome da loja ao lado. Antes ia numa placa larga
            // e ficava minuscula no meio de um retangulo branco.
            <>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao bg-kx-papel xl:h-12 xl:w-12">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL de logo enviada pelo tenant, fora do domínio otimizado pelo next/image. */}
                <img
                  src={logoUrl}
                  alt="Logo da empresa"
                  className="h-full w-full object-contain"
                  onError={() => setFalhaLogo(true)}
                  onLoad={(evento) => {
                    const { naturalWidth, naturalHeight } = evento.currentTarget;
                    if (naturalHeight > 0 && naturalWidth / naturalHeight > 1.6) setLogoLarga(true);
                  }}
                />
              </span>
              <span className="hidden min-w-0 flex-col xl:flex">
                <span className="truncate text-sm font-extrabold leading-tight tracking-tight text-kx-texto">
                  {nomeDaLoja || "Minha loja"}
                </span>
                <span className="text-[11px] leading-tight text-kx-legenda">TechOS ERP</span>
              </span>
            </>
          )
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao bg-kx-primaria text-base font-extrabold text-primary-foreground">
              T
            </div>
            <span className="hidden min-w-0 flex-col xl:flex">
              <span className="truncate text-base font-extrabold leading-tight tracking-tight text-kx-texto">
                {nomeDaLoja || "TechOS"}
              </span>
              <span className="text-[11px] leading-tight text-kx-legenda">{nomeDaLoja ? "TechOS ERP" : "Assistência técnica"}</span>
            </span>
          </>
        )}
      </div>

      <nav aria-label="Navegação principal" className="relative flex-1 overflow-y-auto pb-kx-5 pl-3 pt-kx-5">
        {topoIndicador !== null && (
          <div
            aria-hidden="true"
            style={{ transform: `translateY(${topoIndicador}px)` }}
            className="kx-notch-ativo pointer-events-none absolute inset-x-0 top-0 h-12 rounded-l-kx-cartao rounded-r-none bg-kx-fundo motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-in-out"
          />
        )}

        <div className="space-y-1">
          {itensRenderizados.map(({ item, filhos }, indice) => {
            const ativo = indice === indiceAtivo;
            const caminho = caminhoDoItem(item, filhos);
            const Icone = ICONES[item.iconKey] ?? LayoutDashboard;

            return (
              <div key={item.path}>
                <Link
                  ref={(elemento) => {
                    refsItens.current[indice] = elemento;
                  }}
                  href={caminho}
                  // Quando um filho é o destino exato, é ELE que carrega o
                  // `aria-current`: dois "page" no mesmo menu fazem o leitor
                  // de tela anunciar duas páginas atuais. O pai continua com
                  // o destaque visual da seção, que é outra coisa.
                  aria-current={ativo && indiceDoFilhoAtivo < 0 ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "kx-item-nav relative flex h-12 items-center justify-center gap-3 rounded-kx-botao px-0 text-sm font-medium xl:justify-start xl:px-3",
                    ativo ? "font-bold text-kx-texto" : "text-kx-texto-2 hover:bg-kx-superficie/50 hover:text-kx-texto"
                  )}
                >
                  <Icone
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors duration-200 ease-in-out",
                      ativo && "text-kx-destaque"
                    )}
                    aria-hidden="true"
                  />
                  <span className="hidden truncate xl:inline">{item.label}</span>
                </Link>

                {/* Os filhos da seção aberta. Só aparecem na barra expandida
                    (`xl`): no trilho de 72px não há onde escrever "Contas a
                    Receber", e um ícone repetido oito vezes não é navegação.
                    Nessa largura o caminho continua sendo a própria página,
                    que tem as abas dela. */}
                {ativo && filhos.length > 1 && (
                  <ul className="mt-1 hidden space-y-0.5 border-l border-kx-painel-borda pl-3 xl:block">
                    {filhos.map((filho, indiceDoFilho) => {
                      const filhoAtivo = indiceDoFilho === indiceDoFilhoAtivo;

                      return (
                        <li key={filho.path}>
                          <Link
                            href={filho.path}
                            aria-current={filhoAtivo ? "page" : undefined}
                            className={cn(
                              "flex h-9 items-center truncate rounded-kx-botao px-3 text-[13px]",
                              filhoAtivo
                                ? "bg-kx-superficie font-semibold text-kx-texto"
                                : "text-kx-texto-2 hover:bg-kx-superficie/50 hover:text-kx-texto"
                            )}
                          >
                            {filho.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 space-y-2 border-t border-kx-painel-borda p-2 xl:p-3">
        <StatusCaixa />
        <button
          type="button"
          onClick={() => void logout()}
          title="Sair"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-kx-botao px-0 text-sm font-medium text-kx-texto-2 transition-colors hover:bg-kx-erro-fundo hover:text-kx-erro-texto xl:justify-start xl:px-3"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="hidden xl:inline">Sair</span>
        </button>
      </div>
    </aside>
  );
}
