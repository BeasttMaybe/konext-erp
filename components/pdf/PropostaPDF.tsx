import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PALETA_PAPEL } from "@/lib/design/papel";

export type ProposalPdfItem = {
  id?: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  subtotal?: number;
};

export type ProposalPdfData = {
  id: string;
  cliente: string;
  aosCuidados?: string | null;
  enderecoCliente?: string | null;
  dataEmissao: Date | string;
  validade: Date | string;
  equipamento?: string | null;
  defeito?: string | null;
  introducao?: string | null;
  subtotalBruto: number;
  descontoTotal: number;
  valorTotal: number;
  condicoesPagamento?: string | null;
  termosGarantia?: string | null;
  itens: ProposalPdfItem[];
};

export type CompanyPdfInfo = {
  brandName?: string;
  tagline?: string;
  legalName?: string;
  cnpj?: string;
  stateRegistration?: string;
  address?: string;
  cityState?: string;
  contacts?: string;
  logoUrl?: string;
};

type PropostaPdfProps = {
  proposal: ProposalPdfData;
  company?: CompanyPdfInfo;
};

/**
 * Paleta vinda de `lib/design/papel.ts`, que espelha os tokens
 * `--kx-papel-*` e tem teste provando que os dois nao divergem. Aqui os
 * valores sao literais por necessidade: `@react-pdf/renderer` desenha o PDF
 * por conta propria e nao resolve `var(--kx-papel)`.
 *
 * Antes este objeto tinha a sua propria escala de cinza (#1a1a1a, #52525b,
 * #e4e4e7), parecida mas nao igual a do recibo e a do termo de garantia —
 * quatro documentos da mesma loja em quatro cinzas diferentes.
 */
