import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { Card } from "../ui";

export default async function ClientsPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const clients = await prisma.logisticsClient.findMany({ orderBy: { name: "asc" }, include: { locations: { orderBy: { kind: "desc" } }, _count: { select: { orders: true } } } });
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {clients.map(c => (
        <Card key={c.id} title={<span>{c.name} <span className="text-xs font-normal text-slate-500">· {c.code}</span></span>} actions={<span className="text-xs text-slate-500">{c._count.orders} order</span>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-semibold text-slate-500 uppercase">Industri</dt><dd>{c.industry}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500 uppercase">Kontak</dt><dd>{c.contactName}<br /><span className="text-xs text-slate-500">{c.contactPhone} · {c.contactEmail}</span></dd></div>
            <div><dt className="text-xs font-semibold text-slate-500 uppercase">Pola order</dt><dd>{c.orderPattern}</dd></div>
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
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Lokasi muat / bongkar</p>
            <ul className="text-sm space-y-1">
              {c.locations.map(l => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${l.kind === "Muat" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>{l.kind}</span>
                  {l.name} <span className="text-xs text-slate-500">· {l.city}{l.lat ? ` (${l.lat.toFixed(3)}, ${l.lng?.toFixed(3)})` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
