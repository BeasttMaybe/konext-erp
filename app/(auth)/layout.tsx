import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--kx-fonte",
});

/**
 * Pré-visualização estática do Kanban de OS, só decorativa (Fase 1B-FIX,
 * Parte 4 — conteúdo de `docs/design/login-referencia.dc.html`). `aria-hidden`
 * porque não é uma lista de verdade — nenhuma OS real aparece na tela de
 * login. As cores de badge (`corBadgeFundo`/`corBadgeTexto`) são valores
 * pontuais do design de referência, sem token `--kx-*` correspondente,
 * exceto a coluna "Conserto" que reaproveita `--kx-alerta-*`.
 */
const COLUNAS_KANBAN_PREVIA = [
  {
    titulo: "Orçamento",
    corPonto: "var(--kx-orcamento)",
    numeroOs: "OS 0127",
    descricao: "Notebook · não liga",
    badge: "Aguardando aprovação",
    corBadgeFundo: "#4A3F24",
    corBadgeTexto: "#FCD34D",
  },
  {
    titulo: "Conserto",
    corPonto: "var(--kx-conserto)",
    numeroOs: "OS 0131",
    descricao: "Celular · troca de tela",
    badge: "Aguardando peça",
    corBadgeFundo: "var(--kx-alerta-fundo)",
    corBadgeTexto: "var(--kx-alerta-icone)",
  },
  {
    titulo: "Pronto",
    corPonto: "var(--kx-pronto)",
    numeroOs: "OS 0129",
    descricao: "Videogame · HDMI",
    badge: "Cliente avisado",
    corBadgeFundo: "#1E4540",
    corBadgeTexto: "#6EE7B7",
  },
] as const;

const classeFoco =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const anoAtual = new Date().getFullYear();

  return (
    <div
      className={`${plusJakartaSans.variable} flex min-h-screen w-full flex-col font-[family-name:var(--kx-fonte)] lg:flex-row`}
      style={{ backgroundColor: "var(--kx-fundo)", color: "var(--kx-texto)" }}
    >
      {/* Cabeçalho compacto — só abaixo de 1024px; o painel de marca cobre isso no desktop */}
      <div className="flex items-center gap-3 px-6 pt-6 lg:hidden">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base font-extrabold text-white"
          style={{ backgroundColor: "var(--kx-primaria)" }}
        >
          K
        </div>
        <span className="text-base font-extrabold tracking-tight">Konext</span>
      </div>

      {/* Painel de marca — só a partir de 1024px */}
      <aside
        className="hidden lg:flex lg:w-[700px] lg:shrink-0 lg:flex-col lg:gap-10"
        style={{ backgroundColor: "var(--kx-painel)", borderRadius: "0 40px 40px 0", padding: "48px 56px" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px] font-extrabold text-white"
            style={{ backgroundColor: "var(--kx-primaria)" }}
          >
            K
          </div>
          <div className="flex flex-col">
            <span className="text-[22px] font-extrabold tracking-tight">Konext</span>
            <span className="text-xs" style={{ color: "var(--kx-legenda)" }}>
              Gestão para assistências técnicas
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <h1 className="text-[44px] font-extrabold leading-[1.12] tracking-[-0.03em]">
            Da entrada do aparelho
            <br />
            à entrega, sem perder
            <br />
            nenhuma OS de vista.
          </h1>
          <p className="max-w-[500px] text-[17px] leading-[1.55]" style={{ color: "var(--kx-texto-2)" }}>
            Ordens de serviço, garantias, balcão, estoque e financeiro no mesmo lugar.
          </p>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-3" aria-hidden="true">
          {COLUNAS_KANBAN_PREVIA.map((coluna) => (
            <div
              key={coluna.titulo}
              className="flex flex-col gap-2.5 rounded-[20px] p-3.5"
              style={{ backgroundColor: "var(--kx-superficie)", border: "1px solid var(--kx-painel-borda)" }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: coluna.corPonto }} />
                <span className="text-[13px] font-extrabold">{coluna.titulo}</span>
              </div>

              <div
                className="flex flex-col gap-1.5 rounded-[14px] p-3"
                style={{ backgroundColor: "var(--kx-cartao)", border: "1px solid #3A3D6A" }}
              >
                <span className="text-[11px] font-extrabold" style={{ color: "var(--kx-link)" }}>
                  {coluna.numeroOs}
                </span>
                <span className="text-[13px] font-bold">{coluna.descricao}</span>
                <span
                  className="self-start rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: coluna.corBadgeFundo, color: coluna.corBadgeTexto }}
                >
                  {coluna.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--kx-legenda)" }}>
          <span>© {anoAtual} Konext</span>
          <span>
            Dúvidas?{" "}
            <a
              href="#"
              className={`font-medium hover:text-[#C7CAFF] ${classeFoco}`}
              style={{ color: "var(--kx-link)", outlineColor: "var(--kx-foco)" }}
            >
              Fale com o suporte
            </a>
          </span>
        </div>
      </aside>

      {/* Coluna do formulário */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
