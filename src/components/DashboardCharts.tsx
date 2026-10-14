"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ChartDatum } from '@/app/dashboard-data';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = { Open: '#ef4444', Closed: '#10b981', Pending: '#f59e0b', Approved: '#3b82f6', Draft: '#94a3b8' };

// Data sudah diagregasi di server (lihat getDashboardData), jadi yang dikirim
// ke browser hanya angka per kategori, bukan seluruh isi tabel.
export default function DashboardCharts({
  ncrByDept = [], riskByLevel = [], documentByStatus = [], auditByStatus = [], equipmentByStatus = []
}: {
  ncrByDept?: ChartDatum[], riskByLevel?: ChartDatum[], documentByStatus?: ChartDatum[], auditByStatus?: ChartDatum[], equipmentByStatus?: ChartDatum[]
}) {
  const ncrDeptData = ncrByDept.map(d => ({ name: d.name, count: d.value }));
  const riskLevelData = riskByLevel;
  const equipmentData = equipmentByStatus;
  const auditData = auditByStatus;
  const docData = documentByStatus;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 mt-2">
      
      {/* NCRs by Department Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
        <h3 className="text-lg font-bold text-slate-800 mb-4">NCRs by Department</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ncrDeptData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risks Pie Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Risks by Level</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={riskLevelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {riskLevelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs mt-4">
          {riskLevelData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
              <span className="text-slate-600">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Document Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Document Status</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={docData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {docData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={(STATUS_COLORS as any)[entry.name] || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs mt-4">
          {docData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (STATUS_COLORS as any)[entry.name] || COLORS[index % COLORS.length] }}></div>
              <span className="text-slate-600">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audits Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Audit Status</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={auditData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {auditData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs mt-4">
          {auditData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }}></div>
              <span className="text-slate-600">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Equipment Status</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={equipmentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {equipmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444'][index % 3]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs mt-4">
          {equipmentData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#10b981', '#f59e0b', '#ef4444'][index % 3] }}></div>
              <span className="text-slate-600">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