const palette = {
  primaryText: PALETA_PAPEL.texto,
  secondaryText: PALETA_PAPEL.texto2,
  tableHeaderBg: PALETA_PAPEL.alternado,
  subtleBorder: PALETA_PAPEL.borda,
  accent: PALETA_PAPEL.bordaForte,
  white: PALETA_PAPEL.papel,
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.white,
    color: palette.primaryText,
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 34,
    paddingHorizontal: 34,
    lineHeight: 1.35,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
    paddingBottom: 12,
    gap: 24,
  },
  brandBlock: {
    flexGrow: 1,
    flexShrink: 1,
  },
  brandHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoWrap: {
    width: 72,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 72,
    height: 48,
    objectFit: "contain",
  },
  logoFallback: {
    width: 72,
    height: 48,
    borderWidth: 1,
    borderColor: palette.subtleBorder,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: palette.secondaryText,
    fontSize: 7,
    textAlign: "center",
    padding: 6,
  },
  brandName: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: 0.3,
    color: palette.primaryText,
    marginBottom: 2,
  },
  brandTagline: {
    marginTop: 3,
    fontSize: 10,
    color: palette.secondaryText,
  },
  companyBlock: {
    width: "46%",
    textAlign: "right",
  },
  companyLine: {
    color: palette.secondaryText,
    fontSize: 9,
    marginBottom: 2,
  },
  divider: {
    borderTopWidth: 2,
    borderTopColor: palette.accent,
    marginTop: 2,
    marginBottom: 14,
  },
  titleRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
    paddingBottom: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  proposalCode: {
    fontSize: 10,
    fontWeight: 700,
    color: palette.secondaryText,
  },
  twoColumnInfo: {
    display: "flex",
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  infoCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
    paddingBottom: 8,
    minHeight: 64,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.secondaryText,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  sectionPrimaryValue: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
  },
  sectionSecondaryValue: {
    fontSize: 9,
    color: palette.secondaryText,
    marginBottom: 2,
  },
  datesRow: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  dateItem: {
    flexGrow: 1,
    flexBasis: 0,
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
    paddingBottom: 6,
  },
  dateLabel: {
    fontSize: 8,
    color: palette.secondaryText,
    marginBottom: 3,
    fontWeight: 700,
  },
  dateValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  introBlock: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
    paddingBottom: 8,
  },
  introText: {
    fontSize: 9,
    color: palette.secondaryText,
    fontStyle: "italic",
    lineHeight: 1.5,
  },
  table: {
    marginBottom: 8,
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: palette.tableHeaderBg,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: palette.primaryText,
  },
  rowDescriptionCol: {
    width: "56%",
    paddingRight: 8,
  },
  rowQtyCol: {
    width: "10%",
    textAlign: "center",
  },
  rowUnitPriceCol: {
    width: "17%",
    textAlign: "right",
    paddingRight: 6,
  },
  rowTotalCol: {
    width: "17%",
    textAlign: "right",
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.subtleBorder,
  },
  tableCellText: {
    fontSize: 9,
    color: palette.primaryText,
  },
  totalsArea: {
    marginTop: 4,
    alignSelf: "flex-end",
    width: "42%",
  },
  totalLine: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: palette.secondaryText,
  },
  totalValue: {
    fontSize: 9,
    color: palette.primaryText,
    fontWeight: 700,
  },
  grandTotalLine: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: palette.subtleBorder,
    paddingTop: 6,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: palette.primaryText,
  },
  grandTotalValue: {
    fontSize: 13,
    fontWeight: 700,
    color: palette.accent,
  },
  footerBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.subtleBorder,
    paddingTop: 10,
  },
  footerLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.secondaryText,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  footerText: {
    fontSize: 9,
    color: palette.secondaryText,
    marginBottom: 8,
    lineHeight: 1.45,
  },
  signatureWrap: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
  },
  signatureLine: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: palette.secondaryText,
    marginBottom: 3,
  },
  signatureText: {
    fontSize: 8,
    color: palette.secondaryText,
  },
});

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDatePtBr(value: Date | string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCurrencyPtBr(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getRowTotal(item: ProposalPdfItem): number {
  if (typeof item.subtotal === "number") {
    return item.subtotal;
  }

  return Number(item.quantidade) * Number(item.precoUnitario);
}

export function PropostaPDF({ proposal, company }: PropostaPdfProps) {
  const normalizeText = (value?: string | null) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  };

  const companyInfo = {
    brandName: normalizeText(company?.brandName) ?? "Konext",
    tagline: normalizeText(company?.tagline),
    legalName: normalizeText(company?.legalName),
    cnpj: normalizeText(company?.cnpj),
    stateRegistration: normalizeText(company?.stateRegistration),
    address: normalizeText(company?.address),
    cityState: normalizeText(company?.cityState),
    contacts: normalizeText(company?.contacts),
    logoUrl: normalizeText(company?.logoUrl),
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <View style={styles.brandHeader}>
              <View style={styles.logoWrap}>
                {companyInfo.logoUrl ? (
                  <Image src={companyInfo.logoUrl} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoFallback}>
                    <Text>Logo não configurada</Text>
                  </View>
                )}
              </View>

              <View>
                <Text style={styles.brandName}>{companyInfo.brandName}</Text>
                {companyInfo.tagline && (
                  <Text style={styles.brandTagline}>{companyInfo.tagline}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.companyBlock}>
            {companyInfo.legalName && (
              <Text style={styles.companyLine}>{companyInfo.legalName}</Text>
            )}
            {companyInfo.cnpj && (
              <Text style={styles.companyLine}>{companyInfo.cnpj}</Text>
            )}
            {companyInfo.stateRegistration && (
              <Text style={styles.companyLine}>{companyInfo.stateRegistration}</Text>
            )}
            {companyInfo.address && (
              <Text style={styles.companyLine}>{companyInfo.address}</Text>
            )}
            {companyInfo.cityState && (
              <Text style={styles.companyLine}>{companyInfo.cityState}</Text>
            )}
            {companyInfo.contacts && (
              <Text style={styles.companyLine}>{companyInfo.contacts}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>PROPOSTA COMERCIAL</Text>
          <Text style={styles.proposalCode}>#{proposal.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={styles.twoColumnInfo}>
          <View style={styles.infoCard}>
            <Text style={styles.sectionLabel}>Para:</Text>
            <Text style={styles.sectionPrimaryValue}>{proposal.cliente}</Text>
            <Text style={styles.sectionSecondaryValue}>
              Aos cuidados: {proposal.aosCuidados?.trim() || "Não informado"}
            </Text>
            <Text style={styles.sectionSecondaryValue}>
              Endereço: {proposal.enderecoCliente?.trim() || "Não informado"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionLabel}>Contexto Técnico</Text>
            <Text style={styles.sectionSecondaryValue}>
              Equipamento: {proposal.equipamento?.trim() || "Não informado"}
            </Text>
            <Text style={styles.sectionSecondaryValue}>
              Defeito Relatado: {proposal.defeito?.trim() || "Não informado"}
            </Text>
          </View>
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Data de Emissão</Text>
            <Text style={styles.dateValue}>{formatDatePtBr(proposal.dataEmissao)}</Text>
          </View>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Validade</Text>
            <Text style={styles.dateValue}>{formatDatePtBr(proposal.validade)}</Text>
          </View>
        </View>

        <View style={styles.introBlock}>
          <Text style={styles.sectionLabel}>Introdução</Text>
          <Text style={styles.introText}>
            {proposal.introducao?.trim() ||
              "Apresentamos abaixo a proposta comercial conforme diagnóstico técnico realizado."}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.rowDescriptionCol}>
              <Text style={styles.tableHeaderText}>Produto/Serviço</Text>
            </View>
            <View style={styles.rowQtyCol}>
              <Text style={styles.tableHeaderText}>Qtd</Text>
            </View>
            <View style={styles.rowUnitPriceCol}>
              <Text style={styles.tableHeaderText}>Preço Un.</Text>
            </View>
            <View style={styles.rowTotalCol}>
              <Text style={styles.tableHeaderText}>Total</Text>
            </View>
          </View>

          {proposal.itens.map((item, index) => (
            <View
              key={item.id ?? `${item.descricao}-${index}`}
              style={styles.tableRow}
            >
              <View style={styles.rowDescriptionCol}>
                <Text style={styles.tableCellText}>{item.descricao}</Text>
              </View>
              <View style={styles.rowQtyCol}>
                <Text style={styles.tableCellText}>{item.quantidade}</Text>
              </View>
              <View style={styles.rowUnitPriceCol}>
                <Text style={styles.tableCellText}>{formatCurrencyPtBr(item.precoUnitario)}</Text>
              </View>
              <View style={styles.rowTotalCol}>
                <Text style={styles.tableCellText}>{formatCurrencyPtBr(getRowTotal(item))}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalsArea}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Subtotal Bruto</Text>
            <Text style={styles.totalValue}>{formatCurrencyPtBr(proposal.subtotalBruto)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Descontos</Text>
            <Text style={styles.totalValue}>- {formatCurrencyPtBr(proposal.descontoTotal)}</Text>
          </View>
          <View style={styles.grandTotalLine}>
            <Text style={styles.grandTotalLabel}>VALOR TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrencyPtBr(proposal.valorTotal)}</Text>
          </View>
        </View>

        <View style={styles.footerBlock}>
          <Text style={styles.footerLabel}>Condições de Pagamento</Text>
          <Text style={styles.footerText}>
            {proposal.condicoesPagamento?.trim() || "Não informado"}
          </Text>

          <Text style={styles.footerLabel}>Termos de Garantia</Text>
          <Text style={styles.footerText}>
            {proposal.termosGarantia?.trim() || "Não informado"}
          </Text>

          <View style={styles.signatureWrap}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Assinatura do Responsável</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default PropostaPDF;