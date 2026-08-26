import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { discountAmount, formatLKR } from "@/lib/money";

/**
 * Estimate document, laid out to match IV Technology's existing paperwork
 * (Estimate 001253): ESTIMATE title and business block top-left, logo
 * top-right, a bordered Bill To panel, an ITEM / PRICE / QUANTITY / AMOUNT
 * table, right-aligned totals with the discount in parentheses, and the
 * terms as a second page.
 */

export interface PdfLine {
  name: string;
  itemCode: string;
  note: string | null;
  serialNumbers: string[];
  unitPrice: number;
  quantity: number;
  lineDiscountType: string;
  lineDiscountValue: number;
}

export interface PdfSettings {
  businessName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  /** Reused for the strapline under the business name on the terms page. */
  website: string | null;
  regNo: string | null;
  logoDataUrl: string | null;
}

export interface QuotationPdfProps {
  quoteNo: string;
  issueDate: string;
  validUntil: string;
  status: string;
  customer: { name: string; phone: string; address: string | null };
  lines: PdfLine[];
  billDiscountType: string;
  billDiscountValue: number;
  termsText: string | null;
  settings: PdfSettings;
}

const INK = "#1f2933";
const GREY = "#8a94a0";
const NOTE = "#4a6fa5";
const RULE = "#e3e6ea";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 46,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
  },

  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontSize: 23, fontFamily: "Helvetica-Bold", marginBottom: 9 },
  businessName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  businessLine: { fontSize: 7, color: GREY, lineHeight: 1.4 },
  logo: { width: 118, objectFit: "contain" },

  billBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 4,
    padding: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: GREY, letterSpacing: 0.8 },
  customerName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 5 },
  customerMeta: { fontSize: 8, color: NOTE, marginTop: 3 },
  metaValue: { fontSize: 9, marginTop: 6, textAlign: "right" },

  tHead: {
    flexDirection: "row",
    backgroundColor: "#f6f7f9",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 16,
  },
  tHeadCell: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: GREY, letterSpacing: 0.8 },
  tRow: {
    flexDirection: "row",
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  cItem: { width: "52%", paddingRight: 10 },
  cPrice: { width: "16%", textAlign: "right" },
  cQty: { width: "14%", textAlign: "right" },
  cAmount: { width: "18%", textAlign: "right" },

  itemName: { fontSize: 8.5 },
  itemCode: { fontSize: 6.8, color: GREY, marginTop: 1 },
  itemNote: { fontSize: 6.8, color: NOTE, marginTop: 1.5, lineHeight: 1.35 },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalsBox: { width: "46%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { fontSize: 8, color: GREY },
  totalValue: { fontSize: 8 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  grandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },

  termsTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  termsHeading: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 7,
    marginBottom: 3,
  },
  termsPara: { fontSize: 7, lineHeight: 1.45, marginBottom: 2.5 },
  termsBulletRow: { flexDirection: "row", marginBottom: 2.5, paddingLeft: 9 },
  termsBulletDot: { fontSize: 7, width: 9 },
  termsBulletText: { fontSize: 7, lineHeight: 1.45, flex: 1 },

  signFooter: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: RULE },
  signName: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  signLine: { fontSize: 7.5, marginTop: 1.5 },

  pageFoot: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 6.5,
    color: GREY,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function lineNet(line: PdfLine): number {
  const gross = line.unitPrice * line.quantity;
  return gross - discountAmount(gross, line.lineDiscountType, line.lineDiscountValue);
}

/** Render the terms template's "# heading" / "- bullet" / paragraph markup. */
function renderTerms(text: string) {
  const nodes: React.ReactElement[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;

    if (line.startsWith("# ")) {
      nodes.push(
        <Text key={i} style={styles.termsHeading}>
          {line.slice(2)}
        </Text>,
      );
    } else if (line.startsWith("- ")) {
      nodes.push(
        <View key={i} style={styles.termsBulletRow} wrap={false}>
          <Text style={styles.termsBulletDot}>&bull;</Text>
          <Text style={styles.termsBulletText}>{line.slice(2)}</Text>
        </View>,
      );
    } else {
      nodes.push(
        <Text key={i} style={styles.termsPara}>
          {line}
        </Text>,
      );
    }
  });
  return nodes;
}

