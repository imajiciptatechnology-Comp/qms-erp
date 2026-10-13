"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = { Open: '#ef4444', Closed: '#10b981', Pending: '#f59e0b', Approved: '#3b82f6', Draft: '#94a3b8' };

export default function DashboardCharts({ 
  ncrs = [], risks = [], equipments = [], audits = [], documents = [], trainings = [], complaints = []
}: { 
  ncrs?: any[], risks?: any[], equipments?: any[], audits?: any[], documents?: any[], trainings?: any[], complaints?: any[]
}) {

  // 1. NCRs by Department (Bar)
  const ncrDeptCount = ncrs.reduce((acc: any, curr: any) => {
    acc[curr.department] = (acc[curr.department] || 0) + 1;
    return acc;
  }, {});
  const ncrDeptData = Object.keys(ncrDeptCount).map(key => ({ name: key, count: ncrDeptCount[key] }));

  // 2. Risks by Level (Pie)
  const riskLevelCount = risks.reduce((acc: any, curr: any) => {
    acc[curr.riskLevel] = (acc[curr.riskLevel] || 0) + 1;
    return acc;
  }, {});
  const riskLevelData = Object.keys(riskLevelCount).map(key => ({ name: key, value: riskLevelCount[key] }));

  // 3. Equipment Status (Pie)
  const equipmentStatusCount = equipments.reduce((acc: any, curr: any) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});
  const equipmentData = Object.keys(equipmentStatusCount).map(key => ({ name: key, value: equipmentStatusCount[key] }));

  // 4. Audits by Status (Pie)
  const auditStatusCount = audits.reduce((acc: any, curr: any) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});
  const auditData = Object.keys(auditStatusCount).map(key => ({ name: key, value: auditStatusCount[key] }));

  // 5. Documents by Status (Pie)
  const docStatusCount = documents.reduce((acc: any, curr: any) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});
  const docData = Object.keys(docStatusCount).map(key => ({ name: key, value: docStatusCount[key] }));

  // 6. Complaints by Status (Bar)
  const complaintCount = complaints.reduce((acc: any, curr: any) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});
  const complaintData = Object.keys(complaintCount).map(key => ({ name: key, count: complaintCount[key] }));

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
