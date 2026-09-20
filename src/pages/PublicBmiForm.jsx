import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import logoSq from '../assets/logo-sq.png';

export default function PublicBmiForm() {
  useEffect(() => {
    document.title = 'Form Submit BMI | Lensa Insight';
  }, []);

  const [csrDatabase, setCsrDatabase] = useState([]);
  const [formData, setFormData] = useState({
    nik_csr: '',
    nama_csr: '',
    job: 'CSR',
    mitra: 'Infomedia', // Default Mitra
    jenisKelamin: 'Laki-Laki',
    region: '',
    cluster: '',
    unit_name: '',
    tinggiBadan: '',
    beratBadan: '',
    linkEviden: ''
  });

  const [calculatedBmi, setCalculatedBmi] = useState({ nilai: 0, kategori: '-' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchCsrData = async () => {
      try {
        const { data, error } = await supabase.from('database_csr').select('*');
        if (error) throw error;
        setCsrDatabase(data || []);
      } catch (err) {
        console.error("Gagal memuat database CSR:", err.message);
      }
    };
    fetchCsrData();
  }, []);

  useEffect(() => {
    const t = parseFloat(formData.tinggiBadan);
    const b = parseFloat(formData.beratBadan);

    if (t > 0 && b > 0) {
      const tinggiMeter = t / 100;
      const bmiValue = (b / (tinggiMeter * tinggiMeter)).toFixed(1);
      
      let kat = '-';
      const numBmi = parseFloat(bmiValue);
      if (numBmi < 18.5) kat = 'Kekurangan Berat Badan (Underweight)';
      else if (numBmi >= 18.5 && numBmi <= 24.9) kat = 'Normal (Ideal)';
      else if (numBmi >= 25 && numBmi <= 29.9) kat = 'Kelebihan Berat Badan (Overweight)';
      else kat = 'Obesitas (Obesity)';

      setCalculatedBmi({ nilai: bmiValue, kategori: kat });
    } else {
      setCalculatedBmi({ nilai: 0, kategori: '-' });
    }
  }, [formData.tinggiBadan, formData.beratBadan]);

  // Pengaturan Tema Warna Berdasarkan Kategori BMI
  let bmiTheme = {
    container: 'bg-slate-50 border-slate-200 text-slate-800',
    textMain: 'text-slate-900',
    textSub: 'text-slate-500',
    badge: 'bg-slate-200 text-slate-800'
  };

  if (calculatedBmi.nilai > 0) {
    if (calculatedBmi.kategori.includes('Normal')) {
      bmiTheme = {
        container: 'bg-gradient-to-br from-emerald-50 via-emerald-100/60 to-emerald-200/50 border-emerald-300 text-emerald-950',
        textMain: 'text-emerald-950',
        textSub: 'text-emerald-700',
        badge: 'bg-emerald-600 text-white'
      };
    } else if (calculatedBmi.kategori.includes('Kekurangan')) {
      bmiTheme = {
        container: 'bg-gradient-to-br from-amber-50 via-amber-100/60 to-amber-200/50 border-amber-300 text-amber-950',
        textMain: 'text-amber-950',
        textSub: 'text-amber-700',
        badge: 'bg-amber-500 text-white'
      };
    } else {
      bmiTheme = {
        container: 'bg-gradient-to-br from-rose-50 via-rose-100/60 to-rose-200/50 border-rose-300 text-rose-950',
        textMain: 'text-rose-950',
        textSub: 'text-rose-700',
        badge: 'bg-rose-600 text-white'
      };
    }
  }

  const handleNikChange = (val) => {
    const cleanNik = val.trim();
    const found = csrDatabase.find(
      i => String(i.nik_csr || '').trim() === cleanNik
    );

    if (found) {
      setFormData(prev => ({
        ...prev,
        nik_csr: cleanNik,
        nama_csr: found.nama_csr || '',
        job: found.job || 'CSR',
        mitra: found.mitra || 'Infomedia',
        region: found.region || '',
        cluster: found.cluster || '',
        unit_name: found.unit_name || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        nik_csr: cleanNik,
        nama_csr: '',
        job: 'CSR',
        mitra: 'Infomedia',
        region: '',
        cluster: '',
        unit_name: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nik_csr || !formData.nama_csr) {
      setErrorMessage("Harap masukkan NIK / SIAD yang terdaftar agar data ter-auto-fill dengan benar.");
      return;
    }
    if (!formData.tinggiBadan || !formData.beratBadan || !formData.linkEviden) {
      setErrorMessage("Harap lengkapi Tinggi Badan, Berat Badan, dan Link Eviden Lightshot.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        tanggal: new Date().toISOString().slice(0, 10),
        nik_csr: formData.nik_csr,
        nama_csr: formData.nama_csr,
        job: formData.job,
        mitra: formData.mitra,
        jenis_kelamin: formData.jenisKelamin,
        region: formData.region,
        cluster: formData.cluster,
        unit_name: formData.unit_name,
        tinggi_badan: parseFloat(formData.tinggiBadan),
        berat_badan: parseFloat(formData.beratBadan),
        nilai_bmi: parseFloat(calculatedBmi.nilai),
        kategori: calculatedBmi.kategori,
        link_eviden: formData.linkEviden
      };

      const { error } = await supabase.from('database_bmi').insert([payload]);
      if (error) throw error;

      setSuccessMessage("Data Monitoring BMI berhasil dikirim! Terima kasih.");
      setFormData(prev => ({
        ...prev,
        nik_csr: '',
        nama_csr: '',
        mitra: 'Infomedia',
        region: '',
        cluster: '',
        unit_name: '',
        tinggiBadan: '',
        beratBadan: '',
        linkEviden: ''
      }));
    } catch (err) {
      setErrorMessage("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 font-sans flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 border border-slate-100 space-y-6">
        
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-full flex items-center justify-center pt-2">
            <img 
              src={logoSq} 
              alt="Logo Service Quality Area 4" 
              className="w-full h-auto object-contain block max-h-20" 
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Form Monitoring BMI T-Fronters</h2>
            <p className="text-xs text-slate-600 font-semibold">Masukkan NIK/SIAD Anda untuk pengisian data otomatis dari database.</p>
          </div>
        </div>

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold text-center shadow-sm">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl text-xs font-bold text-center shadow-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* NIK / SIAD */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 tracking-wide text-xs">NIK / SIAD <span className="text-rose-600 font-black">*</span></label>
            <input 
              type="text" 
              value={formData.nik_csr} 
              onChange={e => handleNikChange(e.target.value)} 
              placeholder="Ketik NIK/SIAD lalu data akan terisi otomatis..." 
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 transition shadow-inner" 
              required 
            />
          </div>

          {/* Nama Lengkap */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 tracking-wide text-xs">Nama Lengkap <span className="text-slate-400 font-medium">(Auto-Fill)</span></label>
            <input 
              type="text" 
              value={formData.nama_csr} 
              readOnly 
              placeholder="Otomatis terisi dari database..." 
              className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold cursor-not-allowed shadow-inner" 
            />
          </div>

          {/* Posisi, Mitra & Jenis Kelamin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Posisi / Job</label>
              <input 
                type="text" 
                value={formData.job} 
                readOnly 
                className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold cursor-not-allowed shadow-inner" 
              />
            </div>
            
            {/* INPUT MITRA */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Mitra <span className="text-rose-600 font-black">*</span></label>
              <select 
                value={formData.mitra} 
                onChange={e => setFormData({...formData, mitra: e.target.value})} 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 cursor-pointer transition shadow-inner"
              >
                <option value="Infomedia">Infomedia</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Jenis Kelamin</label>
              <select 
                value={formData.jenisKelamin} 
                onChange={e => setFormData({...formData, jenisKelamin: e.target.value})} 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 cursor-pointer transition shadow-inner"
              >
                <option value="Laki-Laki">Laki-Laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          {/* Region, Cluster, Unit Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Region</label>
              <input 
                type="text" 
                value={formData.region} 
                readOnly 
                placeholder="Region..." 
                className="w-full px-3 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold cursor-not-allowed shadow-inner" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Cluster</label>
              <input 
                type="text" 
                value={formData.cluster} 
                readOnly 
                placeholder="Cluster..." 
                className="w-full px-3 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold cursor-not-allowed shadow-inner" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Unit Name</label>
              <input 
                type="text" 
                value={formData.unit_name} 
                readOnly 
                placeholder="Unit Name..." 
                className="w-full px-3 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold cursor-not-allowed shadow-inner" 
              />
            </div>
          </div>

          {/* Tinggi & Berat Badan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-slate-200">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Tinggi Badan (CM) <span className="text-rose-600 font-black">*</span></label>
              <input 
                type="number" 
                step="any" 
                value={formData.tinggiBadan} 
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '.');
                  setFormData({...formData, tinggiBadan: val});
                }} 
                onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                placeholder="Cth: 170" 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 transition shadow-inner" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 tracking-wide text-xs">Berat Badan (KG) <span className="text-rose-600 font-black">*</span></label>
              <input 
                type="number" 
                step="any" 
                value={formData.beratBadan} 
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '.');
                  setFormData({...formData, beratBadan: val});
                }} 
                onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                placeholder="Cth: 65.5" 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 transition shadow-inner" 
                required 
              />
            </div>
          </div>

          {/* Live Preview Perhitungan BMI dengan Warna Dinamis */}
          {calculatedBmi.nilai > 0 && (
            <div className={`p-4 border rounded-2xl flex items-center justify-between shadow-sm transition-all duration-300 ${bmiTheme.container}`}>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider block ${bmiTheme.textSub}`}>Hasil Kalkulasi BMI</span>
                <span className={`text-lg font-black ${bmiTheme.textMain}`}>{calculatedBmi.nilai}</span>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${bmiTheme.textSub}`}>Kategori Status Gizi</span>
                <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black shadow-sm ${bmiTheme.badge}`}>
                  {calculatedBmi.kategori}
                </span>
              </div>
            </div>
          )}

          {/* Link Eviden */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 tracking-wide text-xs">Link Eviden Timbangan / Foto Full Body <span className="text-rose-600 font-black">*</span></label>
            <input 
              type="url" 
              value={formData.linkEviden} 
              onChange={e => setFormData({...formData, linkEviden: e.target.value})} 
              placeholder="https://prnt.sc/xxxxxx" 
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold text-slate-900 transition shadow-inner" 
              required 
            />
          </div>

          {/* Tombol Submit dengan Gradasi Navy ke Merah */}
          <div className="pt-3">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-rose-700 hover:from-slate-950 hover:to-rose-800 active:scale-[0.99] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-900/30 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Mengirim Data...' : 'Kirim Data BMI'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}