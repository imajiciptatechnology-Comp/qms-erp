"use client";

import { User, Mail, Shield, Building, Phone, Save, Camera, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { updateProfile } from "../../actions/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function ProfileClient({ user }: { user: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoUrl || null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingPathRef = useRef<string | null>(null);

  if (!user) return <div className="p-8 text-center text-slate-500">Please login first</div>;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isDirty) return;

      const target = (e.target as HTMLElement).closest('a');
      if (target && target.href) {
        const targetUrl = new URL(target.href);
        const currentUrl = new URL(window.location.href);

        // Jika navigasi internal dan beda halaman
        if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingPath(target.href);
          setShowUnsavedModal(true);
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
        setClearPhoto(false);
        setIsDirty(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoPreview(null);
    setClearPhoto(true);
    setIsDirty(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: "", type: "" });

    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);

    setIsLoading(false);
    setMessage({ 
      text: result.message, 
      type: result.success ? "success" : "error" 
    });

    if (result.success) {
      setIsDirty(false);
      if (pendingPathRef.current) {
        router.push(pendingPathRef.current);
      }
    }
  }

  const handleDiscard = () => {
    setIsDirty(false);
    setShowUnsavedModal(false);
    if (pendingPath) {
      router.push(pendingPath);
    }
  };

  const handleSaveAndContinue = () => {
    setShowUnsavedModal(false);
    pendingPathRef.current = pendingPath;
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 text-sm">Manage your personal information and account settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div 
              className="relative mb-4 group cursor-pointer w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-3xl"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.name)
              )}
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            {photoPreview && (
              <button 
                onClick={handleRemovePhoto} 
                className="text-xs text-red-500 hover:text-red-700 font-medium mb-2 -mt-2"
              >
                Remove Photo
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
            <p className="text-slate-500 font-medium mb-3">{user.department}</p>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              {user.role}
            </span>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Quick Info</h3>
            <div className="flex items-center gap-3 text-slate-600 text-sm">
              <Building className="w-4 h-4 text-slate-400" /> {user.department}
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-sm">
              <Mail className="w-4 h-4 text-slate-400" /> {user.email}
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-sm">
              <Phone className="w-4 h-4 text-slate-400" /> {user.phone}
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="col-span-1 md:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
            </div>
            
            <form ref={formRef} onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="p-6 space-y-6">
              {message.text && (
                <div className={`p-3 rounded-lg text-sm font-medium border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <input 
                type="file" 
                name="photo" 
                ref={fileInputRef} 
                onChange={handlePhotoChange} 
                className="hidden" 
                accept="image/*" 
              />
              <input type="hidden" name="clearPhoto" value={clearPhoto.toString()} />

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <input name="name" type="text" defaultValue={user.name} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Email Address (Read Only)</label>
                  <input type="email" defaultValue={user.email} className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 outline-none cursor-not-allowed" readOnly />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                  <input name="phone" type="text" defaultValue={user.phone || ""} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Bio / Notes</label>
                <textarea name="bio" rows={3} defaultValue={user.bio || ""} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-900 bg-white"></textarea>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm disabled:bg-blue-400">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Unsaved Changes</h3>
            <p className="text-slate-600 text-sm mb-6">
              You have unsaved changes in your profile. Do you want to save them before leaving?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDiscard}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button 
                onClick={handleSaveAndContinue}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
