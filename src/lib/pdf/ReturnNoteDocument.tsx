import React from "react";
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import { formatLKR } from "@/lib/money";
import { pdfStyles as styles, type PdfSettings } from "@/lib/pdf/QuotationDocument";

/**
 * Return note (credit note) for goods brought back against an invoice. Same
 * header and table as the invoice, so the two read as one set of paperwork.
 * Shows what came back and the credit - never cost or margin.
 */

export interface ReturnNoteLine {
  name: string;
  itemCode: string;
  serialNumbers: string[];
  quantity: number;
  creditAmount: number;
}

export interface ReturnNoteProps {
  returnNo: string;
  returnDate: string;
  invoiceNo: string;
  invoiceDate: string;
  reason: string | null;
  customer: { name: string; phone: string; address: string | null };
  lines: ReturnNoteLine[];
  creditAmount: number;
  refundAmount: number;
  refundMethod: string | null;
  /** Invoice balance after this return; negative means still owed to the customer. */
  balanceAfter: number;
  settings: PdfSettings;
}

const cItem = { width: "60%", paddingRight: 10 } as const;
const cQty = { width: "16%", textAlign: "right" } as const;
const cAmount = { width: "24%", textAlign: "right" } as const;

export function ReturnNoteDocument(props: ReturnNoteProps) {
  const { settings, customer } = props;

  const businessLines = [
    [settings.addressLine1, settings.city].filter(Boolean).join(" "),
    settings.addressLine2,
    settings.phone,
    settings.email,
    settings.regNo ? `Reg No. : ${settings.regNo}` : null,
  ].filter(Boolean) as string[];

  const meta = (label: string, value: string, first = false) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: first ? 0 : 12 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ fontSize: 9 }}>{value}</Text>
    </View>
  );

  return (
    <Document
      title={`Return ${props.returnNo}`}
      author={settings.businessName}
      subject={`Return note for ${customer.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ width: "58%" }}>
            <Text style={styles.title}>RETURN NOTE</Text>
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
            <Text style={styles.label}>CUSTOMER</Text>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerMeta}>{customer.phone}</Text>
            {customer.address && <Text style={styles.customerMeta}>{customer.address}</Text>}
          </View>
          <View style={{ width: "45%" }}>
            {meta("RETURN NUMBER", props.returnNo, true)}
            {meta("DATE", props.returnDate)}
            {meta("AGAINST INVOICE", `${props.invoiceNo} (${props.invoiceDate})`)}
          </View>
        </View>

        <View style={styles.tHead} fixed>
          <Text style={[styles.tHeadCell, cItem]}>ITEM RETURNED</Text>
          <Text style={[styles.tHeadCell, cQty]}>QUANTITY</Text>
          <Text style={[styles.tHeadCell, cAmount]}>CREDIT</Text>
        </View>

        {props.lines.map((line, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <View style={cItem}>
              <Text style={styles.itemName}>{line.name}</Text>
              <Text style={styles.itemCode}>{line.itemCode}</Text>
              {line.serialNumbers.length > 0 && (
                <Text style={styles.itemNote}>S/N: {line.serialNumbers.join(", ")}</Text>
              )}
            </View>
            <Text style={[cQty, styles.itemName]}>{line.quantity}</Text>
            <Text style={[cAmount, styles.itemName]}>{formatLKR(line.creditAmount)}</Text>
          </View>
        ))}

        {props.reason && (
          <Text style={[styles.itemNote, { marginTop: 10 }]}>Reason: {props.reason}</Text>
        )}

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Credit</Text>
              <Text style={styles.grandValue}>{formatLKR(props.creditAmount)}</Text>
            </View>
            {props.refundAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Refunded{props.refundMethod ? ` (${props.refundMethod})` : ""}
                </Text>
                <Text style={styles.totalValue}>{formatLKR(props.refundAmount)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {props.balanceAfter < 0
                  ? `Still owed to customer on ${props.invoiceNo}`
                  : `Balance due on ${props.invoiceNo}`}
              </Text>
              <Text style={styles.totalValue}>{formatLKR(Math.abs(props.balanceAfter))}</Text>
            </View>
          </View>
        </View>

        <View style={styles.signFooter}>
          <Text style={styles.signLine}>Received by (customer): ______________________</Text>
          <Text style={[styles.signLine, { marginTop: 14 }]}>
            For {settings.businessName}: ______________________
          </Text>
        </View>

        <View style={styles.pageFoot} fixed>
          <Text>{settings.businessName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
