"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { login } from "../actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      setError(result.message || "Login failed");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] relative flex flex-col justify-center items-center p-4 overflow-hidden bg-slate-50">
      {/* Ambient backdrop - radial glows + grain, kept subtle for an enterprise tool */}
      <div
        className="absolute inset-0 -z-10 bg-grain"
        style={{
          background:
            "radial-gradient(600px circle at 15% 20%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(500px circle at 85% 80%, rgba(37,99,235,0.08), transparent 60%)",
        }}
      />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30 text-white font-bold text-2xl shadow-lg">
            QMS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome back</h1>
          <p className="text-blue-100 text-sm">Sign in to the ERP Management System</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center justify-center gap-2 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" defaultChecked />
                <span className="text-slate-600">Remember me</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/20 mt-6 disabled:bg-blue-400 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
