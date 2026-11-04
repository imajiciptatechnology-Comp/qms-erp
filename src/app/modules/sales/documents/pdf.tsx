import fs from "fs";
import path from "path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { DEFAULT_BRAND } from "./letterhead";
import type { Block, Cell, DocBrand, DocModel, Signature } from "./model";

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
/** Semua gaya & komponen dibuat per kop (warna, logo, nama perusahaan), lalu di-cache. */
function createPdfKit(L: DocBrand) {
const LOGO = fs.readFileSync(path.join(ASSETS, L.logoFile));
const C = L.colors;
// lineHeight hanya dipasang per teks multi-baris: jika dipasang di Page/View dan ikut diwarisi
// elemen fixed, footer & nomor halaman tidak tergambar (perilaku react-pdf 4.x).
/** lineHeight dihitung dari fontSize pada gaya yang sama, jadi keduanya selalu ditulis bersama. */
const TEXT = { fontSize: 9, lineHeight: 1.4 };
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
  label: { fontSize: 7, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  bold: { fontWeight: 700 },
  kv: { flexDirection: "row", marginBottom: 1.5 },
  kvKey: { width: 66, color: C.muted },
  para: { ...TEXT, marginTop: 9 },
  heading: { marginTop: 14, fontSize: 9.5, fontWeight: 700, color: C.primary },
  table: { marginTop: 10, borderWidth: 0.75, borderColor: C.line, borderRadius: 3 },
  th: { flexDirection: "row", backgroundColor: C.primary, color: "#FFFFFF", fontWeight: 600, fontSize: 8, paddingVertical: 5 },
  tr: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: C.line, paddingVertical: 5 },
  sub: { fontSize: 7.5, color: C.muted, marginTop: 2, lineHeight: 1.4 },
  note: { fontSize: 7, color: "#B45309", marginTop: 1 },
  totals: { marginTop: 8, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 3, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.primary, color: "#FFFFFF", fontWeight: 700, fontSize: 10, borderRadius: 2 },
  words: { marginTop: 6, padding: 7, backgroundColor: C.soft, borderLeftWidth: 2.5, borderLeftColor: C.accent, fontStyle: "italic", fontSize: 8.5 },
  termRow: { flexDirection: "row", marginTop: 3 },
  termKey: { width: 92, fontWeight: 600 },
  clauseTitle: { marginTop: 10, fontSize: 9, fontWeight: 700, textAlign: "center" },
  noteBox: { marginTop: 10, padding: 7, borderWidth: 0.75, borderColor: C.line, borderRadius: 3, fontSize: 8, color: C.muted, lineHeight: 1.4 },
  signRow: { flexDirection: "row", marginTop: 18, justifyContent: "space-between" },
  signBox: { width: 200 },
  signName: { marginTop: 34, fontWeight: 700, borderBottomWidth: 0.75, borderBottomColor: C.text, alignSelf: "flex-start", paddingBottom: 1 },
  stamp: { marginTop: 8, width: 62, height: 34, borderWidth: 0.75, borderColor: C.line, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 0.75, borderTopColor: C.accent, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 6.8, color: C.muted },
  watermark: { position: "absolute", top: 330, left: 70, fontSize: 100, fontWeight: 700, color: "#E2E8F0", transform: "rotate(-30deg)", opacity: 0.55 },
});

const WATERMARK_COLOR = { DRAFT: "#E2E8F0", LUNAS: "#D1FAE5", DIBATALKAN: "#FEE2E2" };
const align = (a?: string) => (a === "right" ? "right" : a === "center" ? "center" : "left") as "left" | "right" | "center";