export function QuotationDocument(props: QuotationPdfProps) {
  const { settings, customer, lines } = props;

  const subtotal = lines.reduce((sum, l) => sum + lineNet(l), 0);
  const discount = discountAmount(
    subtotal,
    props.billDiscountType,
    props.billDiscountValue,
  );
  const total = subtotal - discount;

  const discountLabel =
    props.billDiscountType === "percent" && props.billDiscountValue > 0
      ? `Discount (${props.billDiscountValue / 100}%)`
      : "Discount";

  const businessLines = [
    [settings.addressLine1, settings.city].filter(Boolean).join(" "),
    settings.addressLine2,
    settings.phone,
    settings.email,
    settings.regNo ? `Reg No. : ${settings.regNo}` : null,
  ].filter(Boolean) as string[];

  const footer = (
    <View style={styles.pageFoot} fixed>
      <Text>
        {settings.businessName}
        {props.status === "draft" ? "  -  DRAFT" : ""}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );

  return (
    <Document
      title={`Estimate ${props.quoteNo}`}
      author={settings.businessName}
      subject={`Estimate for ${customer.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ width: "58%" }}>
            <Text style={styles.title}>ESTIMATE</Text>
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {businessLines.map((line, i) => (
              <Text key={i} style={styles.businessLine}>
                {line}
              </Text>
            ))}
          </View>
          {settings.logoDataUrl && (
            <View style={{ width: "36%", alignItems: "flex-end" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an <img> */}
              <Image style={styles.logo} src={settings.logoDataUrl} />
            </View>
          )}
        </View>

        <View style={styles.billBox}>
          <View style={{ width: "50%" }}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerMeta}>{customer.phone}</Text>
            {customer.address && (
              <Text style={styles.customerMeta}>{customer.address}</Text>
            )}
          </View>
          <View style={{ width: "45%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.label}>ESTIMATE NUMBER</Text>
              <Text style={{ fontSize: 9 }}>{props.quoteNo}</Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <Text style={styles.label}>ISSUED</Text>
              <Text style={{ fontSize: 9 }}>{props.issueDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tHead} fixed>
          <Text style={[styles.tHeadCell, styles.cItem]}>ITEM</Text>
          <Text style={[styles.tHeadCell, styles.cPrice]}>PRICE</Text>
          <Text style={[styles.tHeadCell, styles.cQty]}>QUANTITY</Text>
          <Text style={[styles.tHeadCell, styles.cAmount]}>AMOUNT</Text>
        </View>

        {lines.map((line, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <View style={styles.cItem}>
              <Text style={styles.itemName}>{line.name}</Text>
              <Text style={styles.itemCode}>{line.itemCode}</Text>
              {line.note
                ?.split("\n")
                .filter((n) => n.trim())
                .map((n, k) => (
                  <Text key={k} style={styles.itemNote}>
                    {n}
                  </Text>
                ))}
              {line.serialNumbers.length > 0 && (
                <Text style={styles.itemNote}>
                  S/N: {line.serialNumbers.join(", ")}
                </Text>
              )}
              {line.lineDiscountValue > 0 && (
                <Text style={styles.itemNote}>
                  Less discount:{" "}
                  {line.lineDiscountType === "percent"
                    ? `${line.lineDiscountValue / 100}%`
                    : formatLKR(line.lineDiscountValue)}
                </Text>
              )}
            </View>
            <Text style={[styles.cPrice, styles.itemName]}>
              {formatLKR(line.unitPrice)}
            </Text>
            <Text style={[styles.cQty, styles.itemName]}>{line.quantity}</Text>
            <Text style={[styles.cAmount, styles.itemName]}>
              {formatLKR(lineNet(line))}
            </Text>
          </View>
        ))}

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatLKR(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{discountLabel}</Text>
              <Text style={styles.totalValue}>({formatLKR(discount)})</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Grand total</Text>
              <Text style={styles.grandValue}>{formatLKR(total)}</Text>
            </View>
          </View>
        </View>

        {footer}
      </Page>

      {props.termsText && props.termsText.trim() !== "" && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
          {renderTerms(props.termsText)}

          <View style={styles.signFooter}>
            <Text style={styles.signName}>{settings.businessName}</Text>
            {settings.website && <Text style={styles.signLine}>{settings.website}</Text>}
            {settings.phone && <Text style={styles.signLine}>[ {settings.phone} ]</Text>}
            {settings.email && <Text style={styles.signLine}>[ {settings.email} ]</Text>}
            {(settings.addressLine1 || settings.city) && (
              <Text style={styles.signLine}>
                [ {[settings.addressLine1, settings.city].filter(Boolean).join(", ")} ]
              </Text>
            )}
          </View>

          {footer}
        </Page>
      )}
    </Document>
  );
}
