import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, Database, Users, Award, Weight, UploadCloud, ExternalLink, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sidebar({ userRole = "SERVICE QUALITY", onLogout }) {
  const location = useLocation();

  // Cek apakah user sedang berada di halaman tapping atau turunannya
  const isTappingActive = location.pathname.startsWith('/tapping');

  const menuItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/readiness', label: 'Daily Readiness', icon: Activity },
    { path: '/tapping', label: 'Data Tapping CSR', icon: Database },
    { path: '/tryout', label: 'Tryout T-Fronters', icon: Award },
    { path: '/bmi-monitoring', label: 'BMI T-Fronters', icon: Weight },
    { path: '/coaching', label: 'Data Coaching', icon: Users },
    { path: '/import', label: 'Import Data', icon: UploadCloud },
  ];

  // Memastikan pengecekan role aman (mengabaikan perbedaan huruf besar/kecil seperti "service quality" atau "SQ")
  const normalizedRole = String(userRole || '').trim().toUpperCase();
  const isSQRole = normalizedRole.includes('SQ') || normalizedRole.includes('SERVICE QUALITY');

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 via-indigo-950/60 to-rose-950/40 border-r border-slate-800/60 p-5 flex flex-col shrink-0 min-h-screen shadow-xl z-20">
      <div className="flex items-center gap-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden">
          <img src="/icons-lensa.svg" alt="Lensa Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-slate-100">Lensa Quality Insight</h1>
          <p className="text-xs text-slate-400">SQ Mitra Area 4</p>
        </div>
      </div>

      <nav className="space-y-1.5 flex-1 relative">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <div key={item.path} className="space-y-1.5">
              <Link
                to={item.path}
                className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors duration-200 z-10 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Background Merah Gradasi yang Bergeser Lembut (Layout Animation) */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-red-600/90 to-rose-500/90 rounded-xl shadow-md shadow-red-600/20 border border-red-500/30 z-[-1]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}

                {/* Garis putih kecil di sebelah kiri */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full" />
                )}
                
                <Icon 
                  size={18} 
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`} 
                />
                <span>{item.label}</span>
              </Link>

              {/* Sub-menu Fokus Sales-Retensi: Hanya muncul jika menu Data Tapping CSR sedang aktif / diklik */}
              {item.path === '/tapping' && isTappingActive && (
                <Link
                  to="/tapping/sales-retensi"
                  className={`relative flex items-center gap-3 pl-9 pr-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 z-10 ${
                    location.pathname === '/tapping/sales-retensi'
                      ? 'text-white bg-indigo-600/60 border border-indigo-400/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <TrendingUp size={14} className={location.pathname === '/tapping/sales-retensi' ? 'text-white' : 'text-slate-400'} />
                  <span>Fokus Sales-Retensi</span>
                </Link>
              )}
            </div>
          );
        })}

        {/* Menu Tapple Audio QC - Hanya tampil khusus untuk role Service Quality / SQ */}
        {isSQRole && (
          <a
            href="https://tapping-sample.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors duration-200 group mt-1"
          >
            <div className="flex items-center gap-3">
              <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                <img 
                  src="/icons-tapple.svg" 
                  alt="Tapple Icon" 
                  className="w-full h-full object-contain opacity-75 group-hover:opacity-100 transition-opacity" 
                />
              </div>
              <span>Tapple App</span>
            </div>
            <ExternalLink size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
          </a>
        )}
      </nav>

      <div className="mt-auto pt-4 space-y-2 border-t border-slate-800/60">
        <div className="flex items-center bg-slate-900/65 backdrop-blur-sm border border-slate-800/60 rounded-xl p-2 shadow-inner">
          <div className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-300 flex items-center justify-center text-xs font-bold mr-2.5 border border-slate-700/50">
            <i className="fa-solid fa-circle-user text-emerald-400 text-sm"></i>
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Role:</p>
            <p className="text-xs font-bold text-emerald-400 truncate tracking-wide uppercase">{userRole}</p>
          </div>
        </div>

        {/* Tombol Logout */}
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900/40 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-slate-800/60 hover:border-rose-900/40 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer backdrop-blur-sm"
        >
          <i className="fa-solid fa-right-from-bracket text-xs"></i>
          <span>Ganti Akun / Role</span>
        </button>
      </div>
    </aside>
  );
}