function CellView({ cell, width, alignment }: { cell: Cell; width: number; alignment?: string }) {
  const c = typeof cell === "string" ? { text: cell } : cell;
  return (
    <View style={{ flex: width, paddingHorizontal: 6 }}>
      <Text style={[{ ...TEXT, textAlign: align(alignment) }, c.bold ? s.bold : {}]}>{c.text}</Text>
      {c.sub ? <Text style={[s.sub, { textAlign: align(alignment) }]}>{c.sub}</Text> : null}
      {c.note ? <Text style={[s.note, { textAlign: align(alignment) }]}>{c.note}</Text> : null}
    </View>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "para":
      return <Text style={[s.para, { textAlign: b.align === "center" ? "center" : b.align === "left" ? "left" : "justify" }]}>{b.text}</Text>;
    case "heading":
      return <Text style={s.heading}>{b.text}</Text>;
    case "table":
      return (
        <View style={s.table}>
          <View style={s.th}>
            {b.columns.map(col => <Text key={col.label} style={{ flex: col.width, paddingHorizontal: 6, textAlign: align(col.align) }}>{col.label}</Text>)}
          </View>
          {b.rows.map((row, i) => (
            <View key={i} style={s.tr} wrap={false}>
              {row.map((cell, j) => <CellView key={j} cell={cell} width={b.columns[j].width} alignment={b.columns[j].align} />)}
            </View>
          ))}
        </View>
      );
    case "totals":
      return (
        <View style={s.totals} wrap={false}>
          {b.rows.map(([k, v]) => <View key={k} style={s.totalRow}><Text style={{ color: C.muted }}>{k}</Text><Text>{v}</Text></View>)}
          <View style={s.grand}><Text>{b.total[0]}</Text><Text>{b.total[1]}</Text></View>
        </View>
      );
    case "words":
      return <Text style={s.words}>{b.text}</Text>;
    case "kv":
      return (
        <View wrap={false}>
          {b.title && <Text style={s.heading}>{b.title}</Text>}
          {b.rows.map(([k, v]) => <View key={k} style={s.termRow}><Text style={s.termKey}>{k}</Text><Text style={{ ...TEXT, flex: 1 }}>{v}</Text></View>)}
        </View>
      );
    case "clauses":
      return (
        <View>
          {b.items.map((c, i) => (
            // Satu pasal tidak dipotong antarhalaman supaya judul tidak terpisah dari isinya.
            <View key={i} wrap={false}>
              <Text style={s.clauseTitle}>Pasal {i + 1}{"\n"}{c.title.toUpperCase()}</Text>
              <Text style={[s.para, { marginTop: 4, textAlign: "justify" }]}>{c.body}</Text>
            </View>
          ))}
        </View>
      );
    case "note":
      return <Text style={s.noteBox}>{b.text}</Text>;
    case "signatures":
      return <View style={s.signRow} wrap={false}>{b.items.map((sig, i) => <SignatureView key={i} sig={sig} />)}</View>;
  }
}

function SignatureView({ sig }: { sig: Signature }) {
  return (
    <View style={s.signBox}>
      <Text>{sig.lead}</Text>
      <Text style={s.bold}>{sig.org ?? " "}</Text>
      {sig.stamp ? <View style={s.stamp}><Text style={{ fontSize: 6, color: C.muted }}>Meterai</Text><Text style={{ fontSize: 6, color: C.muted }}>Rp10.000</Text></View> : null}
      <Text style={[s.signName, sig.stamp ? { marginTop: 8 } : {}]}>{sig.name}</Text>
      <Text>{sig.title}</Text>
      {sig.extra ? <Text style={{ fontSize: 7.5, color: C.muted }}>{sig.extra}</Text> : null}
    </View>
  );
}

function DocPdf({ d }: { d: DocModel }) {
  return (
    <Document title={d.fileName} author={L.company} subject={d.title} creator="QMS ERP">
      <Page size="A4" style={s.page}>
        {d.watermark && <Text style={[s.watermark, { color: WATERMARK_COLOR[d.watermark] }]} fixed>{d.watermark}</Text>}
        <View style={s.topBar} fixed />
        <View style={s.topAccent} fixed />
        {/* Footer fixed diletakkan sebelum konten mengalir. */}
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

        <Text style={s.title}>{d.title}</Text>
        <Text style={s.number}>No. {d.number}</Text>

        {(d.recipient || d.meta) && (
          <View style={s.metaRow}>
            <View style={{ flex: 1 }}>
              {d.recipient && <>
                <Text style={s.label}>{d.recipient.label}</Text>
                <Text style={s.bold}>{d.recipient.name}</Text>
                {d.recipient.lines.map((l, i) => <Text key={i} style={TEXT}>{l}</Text>)}
              </>}
            </View>
            {d.meta && (
              <View style={{ flex: 1, maxWidth: 220 }}>
                {d.meta.map(([k, v]) => <View key={k} style={s.kv}><Text style={s.kvKey}>{k}</Text><Text style={{ ...TEXT, flex: 1 }}>: {v}</Text></View>)}
              </View>
            )}
          </View>
        )}

        {d.blocks.map((b, i) => <BlockView key={i} b={b} />)}

        {d.signatures?.length ? (
          <View style={s.signRow} wrap={false}>
            {d.signatures.map((sig, i) => <SignatureView key={i} sig={sig} />)}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

return DocPdf;
}

const kits = new Map<string, ReturnType<typeof createPdfKit>>();

export function renderPdf(d: DocModel) {
  const brand = d.brand ?? DEFAULT_BRAND;
  const key = JSON.stringify(brand);
  if (!kits.has(key)) kits.set(key, createPdfKit(brand));
  const DocPdf = kits.get(key)!;
  return renderToBuffer(<DocPdf d={d} />);
}
