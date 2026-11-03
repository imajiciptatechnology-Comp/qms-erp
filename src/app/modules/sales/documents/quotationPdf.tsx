import fs from "fs";
import path from "path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LETTERHEAD as L } from "./letterhead";
import type { QuotationDoc } from "./quotationDoc";

const ASSETS = path.join(process.cwd(), "assets");
const font = (f: string) => path.join(ASSETS, "fonts", f);
Font.register({
  family: "Inter",
  fonts: [
    { src: font("Inter_400Regular.ttf"), fontWeight: 400 },
    { src: font("Inter_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: font("Inter_600SemiBold.ttf"), fontWeight: 600 },
    { src: font("Inter_700Bold.ttf"), fontWeight: 700 },
  ],
});
// Jangan memenggal kata bahasa Indonesia dengan aturan bahasa Inggris.
Font.registerHyphenationCallback(word => [word]);
const LOGO = fs.readFileSync(path.join(ASSETS, "brand", "lpi-logo.png"));

const C = L.colors;
// lineHeight hanya dipasang per teks multi-baris: jika dipasang di Page/View dan ikut diwarisi
// elemen fixed, footer & nomor halaman tidak tergambar (perilaku react-pdf 4.x).
const LH = 1.4;
/** lineHeight dihitung dari fontSize pada gaya yang sama, jadi keduanya selalu ditulis bersama. */
const TEXT = { fontSize: 9, lineHeight: LH };
const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: C.text, paddingTop: 30, paddingBottom: 60, paddingHorizontal: 44 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: C.primary },
  topAccent: { position: "absolute", top: 6, left: 0, width: 160, height: 3, backgroundColor: C.accent },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: C.primary },
  logo: { width: 46, height: 46, marginRight: 12 },
  company: { fontSize: 14, fontWeight: 700, color: C.primary, letterSpacing: 0.6, lineHeight: 1.2 },
  tagline: { fontSize: 7.5, color: C.accent, fontWeight: 600, marginTop: 3, marginBottom: 2, letterSpacing: 0.3 },
  headContact: { fontSize: 7, color: C.muted, marginTop: 1, lineHeight: 1.3 },
  title: { fontSize: 12, fontWeight: 700, color: C.primary, textAlign: "center", marginTop: 12, letterSpacing: 1.5 },
  number: { fontSize: 8.5, color: C.muted, textAlign: "center", marginTop: 2 },
  metaRow: { flexDirection: "row", marginTop: 16, gap: 18 },
  metaBox: { flex: 1 },
  label: { fontSize: 7, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  bold: { fontWeight: 700 },
  kv: { flexDirection: "row", marginBottom: 1.5 },
  kvKey: { width: 62, color: C.muted },
  para: { ...TEXT, marginTop: 9, textAlign: "justify" },
  table: { marginTop: 12, borderWidth: 0.75, borderColor: C.line, borderRadius: 3 },
  th: { flexDirection: "row", backgroundColor: C.primary, color: "#FFFFFF", fontWeight: 600, fontSize: 8, paddingVertical: 5 },
  tr: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: C.line, paddingVertical: 5 },
  cNo: { width: 24, textAlign: "center" },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 52, textAlign: "right", paddingRight: 6 },
  cPrice: { width: 84, textAlign: "right", paddingRight: 6 },
  cTotal: { width: 88, textAlign: "right", paddingRight: 8 },
  specs: { fontSize: 7.5, color: C.muted, marginTop: 2, lineHeight: LH },
  disc: { fontSize: 7, color: "#B45309", marginTop: 1 },
  totals: { marginTop: 8, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 3, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.primary, color: "#FFFFFF", fontWeight: 700, fontSize: 10, borderRadius: 2 },
  words: { marginTop: 6, padding: 7, backgroundColor: C.soft, borderLeftWidth: 2.5, borderLeftColor: C.accent, fontStyle: "italic", fontSize: 8.5 },
  termsTitle: { marginTop: 14, fontSize: 9, fontWeight: 700, color: C.primary },
  termRow: { flexDirection: "row", marginTop: 3 },
  termKey: { width: 78, fontWeight: 600 },
  termVal: { ...TEXT, flex: 1 },
  signRow: { flexDirection: "row", marginTop: 14, justifyContent: "space-between" },
  signBox: { width: 200 },
  signName: { marginTop: 34, fontWeight: 700, borderBottomWidth: 0.75, borderBottomColor: C.text, alignSelf: "flex-start", paddingBottom: 1 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 0.75, borderTopColor: C.accent, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 6.8, color: C.muted },
  watermark: { position: "absolute", top: 330, left: 70, fontSize: 110, fontWeight: 700, color: "#E2E8F0", transform: "rotate(-30deg)", opacity: 0.55 },
});

