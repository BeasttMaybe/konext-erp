export const ESTILO_IMPRESSAO_A4 = `
  *, *::before, *::after { box-sizing: border-box; }

  /*
   * Sobrescreve o tema escuro do ERP.
   * globals.css usa var(--background) SEM !important,
   * por isso !important aqui sempre vence.
   */
  html, body {
    /* Tokens da familia papel (app/tokens-konext.css). Funcionam aqui porque
       ela e declarada UMA vez, fora dos dois blocos de tema: um token que
       mudasse com prefers-color-scheme imprimiria texto claro em folha
       branca pra quem usa o sistema no tema escuro. */
    background-color: var(--kx-papel) !important;
    color: var(--kx-papel-texto) !important;
    color-scheme: light !important;
  }

  /* Remove headers/footers padrão do browser (URLs, timestamps) */
  @page {
    size: A4;
    margin: 0;
  }

  @media print {
    aside, nav, header, footer,
    [role="banner"], [role="complementary"], [role="contentinfo"],
    .print\\:hidden {
      display: none !important;
      visibility: hidden !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .os-tela-wrapper {
      padding: 0 !important;
      background: var(--kx-papel) !important;
    }

    .os-folha {
      width: 210mm !important;
      height: 297mm !important;
      min-height: unset !important;
      padding: 15mm !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      overflow: hidden !important;
    }
  }
`;

export const ESTILO_IMPRESSAO_TERMICA = `
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    background: var(--kx-papel) !important;
    color: var(--kx-papel-texto) !important;
    color-scheme: light !important;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }

  .os-termica-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
    background: var(--kx-papel);
  }

  .os-termica {
    width: 72mm;
    max-width: 72mm;
    margin: 0 auto;
    padding: 0 2mm;
    font-family: "Courier New", "Consolas", ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.35;
    color: var(--kx-papel-texto);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .os-termica * {
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .os-termica .termica-negrito {
    font-weight: 700;
  }

  .os-termica .termica-centro {
    text-align: center;
  }

  .os-termica .termica-separador {
    border: none;
    border-top: 1px dashed var(--kx-papel-texto);
    margin: 6px 0;
  }

  .os-termica .termica-linha-item {
    page-break-inside: avoid;
  }

  .os-termica .termica-assinatura {
    page-break-inside: avoid;
  }

  .os-termica .termica-rodape-espaco {
    height: 10mm;
  }

  @media print {
    aside, nav, header, footer,
    [role="banner"], [role="complementary"], [role="contentinfo"],
    .print\\:hidden {
      display: none !important;
      visibility: hidden !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;
