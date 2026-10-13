"use client";

import { useState } from "react";
import { Plus, X, Save, Trash2, Building2, Users, Globe, Target, AlertTriangle, TrendingUp, Minus, Award } from "lucide-react";
import type { ContextData, ContextIssue, InterestedParty } from "./actions";
import { addIssue, deleteIssue, addParty, deleteParty, saveQmsScope, saveQualityPolicy } from "./actions";
import { TabNav, Tab } from "@/components/ui/TabNav";

const RELEVANCE_STYLE: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

const IMPACT_ICON: Record<string, React.ReactNode> = {
  Opportunity: <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />,
  Threat: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
  Neutral: <Minus className="w-3.5 h-3.5 text-slate-400" />,
};

const INTERNAL_CATEGORIES = ["HR / Competency", "Organizational Culture", "Technology & Infrastructure", "Finance", "Processes & Systems", "Internal Policy"];
const EXTERNAL_CATEGORIES = ["Regulations & Legal", "Market & Competition", "External Technology", "Environmental / Social", "Customers", "Suppliers", "Economic"];
const PARTY_CATEGORIES = ["Customers", "Shareholders / Owners", "Employees", "Suppliers / Subcontractors", "Regulators / Government", "Community / Environment", "Business Partners"];

function IssueModal({ type, onClose }: { type: "Internal" | "External"; onClose: () => void }) {
  const [form, setForm] = useState({ type, category: "", description: "", impact: "Neutral" as ContextIssue["impact"], relevance: "Medium" as ContextIssue["relevance"] });
  const [saving, setSaving] = useState(false);
  const cats = type === "Internal" ? INTERNAL_CATEGORIES : EXTERNAL_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addIssue(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 ${type === "Internal" ? "bg-blue-50" : "bg-emerald-50"}`}>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {type === "Internal" ? <Building2 className="w-5 h-5 text-blue-600" /> : <Globe className="w-5 h-5 text-emerald-600" />}
            Add {type} Issue
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
            <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
              <option value="">Select...</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Issue Description *</label>
            <textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue relevant to the organization..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Impact</label>
              <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value as ContextIssue["impact"] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
                <option value="Opportunity">Opportunity</option>
                <option value="Threat">Threat</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Relevance</label>
              <select value={form.relevance} onChange={e => setForm({ ...form, relevance: e.target.value as ContextIssue["relevance"] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PartyModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", category: "", needs: "", monitoringMethod: "", relevance: "Medium" as InterestedParty["relevance"] });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addParty(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-purple-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" /> Add Interested Party</h2>
          <button onClick={onClose} className="p-2 hover:bg-purple-100 rounded-full text-purple-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Name / Group *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Customer ABC"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900">
                <option value="">Select...</option>
                {PARTY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Needs & Expectations *</label>
            <textarea required rows={2} value={form.needs} onChange={e => setForm({ ...form, needs: e.target.value })}
              placeholder="What do they need or expect from the organization?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Monitoring Method</label>
            <input value={form.monitoringMethod} onChange={e => setForm({ ...form, monitoringMethod: e.target.value })}
              placeholder="e.g., Satisfaction survey, Contract review, Regular meetings"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Relevance</label>
            <select value={form.relevance} onChange={e => setForm({ ...form, relevance: e.target.value as InterestedParty["relevance"] })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Add Party"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ContextTab = "issues" | "parties" | "scope" | "policy";

export default function ContextView({ context, user, rolesConfig }: { context: ContextData; user: any; rolesConfig: any[] }) {
  const [activeTab, setActiveTab] = useState<ContextTab>("issues");
  const [addIssueType, setAddIssueType] = useState<"Internal" | "External" | null>(null);
  const [showAddParty, setShowAddParty] = useState(false);
  const [scope, setScope] = useState(context.qmsScope || "");
  const [savingScope, setSavingScope] = useState(false);
  const [policy, setPolicy] = useState(context.qualityPolicy || "");
  const [savingPolicy, setSavingPolicy] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("context") || user?.department === "Quality Assurance";

  const internalIssues = context.issues.filter(i => i.type === "Internal");
  const externalIssues = context.issues.filter(i => i.type === "External");
  const opportunities = context.issues.filter(i => i.impact === "Opportunity").length;

  async function handleSaveScope() {
    setSavingScope(true);
    await saveQmsScope(scope);
    setSavingScope(false);
  }

  async function handleSavePolicy() {
    setSavingPolicy(true);
    await saveQualityPolicy(policy);
    setSavingPolicy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Context of the Organization</h1>
          <p className="text-slate-500 text-sm">Organizational issues & interested parties — ISO 9001:2015 Clause 4.1, 4.2, 4.3</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Internal Issues", val: internalIssues.length, color: "bg-blue-100 text-blue-600", icon: <Building2 className="w-5 h-5" /> },
          { label: "External Issues", val: externalIssues.length, color: "bg-emerald-100 text-emerald-600", icon: <Globe className="w-5 h-5" /> },
          { label: "Opportunities", val: opportunities, color: "bg-teal-100 text-teal-600", icon: <TrendingUp className="w-5 h-5" /> },
          { label: "Interested Parties", val: context.parties.length, color: "bg-purple-100 text-purple-600", icon: <Users className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <TabNav>
        {([
          { key: "issues" as ContextTab, label: "Internal & External Issues", icon: <Building2 className="w-4 h-4" /> },
          { key: "parties" as ContextTab, label: "Interested Parties", icon: <Users className="w-4 h-4" /> },
          { key: "scope" as ContextTab, label: "QMS Scope", icon: <Target className="w-4 h-4" /> },
          { key: "policy" as ContextTab, label: "Quality Policy", icon: <Award className="w-4 h-4" /> },
        ]).map(t => (
          <Tab key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </Tab>
        ))}
      </TabNav>

      {/* ── Tab: Issues ── */}
      {activeTab === "issues" && (
        <div className="space-y-6">
          {/* Internal Issues */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-blue-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" /> Internal Issues (Cl. 4.1)
              </h3>
              {canManage && (
                <button onClick={() => setAddIssueType("Internal")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Issue
                </button>
              )}
            </div>
            {internalIssues.length === 0 ? (
              <p className="px-6 py-8 text-center text-slate-400 text-sm italic">No internal issues registered yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {internalIssues.map(issue => (
                  <div key={issue.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">{issue.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${RELEVANCE_STYLE[issue.relevance]}`}>{issue.relevance}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-600">{IMPACT_ICON[issue.impact]} {issue.impact}</span>
                      </div>
                      <p className="text-sm text-slate-700">{issue.description}</p>
                    </div>
                    {canManage && (
                      <button onClick={() => deleteIssue(issue.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External Issues */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" /> External Issues (Cl. 4.1)
              </h3>
              {canManage && (
                <button onClick={() => setAddIssueType("External")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Issue
                </button>
              )}
            </div>
            {externalIssues.length === 0 ? (
              <p className="px-6 py-8 text-center text-slate-400 text-sm italic">No external issues registered yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {externalIssues.map(issue => (
                  <div key={issue.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">{issue.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${RELEVANCE_STYLE[issue.relevance]}`}>{issue.relevance}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-600">{IMPACT_ICON[issue.impact]} {issue.impact}</span>
                      </div>
                      <p className="text-sm text-slate-700">{issue.description}</p>
                    </div>
                    {canManage && (
                      <button onClick={() => deleteIssue(issue.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Interested Parties ── */}
      {activeTab === "parties" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-purple-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> Interested Parties (Cl. 4.2)
            </h3>
            {canManage && (
              <button onClick={() => setShowAddParty(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Party
              </button>
            )}
          </div>
          {context.parties.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-400 text-sm italic">No interested parties registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Name / Group</th>
                    <th className="px-6 py-3 font-semibold">Category</th>
                    <th className="px-6 py-3 font-semibold">Needs & Expectations</th>
                    <th className="px-6 py-3 font-semibold">Monitoring Method</th>
                    <th className="px-6 py-3 font-semibold">Relevance</th>
                    {canManage && <th className="px-6 py-3 font-semibold text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {context.parties.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">{p.category}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs text-slate-600">{p.needs}</td>
                      <td className="px-6 py-4 text-slate-600">{p.monitoringMethod || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${RELEVANCE_STYLE[p.relevance]}`}>{p.relevance}</span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => deleteParty(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: QMS Scope ── */}
      {activeTab === "scope" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-indigo-500" /> QMS Scope (Cl. 4.3)
            </h3>
            <p className="text-xs text-slate-500">Document the boundaries and applicability of the QMS, including any exclusions and justification.</p>
          </div>
          <textarea rows={8} value={scope} onChange={e => setScope(e.target.value)}
            disabled={!canManage}
            placeholder={`Example: This QMS applies to the design, production, and delivery of products at the [facility name] facility. Exclusion: Clause 8.3 (Design & Development) is excluded as the organization does not perform product design.`}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-600" />
          {context.lastReviewedDate && (
            <p className="text-xs text-slate-400">Last updated: {context.lastReviewedDate} by {context.reviewedBy}</p>
          )}
          {canManage && (
            <button onClick={handleSaveScope} disabled={savingScope}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <Save className="w-4 h-4" /> {savingScope ? "Saving..." : "Save Scope"}
            </button>
          )}
        </div>
      )}

      {/* ── Tab: Quality Policy ── */}
      {activeTab === "policy" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-amber-500" /> Quality Policy (Cl. 5.2)
              </h3>
              <p className="text-xs text-slate-500">The quality policy must be consistent with the organizational context, include a commitment to satisfy requirements and continually improve the QMS, and be communicated to all personnel.</p>
            </div>
            <textarea rows={12} value={policy} onChange={e => setPolicy(e.target.value)}
              disabled={!canManage}
              placeholder={`Example Quality Policy:\n\n[Organization Name] is committed to:\n\n1. Meeting customer requirements and applicable regulatory requirements\n2. Continually improving the effectiveness of the quality management system\n3. Establishing and reviewing quality objectives on a regular basis\n4. Providing adequate resources to achieve quality objectives\n\nThis quality policy is communicated to all personnel and reviewed periodically.\n\nIssued by:\n[Name] — [Title]\n[Date]`}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-600 font-mono leading-relaxed" />
            {context.policyLastUpdated && (
              <p className="text-xs text-slate-400">Last updated: {context.policyLastUpdated} by {context.policyUpdatedBy}</p>
            )}
            {canManage && (
              <button onClick={handleSavePolicy} disabled={savingPolicy}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                <Save className="w-4 h-4" /> {savingPolicy ? "Saving..." : "Save Quality Policy"}
              </button>
            )}
          </div>

          {context.qualityPolicy && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-amber-800">Quality Policy Preview</h4>
                <button onClick={() => window.print()}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                  🖨️ Print
                </button>
              </div>
              <div className="bg-white rounded-lg p-6 border border-amber-100 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed shadow-sm">
                {context.qualityPolicy}
              </div>
            </div>
          )}
        </div>
      )}

      {addIssueType && <IssueModal type={addIssueType} onClose={() => setAddIssueType(null)} />}
      {showAddParty && <PartyModal onClose={() => setShowAddParty(false)} />}
    </div>
  );
}
