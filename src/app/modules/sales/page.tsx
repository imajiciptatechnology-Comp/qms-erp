import Link from "next/link";
import { AlertTriangle, FileSignature, Receipt, Target, Trophy } from "lucide-react";
import { getSalesAccess } from "./access";
import { getSalesOverview } from "./actions";
import { STAGES, contractState, daysBetween, invoiceState, rupiah, rupiahShort, today } from "./lib";
import { Card, StatCard, StatusBadge } from "./ui";

export default async function SalesOverviewPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const { opportunities, waitingApproval, openInvoices, activeContracts, openOrders } = await getSalesOverview();

  const open = opportunities.filter(o => !["Won", "Lost"].includes(o.stage));
  const pipelineValue = open.reduce((s, o) => s + o.estimatedValue, 0);
  const weighted = open.reduce((s, o) => s + o.estimatedValue * o.probability / 100, 0);
  const won = opportunities.filter(o => o.stage === "Won").length;
  const lost = opportunities.filter(o => o.stage === "Lost").length;
  const winRate = won + lost ? Math.round(won / (won + lost) * 100) : 0;

  const invoices = openInvoices.map(i => ({ ...i, state: invoiceState(i), outstanding: i.total - i.paidAmount }));
  const receivable = invoices.reduce((s, i) => s + i.outstanding, 0);
  const overdue = invoices.filter(i => i.state === "Overdue");
  const overdueAmount = overdue.reduce((s, i) => s + i.outstanding, 0);

  const contracts = activeContracts.map(c => ({ ...c, state: contractState(c) }));
  const attention = contracts.filter(c => c.state !== "Active");

  const byStage = STAGES.map(stage => {
    const rows = opportunities.filter(o => o.stage === stage);
    return { stage, count: rows.length, value: rows.reduce((s, o) => s + o.estimatedValue, 0) };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Open Pipeline" value={rupiahShort(pipelineValue)} sub={`${open.length} opportunity · weighted ${rupiahShort(weighted)}`} icon={<Target className="w-6 h-6" />} tone="blue" />
        <StatCard label="Win Rate" value={`${winRate}%`} sub={`${won} won · ${lost} lost`} icon={<Trophy className="w-6 h-6" />} tone="emerald" />
        <StatCard label="Piutang" value={rupiahShort(receivable)} sub={overdue.length ? `${overdue.length} invoice lewat jatuh tempo (${rupiahShort(overdueAmount)})` : "Tidak ada yang lewat jatuh tempo"} icon={<Receipt className="w-6 h-6" />} tone={overdue.length ? "red" : "slate"} />
        <StatCard label="Kontrak Aktif" value={contracts.length} sub={attention.length ? `${attention.length} perlu perpanjangan` : "Semua aman"} icon={<FileSignature className="w-6 h-6" />} tone={attention.length ? "amber" : "slate"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Pipeline per tahap" actions={<Link href="/modules/sales/pipeline" className="text-sm text-blue-600 hover:underline">Buka pipeline</Link>}>
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr><th className="text-left pb-2 font-semibold">Tahap</th><th className="text-right pb-2 font-semibold">Jumlah</th><th className="text-right pb-2 font-semibold">Nilai</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byStage.map(s => (
                <tr key={s.stage}>
                  <td className="py-2"><StatusBadge status={s.stage} /></td>
                  <td className="py-2 text-right tabular-nums text-slate-700">{s.count}</td>
                  <td className="py-2 text-right tabular-nums text-slate-800 font-medium">{rupiahShort(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={`Menunggu persetujuan (${waitingApproval.length})`} className="xl:col-span-2">
          {waitingApproval.length === 0 ? <p className="text-sm text-slate-500">Tidak ada penawaran yang menunggu persetujuan.</p> : (
            <ul className="divide-y divide-slate-100">
              {waitingApproval.map(q => (
                <li key={q.id}>
                  <Link href={`/modules/sales/quotations/${q.id}`} className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{q.quotationNo} <span className="text-slate-500 font-normal">Rev.{q.revision}</span></p>
                      <p className="text-xs text-slate-500 truncate">{q.customer.name} · diskon {q.discountPercent}% · {q.salesName}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">{rupiah(q.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Invoice belum lunas" actions={<Link href="/modules/sales/invoices" className="text-sm text-blue-600 hover:underline">Semua invoice</Link>}>
          {invoices.length === 0 ? <p className="text-sm text-slate-500">Semua invoice sudah lunas.</p> : (
            <ul className="divide-y divide-slate-100">
              {invoices.slice(0, 6).map(i => (
                <li key={i.id}>
                  <Link href={`/modules/sales/invoices/${i.id}`} className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{i.invoiceNo}</p>
                      <p className="text-xs text-slate-500 truncate">{i.customer.name} · jatuh tempo {i.dueDate}{i.state === "Overdue" ? ` (${daysBetween(i.dueDate, today())} hari lewat)` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{rupiah(i.outstanding)}</p>
                      <StatusBadge status={i.state} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Kontrak perlu perhatian" actions={<Link href="/modules/sales/contracts" className="text-sm text-blue-600 hover:underline">Semua kontrak</Link>}>
          {attention.length === 0 ? <p className="text-sm text-slate-500">Tidak ada kontrak yang akan habis dalam 60 hari.</p> : (
            <ul className="divide-y divide-slate-100">
              {attention.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden /> {c.title}</p>
                    <p className="text-xs text-slate-500 truncate">{c.customer.name} · {c.type} · berakhir {c.endDate}</p>
                  </div>
                  <StatusBadge status={c.state} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Sales order berjalan (${openOrders.length})`} actions={<Link href="/modules/sales/orders" className="text-sm text-blue-600 hover:underline">Semua order</Link>}>
        {openOrders.length === 0 ? <p className="text-sm text-slate-500">Tidak ada order berjalan.</p> : (
          <ul className="divide-y divide-slate-100">
            {openOrders.map(o => (
              <li key={o.id}>
                <Link href={`/modules/sales/orders/${o.id}`} className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{o.soNo} <span className="text-slate-500 font-normal">· PO {o.customerPoNo}</span></p>
                    <p className="text-xs text-slate-500 truncate">{o.customer.name}{o.expectedDelivery ? ` · target kirim ${o.expectedDelivery}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-800 tabular-nums hidden sm:inline">{rupiah(o.total)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
