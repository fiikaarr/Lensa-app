export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-950 via-indigo-950 to-rose-950 px-8 py-3.5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.4)] border-b border-rose-900/40 flex items-center justify-between relative overflow-hidden">
      
      {/* Efek kilau halus metalik (sheen layer) */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none"></div>

      {/* Sisi Kiri: Tombol Menu & Judul */}
      <div className="flex items-center space-x-3 relative z-10">
        <button className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold shadow-inner border border-white/20 cursor-pointer transition backdrop-blur-md">
          <i className="fa-solid fa-bars text-sm"></i>
        </button>
        <h2 className="text-sm font-black tracking-tight text-white uppercase drop-shadow-sm">
          Service Quality Performance Monitoring
        </h2>
      </div>

      {/* Sisi Kanan: Kapsul Teks Berjalan & Tombol Update */}
      <div className="flex items-center space-x-3 relative z-10">
        {/* Kapsul dengan teks berjalan (disesuaikan dengan tema gelap/transparan kaca) */}
        <div className="hidden md:flex items-center space-x-2 px-3.5 py-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-2xl text-xs font-bold text-slate-100 shadow-inner w-64 overflow-hidden">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0"></span>
          <marquee scrollamount="5" className="text-xs font-bold text-slate-100">
            Qyyyy!! Semangattt yaa✨
          </marquee>
        </div>
        
        {/* Tombol Weekly Update dengan efek berkedip & kontras tinggi */}
        <button className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/40 animate-pulse">
          <i className="fa-solid fa-circle-check text-white"></i>
          <span>WEEKLY UPDATE</span>
        </button>
      </div>

    </header>
  );
}