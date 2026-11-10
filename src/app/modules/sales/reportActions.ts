"use server";

// Laporan penjualan: target vs realisasi per bulan, per sales, per negara, per kategori produk (semua dalam Rupiah).
import { prisma } from "@/lib/prisma";
import { toIdr } from "./lib";
import { guardAny } from "./serverGuard";

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;

export async function getSalesReport(year: number) {
  await guardAny("canView");
  const y = String(year);
  const [orders, payments, targets, years, salesPeople] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { orderDate: { startsWith: y }, status: { not: "Cancelled" } },
      select: { id: true, orderDate: true, subtotal: true, currency: true, exchangeRate: true, salesName: true, customer: { select: { country: true, type: true } }, items: { select: { productId: true, lineTotal: true } } },
    }),
    prisma.payment.findMany({ where: { paymentDate: { startsWith: y }, method: { not: "Nota Kredit" } }, select: { paymentDate: true, amount: true, invoice: { select: { currency: true, exchangeRate: true } } } }),
    prisma.salesTarget.findMany({ where: { year } }),
    prisma.salesOrder.findMany({ select: { orderDate: true }, distinct: ["orderDate"] }),
    prisma.salesOrder.findMany({ where: { status: { not: "Cancelled" } }, select: { salesName: true }, distinct: ["salesName"] }),
  ]);
  const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)).filter((x): x is string => !!x))];
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, category: true } }) : [];
  const catOf = new Map(products.map(p => [p.id, p.category]));

  const month = (iso: string) => Number(iso.slice(5, 7)) - 1;
  const actual = Array(12).fill(0) as number[];
  const collected = Array(12).fill(0) as number[];
  const bySales = new Map<string, number>();
  const byCountry = new Map<string, { value: number; orders: number }>();
  const byCategory = new Map<string, number>();
  for (const o of orders) {
    const v = toIdr(o.subtotal, o);
    actual[month(o.orderDate)] += v;
    bySales.set(o.salesName, (bySales.get(o.salesName) ?? 0) + v);
    const c = byCountry.get(o.customer.country) ?? { value: 0, orders: 0 };
    byCountry.set(o.customer.country, { value: c.value + v, orders: c.orders + 1 });
    // Kategori dari item; selisih item vs DPP (diskon header) dibagi proporsional.
    const itemsTotal = o.items.reduce((t, i) => t + i.lineTotal, 0) || 1;
    for (const it of o.items) {
      const cat = (it.productId && catOf.get(it.productId)) || "Lainnya";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + v * it.lineTotal / itemsTotal);
    }
  }
  for (const p of payments) collected[month(p.paymentDate)] += toIdr(p.amount, p.invoice);

  const team = Array(12).fill(0) as number[];
  const salesTargets = new Map<string, number[]>();
  for (const t of targets) {
    if (!t.salesName) team[t.month - 1] = t.amount;
    else {
      const arr = salesTargets.get(t.salesName) ?? Array(12).fill(0);
      arr[t.month - 1] = t.amount;
      salesTargets.set(t.salesName, arr);
    }
  }
  const sum = (a: number[]) => a.reduce((t, n) => t + n, 0);
  const names = [...new Set([...salesPeople.map(s => s.salesName), ...salesTargets.keys()])].sort();

  return {
    year,
    years: [...new Set([year, new Date().getFullYear(), ...years.map(r => Number(r.orderDate.slice(0, 4)))])].sort((a, b) => b - a),
    months: actual.map((a, i) => ({ month: i, target: team[i], actual: Math.round(a), collected: Math.round(collected[i]) })),
    teamTargets: team,
    totals: { target: sum(team), actual: Math.round(sum(actual)), collected: Math.round(sum(collected)), orders: orders.length },
    salesPeople: names.map(n => ({ name: n, actual: Math.round(bySales.get(n) ?? 0), target: sum(salesTargets.get(n) ?? []), targets: salesTargets.get(n) ?? Array(12).fill(0) })),
    countries: [...byCountry.entries()].map(([country, v]) => ({ country, value: Math.round(v.value), orders: v.orders })).sort((a, b) => b.value - a.value),
    categories: [...byCategory.entries()].map(([category, value]) => ({ category, value: Math.round(value) })).sort((a, b) => b.value - a.value),
  };
}
