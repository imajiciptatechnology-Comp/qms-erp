// Ambil koordinat dari link Google Maps yang ditempel user (lokasi muat/bongkar klien).
// Bukan "use server" — dipanggil dari server action. Hanya mengikuti redirect ke domain Google (tanpa SSRF).

export type LatLngPair = [number, number];

const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.(?:com|co\.id|[a-z]{2,3}(?:\.[a-z]{2})?)$|^maps\.app\.goo\.gl$|^goo\.gl$/i;
const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

/** Koordinat dari teks: link Google Maps panjang atau angka "lat, lng". Null bila tidak ada. */
export function coordsFromText(raw: string): LatLngPair | null {
  let s = raw.trim();
  try { s = decodeURIComponent(s); } catch { /* biarkan apa adanya */ }
  const patterns = [
    new RegExp(`!3d${NUM}!4d${NUM}`),                                  // titik tempat (paling akurat)
    new RegExp(`[?&](?:q|query|ll|destination|center|daddr)=${NUM},\\s*${NUM}`),
    new RegExp(`/@${NUM},${NUM}`),                                     // pusat peta
    new RegExp(`/(?:place|search|dir)/${NUM},\\s*\\+?${NUM}`),
    new RegExp(`^${NUM}\\s*,\\s*${NUM}$`),                             // "−6.2950, 107.1380"
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }
  }
  return null;
}

/**
 * Koordinat dari link Google Maps (termasuk link pendek maps.app.goo.gl dari tombol "Bagikan").
 * Link pendek diikuti redirect-nya (maks. 5 kali), hanya ke domain Google.
 */
export async function resolveMapsLink(input: string): Promise<LatLngPair> {
  const text = input.trim().slice(0, 2000);
  // Angka "lat, lng" langsung; link apa pun harus dari Google (dicek di bawah).
  if (!/^[a-z]+:\/\//i.test(text)) {
    const direct = coordsFromText(text);
    if (direct) return direct;
  }
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("Link Google Maps tidak dikenali. Tempel link dari tombol Bagikan di Google Maps, atau isi koordinat."); }
  for (let hop = 0; hop < 6; hop++) {
    if (!/^https?:$/.test(url.protocol) || !GOOGLE_HOST.test(url.hostname)) throw new Error("Link harus dari Google Maps (google.com/maps atau maps.app.goo.gl).");
    const found = coordsFromText(url.href);
    if (found) return found;
    if (hop === 5) break;
    const res = await fetch(url.href, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "Mozilla/5.0 (QMS ERP location import)" } }).catch(() => null);
    const next = res?.headers.get("location");
    if (!res || res.status < 300 || res.status >= 400 || !next) break;
    url = new URL(next, url);
  }
  throw new Error("Koordinat tidak ditemukan di link ini. Di Google Maps: tekan lama / klik kanan titik lokasi → salin koordinat, lalu tempel di sini.");
}

export const inIndonesia = ([lat, lng]: LatLngPair) => lat >= -11.5 && lat <= 6.5 && lng >= 94 && lng <= 141.5;
