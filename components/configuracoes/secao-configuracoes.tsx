type PropsSecaoConfiguracoes = {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
};

/** Cartão de seção (Fase 3-2E) — usado por cada painel de configurações. */
export function SecaoConfiguracoes({ titulo, descricao, children }: PropsSecaoConfiguracoes) {
  return (
    <div className="flex flex-col gap-5 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 md:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[17px] font-bold text-kx-texto">{titulo}</h2>
        <p className="text-[13px] text-kx-legenda">{descricao}</p>
      </div>
      {children}
    </div>
  );
}