function QuotationPdf({ d }: { d: QuotationDoc }) {
  return (
    <Document title={d.fileName} author={L.company} subject={d.subject} creator="QMS ERP">
      <Page size="A4" style={s.page}>
        {d.draft && <Text style={s.watermark} fixed>DRAFT</Text>}
        <View style={s.topBar} fixed />
        <View style={s.topAccent} fixed />
        <View style={s.footer} fixed>
          <View><Text style={{ fontWeight: 600, color: C.primary }}>{L.company}</Text><Text>{L.address} · NPWP {L.npwp}</Text></View>
          <Text render={({ pageNumber, totalPages }) => `${d.number}  ·  Hal. ${pageNumber}/${totalPages}`} />
        </View>

        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf, bukan <img> HTML */}
          <Image style={s.logo} src={{ data: LOGO, format: "png" }} />
          <View style={{ flex: 1 }}>
            <Text style={s.company}>{L.company}</Text>
            <Text style={s.tagline}>{L.tagline}</Text>
            <Text style={s.headContact}>{L.address}</Text>
            <Text style={s.headContact}>Telp. {L.phone} · {L.email} · {L.website}</Text>
          </View>
        </View>

        <Text style={s.title}>SURAT PENAWARAN HARGA</Text>
        <Text style={s.number}>No. {d.number}</Text>

        <View style={s.metaRow}>
          <View style={s.metaBox}>
            <Text style={s.label}>Kepada Yth.</Text>
            <Text style={s.bold}>{d.customer.name}</Text>
            {d.customer.address && <Text>{d.customer.address}</Text>}
            {d.attention && <Text style={{ marginTop: 2 }}>U.p. {d.attention}</Text>}
          </View>
          <View style={[s.metaBox, { maxWidth: 210 }]}>
            <View style={s.kv}><Text style={s.kvKey}>Tanggal</Text><Text>: {L.city}, {d.date}</Text></View>
            <View style={s.kv}><Text style={s.kvKey}>Perihal</Text><Text style={{ ...TEXT, flex: 1 }}>: {d.subject}</Text></View>
            <View style={s.kv}><Text style={s.kvKey}>Berlaku s/d</Text><Text>: {d.validUntil}</Text></View>
          </View>
        </View>

        <Text style={s.para}>{d.intro}</Text>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={s.cNo}>No</Text><Text style={s.cDesc}>Deskripsi & Spesifikasi</Text><Text style={s.cQty}>Qty</Text><Text style={s.cPrice}>Harga Satuan</Text><Text style={s.cTotal}>Jumlah</Text>
          </View>
          {d.items.map(it => (
            <View key={it.no} style={s.tr} wrap={false}>
              <Text style={s.cNo}>{it.no}</Text>
              <View style={s.cDesc}>
                <Text style={[s.bold, TEXT]}>{it.description}</Text>
                {it.specs && <Text style={s.specs}>{it.specs}</Text>}
              </View>
              <Text style={s.cQty}>{it.qty}</Text>
              <View style={s.cPrice}><Text>{it.unitPrice}</Text>{it.discount && <Text style={s.disc}>{it.discount}</Text>}</View>
              <Text style={[s.cTotal, s.bold]}>{it.lineTotal}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <View style={s.totals}>
            {d.totals.map(([k, v]) => <View key={k} style={s.totalRow}><Text style={{ color: C.muted }}>{k}</Text><Text>{v}</Text></View>)}
            <View style={s.grand}><Text>TOTAL</Text><Text>{d.total}</Text></View>
          </View>
          <Text style={s.words}>Terbilang: {d.totalWords}</Text>
        </View>

        <View wrap={false}>
          <Text style={s.termsTitle}>Syarat & Ketentuan</Text>
          {d.terms.map(([k, v]) => <View key={k} style={s.termRow}><Text style={s.termKey}>{k}</Text><Text style={s.termVal}>{v}</Text></View>)}
          <View style={s.termRow}><Text style={s.termKey}>Rekening</Text><Text style={s.termVal}>{L.bank}</Text></View>
        </View>

        <Text style={s.para}>{d.closing}</Text>

        <View style={s.signRow} wrap={false}>
          <View style={s.signBox}>
            <Text>Hormat kami,</Text>
            <Text style={s.bold}>{L.company}</Text>
            <Text style={s.signName}>{d.signer.name}</Text>
            <Text>{d.signer.title}</Text>
            {d.signer.contact && <Text style={{ fontSize: 7.5, color: C.muted }}>{d.signer.contact}</Text>}
          </View>
          {d.approver && (
            <View style={s.signBox}>
              <Text>Mengetahui,</Text>
              <Text> </Text>
              <Text style={s.signName}>{d.approver.name}</Text>
              <Text>{d.approver.title}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export function renderQuotationPdf(d: QuotationDoc) {
  return renderToBuffer(<QuotationPdf d={d} />);
}
