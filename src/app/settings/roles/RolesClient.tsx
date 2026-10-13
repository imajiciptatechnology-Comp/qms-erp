"use client";

import { ShieldCheck, Users, MoreVertical, Loader2, Key } from "lucide-react";
import { useState } from "react";
import { changeUserRole, updateRolePermissions } from "../../actions/auth";
import { MODULES } from "@/components/layout/Sidebar";

export default function RolesClient({ users, currentUser, initialRolesConfig }: { users: any[], currentUser: any, initialRolesConfig: any[] }) {
  const [activeTab, setActiveTab] = useState<"users" | "permissions">("users");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Local state for permissions
  const [rolesConfig, setRolesConfig] = useState<any[]>(initialRolesConfig);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: string) {
    setLoadingId(userId);
    const res = await changeUserRole(userId, newRole);
    setLoadingId(null);
    if (!res.success) alert(res.message);
  }

  const handleTogglePermission = (roleName: string, moduleId: string) => {
    if (roleName === "Super Admin") return;

    setRolesConfig(prev => prev.map(role => {
      if (role.name === roleName) {
        const hasPerm = role.permissions.includes(moduleId);
        const newPerms = hasPerm 
          ? role.permissions.filter((p: string) => p !== moduleId)
          : [...role.permissions, moduleId];
        return { ...role, permissions: newPerms };
      }
      return role;
    }));
  };

  const handleSavePermissions = async (roleName: string) => {
    setSavingRole(roleName);
    const roleToSave = rolesConfig.find(r => r.name === roleName);
    if (roleToSave) {
      const res = await updateRolePermissions(roleName, roleToSave.permissions);
      if (!res.success) alert(res.message);
    }
    setSavingRole(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User & Role Management</h1>
          <p className="text-slate-500 text-sm">Assign roles to users and configure module access permissions.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab("users")}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === "users" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4"/> User Assignments</div>
          {activeTab === "users" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t"></div>}
        </button>
        <button 
          onClick={() => setActiveTab("permissions")}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === "permissions" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-2"><Key className="w-4 h-4"/> Role Permissions Matrix</div>
          {activeTab === "permissions" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t"></div>}
        </button>
      </div>

      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">{u.department}</td>
                  <td className="px-6 py-4">
                    {currentUser.role === "Super Admin" && currentUser.id !== u.id ? (
                      <select
                        className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                        defaultValue={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={loadingId === u.id}
                      >
                        <option value="Super Admin">Super Admin</option>
                        <option value="QA Manager">QA Manager</option>
                        <option value="Production Head">Production Head</option>
                        <option value="HSE Officer">HSE Officer</option>
                        <option value="Staff">Staff</option>
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-slate-700 font-medium text-xs">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {u.role}
                      </span>
                    )}
                    {loadingId === u.id && <Loader2 className="w-4 h-4 animate-spin inline-block ml-2 text-blue-600" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 text-sm">
            Check the boxes to grant module access to a specific role. <strong>Super Admin</strong> always has access to all modules.
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {rolesConfig.map(role => (
              <div key={role.name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-5 h-5 ${role.name === 'Super Admin' ? 'text-purple-600' : 'text-blue-600'}`} />
                    <h3 className="font-bold text-slate-800">{role.name}</h3>
                  </div>
                  {role.name !== "Super Admin" && (
                    <button 
                      onClick={() => handleSavePermissions(role.name)}
                      disabled={savingRole === role.name}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                    >
                      {savingRole === role.name && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save
                    </button>
                  )}
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-3 flex-1">
                  {/* Additional Privileges */}
                  <div className="col-span-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Special Privileges</div>
                    <label className={`flex items-center gap-3 p-2 rounded-lg border ${role.name === 'Super Admin' || role.permissions.includes('document_approve') ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 hover:bg-slate-50'} ${role.name === 'Super Admin' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        checked={role.name === 'Super Admin' || role.permissions.includes('document_approve')}
                        onChange={() => handleTogglePermission(role.name, 'document_approve')}
                        disabled={role.name === 'Super Admin'}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        Can Approve Documents
                      </span>
                    </label>
                    <label className={`flex items-center gap-3 p-2 rounded-lg border ${role.name === 'Super Admin' || role.permissions.includes('audit_manage') ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 hover:bg-slate-50'} ${role.name === 'Super Admin' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} mt-2`}>
                      <input 
                        type="checkbox" 
                        checked={role.name === 'Super Admin' || role.permissions.includes('audit_manage')}
                        onChange={() => handleTogglePermission(role.name, 'audit_manage')}
                        disabled={role.name === 'Super Admin'}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        Can Manage Audits
                      </span>
                    </label>
                  </div>

                  <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2 mb-1">Module Access</div>
                  {MODULES.map(mod => {
                    const isSuperAdmin = role.name === "Super Admin";
                    const isChecked = isSuperAdmin || role.permissions.includes(mod.id);
                    
                    return (
                      <label 
                        key={mod.id} 
                        className={`flex items-center gap-3 p-2 rounded-lg border ${isChecked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 hover:bg-slate-50'} ${isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleTogglePermission(role.name, mod.id)}
                          disabled={isSuperAdmin}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <mod.icon className="w-4 h-4 text-slate-400" />
                          {mod.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
