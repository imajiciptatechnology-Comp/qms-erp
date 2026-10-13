"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, User, Settings, LogOut, CheckCircle, Trash2, X, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import { getMyNotifications, markNotificationAsRead, deleteNotification, clearAllNotifications, Notification } from "@/app/actions/notifications";
import { MODULES } from "./Sidebar";

export default function Topbar({ user, onMenuToggle }: { user: any; onMenuToggle?: () => void }) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch notifications
    getMyNotifications().then(setNotifications);

    // Close dropdowns when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleReadNotif = async (id: string, link?: string) => {
    await markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (link) {
      router.push(link);
      setIsNotifOpen(false);
    }
  };

  const handleDeleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const searchResults = MODULES.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 flex-1">
        {/* Hamburger — only visible on mobile/tablet */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative w-full max-w-md hidden md:block" ref={searchRef}>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search across all modules..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 text-sm outline-none transition-all"
          />
          
          {/* Global Search Results Dropdown */}
          {isSearchFocused && searchQuery && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-lg shadow-slate-900/10 border border-slate-100 py-2 overflow-hidden z-50">
              <div className="px-3 pb-2 text-xs font-semibold text-slate-500">MODULES</div>
              {searchResults.length > 0 ? searchResults.map(res => (
                <Link 
                  key={res.id} 
                  href={res.path}
                  onClick={() => setIsSearchFocused(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <res.icon className="w-4 h-4 text-slate-400" />
                  {res.name}
                </Link>
              )) : (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">No modules found.</div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 hover:bg-slate-100 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg shadow-slate-900/10 border border-slate-100 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{unreadCount} New</span>}
                </div>
                {notifications.length > 0 && (
                  <button onClick={handleClearAll} className="text-xs text-slate-500 hover:text-red-600 transition-colors">Clear All</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleReadNotif(notif.id, notif.link)}
                    className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 relative group ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1 pr-6">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{notif.message}</p>
                      {!notif.isRead && <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>}
                    </div>
                    <p className="text-xs text-slate-400">{new Date(notif.createdAt).toLocaleString()}</p>
                    
                    <button 
                      onClick={(e) => handleDeleteNotif(e, notif.id)}
                      className="absolute right-3 top-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No new notifications</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border-2 border-blue-200 hover:border-blue-400 transition-colors overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              getInitials(user?.name)
            )}
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg shadow-slate-900/10 border border-slate-100 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100 mb-1">
                <p className="text-sm font-semibold text-slate-800">{user?.name || "Guest"}</p>
                <p className="text-xs text-slate-500">{user?.role || "No Role"}</p>
              </div>
              
              <Link 
                href="/settings/profile" 
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              >
                <User className="w-4 h-4" /> My Profile
              </Link>
              
              {user?.role === "Super Admin" && (
                <Link 
                  href="/settings/roles" 
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                >
                  <Settings className="w-4 h-4" /> User & Roles
                </Link>
              )}
              
              <div className="h-px bg-slate-100 my-1"></div>
              
              <button 
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
