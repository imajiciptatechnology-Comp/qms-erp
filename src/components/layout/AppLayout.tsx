"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "@/app/actions/auth";
import AiAssistant from "@/components/AiAssistant";

export default function AppLayout({ children, user, rolesConfig }: { children: React.ReactNode, user: any, rolesConfig: any[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user && pathname !== "/login") {
      // Token bisa saja valid tapi user-nya sudah tidak ada di database.
      // Hapus cookie dulu, kalau tidak middleware melempar /login balik ke / (loop, layar putih).
      logout().finally(() => {
        window.location.href = "/login";
      });
    } else if (user && pathname === "/login") {
      router.push("/");
    }
  }, [user, pathname, router]);

  // Close sidebar on route change (mobile nav)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!user && pathname !== "/login") return null;
  if (user && pathname === "/login") return null;

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay — closes sidebar on tap outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar user={user} rolesConfig={rolesConfig} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — full width on mobile, offset by sidebar on lg+ */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <Topbar user={user} onMenuToggle={() => setSidebarOpen(v => !v)} />

        <main id="main-content" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>

      <AiAssistant />

    </div>
  );
}
