import { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [notifications, setNotifications] = useState([]);

  const showNotify = (title, message, type = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  const loginAsViewer = () => {
    localStorage.setItem('sqUserName', 'VIEWER');
    localStorage.setItem('sqUserRole', 'VIEWER');
    if (onLoginSuccess) onLoginSuccess('VIEWER');
  };

  const loginWithPassword = () => {
    const trimmedPass = password.trim();
    if (trimmedPass === 'grapari') {
      localStorage.setItem('sqUserName', 'TEAM LEADER');
      localStorage.setItem('sqUserRole', 'TL');
      if (onLoginSuccess) onLoginSuccess('TEAM LEADER');
    } else if (trimmedPass === 'baruga3') {
      localStorage.setItem('sqUserName', 'SERVICE QUALITY');
      localStorage.setItem('sqUserRole', 'SQ');
      if (onLoginSuccess) onLoginSuccess('SERVICE QUALITY');
    } else {
      showNotify('Login Gagal', 'Password salah! Silakan periksa kembali password yang Anda masukkan.', 'error');
      setPassword('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loginWithPassword();
    }
  };

  return (
    <div className="bg-[#090d16] text-slate-100 flex items-center justify-center h-screen overflow-hidden relative selection:bg-rose-500 selection:text-white font-sans w-screen">
      
      {/* Definisi Keyframes Animasi Smooth Floating */}
      <style>{`
        @keyframes floatSmooth1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-0.5deg); }
        }
        @keyframes floatSmooth2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(14px) rotate(0.5deg); }
        }
        @keyframes floatSmooth3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(0.5deg); }
        }
        @keyframes floatSmooth4 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(12px) rotate(-0.5deg); }
        }
        .animate-smooth-1 { animation: floatSmooth1 6s ease-in-out infinite; }
        .animate-smooth-2 { animation: floatSmooth2 7s ease-in-out infinite; }
        .animate-smooth-3 { animation: floatSmooth3 6.5s ease-in-out infinite; }
        .animate-smooth-4 { animation: floatSmooth4 7.5s ease-in-out infinite; }
      `}</style>

      {/* Container Notifikasi Toast Modern */}
      <div className="fixed top-6 right-6 z-[100000] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => {
          const config = {
            success: { bg: 'bg-emerald-950/90', border: 'border-emerald-800/80', icon: 'fa-check-circle', color: 'text-emerald-400', title: 'text-emerald-200' },
            error: { bg: 'bg-rose-950/90', border: 'border-rose-800/80', icon: 'fa-exclamation-circle', color: 'text-rose-400', title: 'text-rose-200' },
            info: { bg: 'bg-slate-900/90', border: 'border-slate-800', icon: 'fa-info-circle', color: 'text-sky-400', title: 'text-white' }
          };
          const c = config[n.type] || config.info;

          return (
            <div key={n.id} className={`pointer-events-auto flex items-start gap-3 p-4 min-w-[300px] max-w-sm ${c.bg} backdrop-blur-xl border ${c.border} rounded-2xl shadow-2xl`}>
              <i className={`fa-solid ${c.icon} ${c.color} text-lg mt-0.5`}></i>
              <div className="flex-1">
                <h4 className={`text-xs font-bold ${c.title}`}>{n.title}</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium leading-relaxed">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <i className="fa-solid fa-times text-xs"></i>
              </button>
            </div>
          );
        })}
      </div>

      {/* Background Ornaments & Glows */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* 1. Kartu Kiri Atas (Live Metric) */}
      <div className="absolute top-10 left-10 hidden xl:block p-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl w-64 space-y-2 select-none z-10 animate-smooth-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-chart-line"></i> LIVE METRIC</span>
          <i className="fa-solid fa-globe text-slate-500 text-xs"></i>
        </div>
        <p className="text-xs font-medium text-slate-300">Regional Performance</p>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-black text-white">94.8%</span>
          <span className="text-[10px] text-emerald-400 font-semibold">+4.2% minggu ini</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full w-[94.8%] rounded-full"></div>
        </div>
      </div>

      {/* 2. Kartu Kiri Bawah (Tapping Activity) */}
      <div className="absolute bottom-10 left-10 hidden xl:block p-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl w-64 space-y-2 select-none z-10 animate-smooth-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-sky-400">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-headphones"></i> Tapping Activity</span>
          <span className="text-[9px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-semibold">Area 4</span>
        </div>
        <div className="flex items-end justify-between h-10 pt-2 gap-1.5 px-1">
          <div className="w-full bg-slate-800 rounded-t h-[45%]"></div>
          <div className="w-full bg-slate-800 rounded-t h-[70%]"></div>
          <div className="w-full bg-indigo-500 rounded-t h-[95%] shadow-sm shadow-indigo-500/50"></div>
          <div className="w-full bg-slate-800 rounded-t h-[60%]"></div>
          <div className="w-full bg-slate-800 rounded-t h-[80%]"></div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 font-medium px-0.5">
          <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span>
        </div>
      </div>

      {/* 3. Kartu Kanan Atas (Top Score) */}
      <div className="absolute top-10 right-10 hidden xl:block p-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl w-64 space-y-2 select-none z-10 animate-smooth-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-amber-400">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-award"></i> TOP SCORE</span>
          <i className="fa-solid fa-star text-amber-400 text-xs"></i>
        </div>
        <p className="text-xs font-medium text-slate-300">Average Quality Index</p>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-black text-white">89.2 pts</span>
          <span className="text-[9px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">target terlampaui</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-amber-500 h-full w-[89.2%] rounded-full"></div>
        </div>
      </div>

      {/* 4. Kartu Kanan Bawah (System Security) */}
      <div className="absolute bottom-10 right-10 hidden xl:block p-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl w-64 space-y-2 select-none z-10 animate-smooth-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-shield-halved"></i> System Security</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <p className="text-[11px] text-slate-300 font-medium">🔒 Encrypted & Secure</p>
        <div className="flex items-center gap-2 pt-1 text-slate-500 text-xs">
          <span className="w-7 h-7 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400"><i className="fa-solid fa-headphones text-[10px]"></i></span>
          <span className="w-7 h-7 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400"><i className="fa-solid fa-chart-pie text-[10px]"></i></span>
          <span className="w-7 h-7 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400"><i className="fa-solid fa-comments text-[10px]"></i></span>
          <span className="w-7 h-7 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400"><i className="fa-solid fa-graduation-cap text-[10px]"></i></span>
        </div>
      </div>

      {/* Container Utama Login */}
      <div className="w-full max-w-md p-8 bg-slate-900/90 backdrop-blur-2xl border border-slate-800/80 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] space-y-6 z-20 mx-4">
        
        {/* Header Logo & Title */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img src="/icons-lensa.svg" alt="Lensa Logo" className="w-14 h-14 object-contain mb-1" />
          <h1 className="text-sm font-black tracking-wider text-white">Lensa - Quality Insight</h1>
          <p className="text-[11px] text-slate-400 font-medium">Analytics Hub & Performance Tracking System</p>
        </div>  

        {/* Kontrol Login */}
        <div className="space-y-4 pt-1">
          <button 
            onClick={loginAsViewer} 
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition duration-200 cursor-pointer flex items-center justify-center space-x-2"
          >
            <i className="fa-solid fa-eye text-xs"></i>
            <span>LOGIN AS VIEWER</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">ATAU ADMIN</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 tracking-wide block">Password Admin</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
                <i className="fa-solid fa-lock text-xs"></i>
              </span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Masukkan password admin..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs font-medium text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition shadow-inner"
              />
            </div>
          </div>

          <button 
            onClick={loginWithPassword} 
            className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl text-xs font-bold shadow-[0_10px_20px_-5px_rgba(225,29,72,0.5)] transition duration-200 cursor-pointer flex items-center justify-center space-x-2"
          >
            <i className="fa-solid fa-user-shield text-xs"></i>
            <span>LOGIN AS ADMIN</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-2 text-center border-t border-slate-800/80">
          <p className="text-[10px] text-slate-500 font-medium">&copy; 2026 &bull; Lensa by FKR</p>
        </div>
      </div>
    </div>
  );
}