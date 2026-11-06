import { prisma } from "@/lib/prisma";
import { gmapsPoint } from "../trackingLib";
import { getLogisticsAccess } from "../server";
import { Card } from "../ui";
import { ClientForm, LocationForm } from "./ClientForms";

export default async function ClientsPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const canEdit = access.canOrder || access.canRates;
  const clients = await prisma.logisticsClient.findMany({ orderBy: { name: "asc" }, include: { locations: { orderBy: [{ kind: "desc" }, { name: "asc" }] }, _count: { select: { orders: true } } } });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{clients.length} klien · lokasi muat/bongkar dipakai di form order, AI order dari chat, dan peta Fleet Tracking.</p>
        {canEdit && <ClientForm />}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {clients.map(c => (
          <Card key={c.id} title={<span>{c.name} <span className="text-xs font-normal text-slate-500">· {c.code}</span></span>}
            actions={<span className="flex items-center gap-3"><span className="text-xs text-slate-500">{c._count.orders} order</span>{canEdit && <ClientForm initial={{
              id: c.id, code: c.code, name: c.name, industry: c.industry, address: c.address, city: c.city, contactName: c.contactName, contactPhone: c.contactPhone,
              contactEmail: c.contactEmail, paymentTerms: c.paymentTerms, contractDiscountPercent: c.contractDiscountPercent, insuranceRequired: c.insuranceRequired,
              tollPassThrough: c.tollPassThrough, orderPattern: c.orderPattern, aliases: c.aliases, notes: c.notes,
            }} />}</span>}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-semibold text-slate-500 uppercase">Industri</dt><dd>{c.industry || "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500 uppercase">Kontak</dt><dd>{c.contactName || "—"}<br /><span className="text-xs text-slate-500">{[c.contactPhone, c.contactEmail].filter(Boolean).join(" · ")}</span></dd></div>
              <div><dt className="text-xs font-semibold text-slate-500 uppercase">Pola order</dt><dd>{c.orderPattern || "—"}</dd></div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase">Kontrak</dt>
                <dd>
                  TOP {c.paymentTerms}
                  {c.contractDiscountPercent > 0 && <> · diskon {c.contractDiscountPercent}%</>}
                  {c.insuranceRequired && <> · <b>wajib asuransi</b></>}
                  {c.tollPassThrough && <> · tol ditagihkan (D)</>}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase">Lokasi muat / bongkar</p>
                {canEdit && <LocationForm clientId={c.id} />}
              </div>
              {c.locations.length === 0 ? <p className="text-sm text-slate-500">Belum ada lokasi.</p> : (
                <ul className="text-sm space-y-1">
                  {c.locations.map(l => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${l.kind === "Muat" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>{l.kind}</span>
                      <span className="flex-1 min-w-0">{l.name} <span className="text-xs text-slate-500">· {l.city}{l.lat != null && l.lng != null ? <> · <a href={gmapsPoint(l.lat, l.lng)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Google Maps ↗</a></> : " · tanpa koordinat"}</span></span>
                      {canEdit && <LocationForm clientId={c.id} initial={{ id: l.id, name: l.name, kind: l.kind, address: l.address, city: l.city, lat: l.lat, lng: l.lng }} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
