import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import confetti from 'canvas-confetti';

export default function ImportData({ onNavigate }) {
  const userRole = (localStorage.getItem('sqUserRole') || '').trim().toUpperCase();
  const isAuthorized = userRole === 'SQ' || userRole === 'SERVICE QUALITY';

  const [jenisData, setJenisData] = useState('tapping');
  const [inputTahun, setInputTahun] = useState(new Date().getFullYear());
  const [inputBulan, setInputBulan] = useState(() => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return months[new Date().getMonth()];
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileNameLabel, setFileNameLabel] = useState('Tarik & Lepas File ke Sini');
  const [isProcessing, setIsProcessing] = useState(false);
  const [btnText, setBtnText] = useState('Mulai Proses Import');

  const [statSukses, setStatSukses] = useState(0);
  const [statGagal, setStatGagal] = useState(0);
  const [statWaktu, setStatWaktu] = useState('0s');

  const [logs, setLogs] = useState([{ text: '> Menunggu file dan instruksi import...', type: 'text' }]);
  const consoleLogRef = useRef(null);

  const [importLogs, setImportLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [tableBodyRef] = useAutoAnimate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isAuthorized) {
      loadImportLogs();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (consoleLogRef.current) {
      consoleLogRef.current.scrollTop = consoleLogRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center p-8 bg-white rounded-3xl border border-rose-200 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl border border-rose-100 shadow-inner">
          <i className="fa-solid fa-user-lock"></i>
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-base font-black text-slate-900 tracking-tight">Akses Ditolak (403 Forbidden)</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Fitur Import Data bersifat krusial dan hanya dapat diakses oleh akun dengan role <strong className="text-rose-600">Service Quality (SQ)</strong>.
          </p>
        </div>
        <button 
          onClick={() => onNavigate && onNavigate('overview')} 
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-2"
        >
          <i className="fa-solid fa-house"></i>
          <span>Kembali ke Overview</span>
        </button>
      </div>
    );
  }

  const cleanToInteger = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let str = String(val).replace(/%/g, '').trim();
    let num = parseFloat(str);
    if (isNaN(num)) return 0;
    
    if (num > 0 && num <= 1 && !String(val).includes('%')) {
      num = num * 100;
    }
    return Math.round(num);
  };

  const cleanToDate = (val) => {
    if (val === undefined || val === null || val === '') return null;
    
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const num = Number(val);
    if (!isNaN(num) && num > 10000 && num < 100000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    let str = String(val).trim();
    if (!str) return null;

    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return null;
  };

  const normalize = (s) => String(s).toLowerCase().replace(/ /g, '_');

  const MAPPINGS = {
    tapping: {
      "no": "no", "tanggal_assessor": "tanggal_assessor", "nama_assessor": "nama_assessor", "link_rekaman": "link_rekaman", 
      "tanggal_rekaman": "tanggal_rekaman", "nik_csr": "nik_csr", "nama_csr": "nama_csr", "los_csr": "los_csr", 
      "unit_name": "unit_name", "regional": "regional", "msisdn_pelanggan": "msisdn_pelanggan", "kip_interaction": "kip_interaction", 
      "kip_service": "kip_service", "recording": "recording", "durasi_record": "durasi_record", "nilai_attitude": "nilai_attitude", 
      "nilai_skill": "nilai_skill", "nilai_knowledge": "nilai_knowledge", "total_nilai": "total_nilai", 

      "disiplin_kerja_(attitude)": "disiplin_kerja_(attitude)", "disiplin_kerja": "disiplin_kerja_(attitude)",
      "detail_disiplin_kerja_(attitude)": "detail_disiplin_kerja_(attitude)", "detail_disiplin_kerja": "detail_disiplin_kerja_(attitude)",
      "penampilan_(attitude)": "penampilan_(attitude)", "penampilan": "penampilan_(attitude)",
      "detail_penampilan_(attitude)": "detail_penampilan_(attitude)", "detail_penampilan": "detail_penampilan_(attitude)",
      "etika_pelayanan_(attitude)": "etika_pelayanan_(attitude)", "etika_pelayanan": "etika_pelayanan_(attitude)",
      "detail_etika_pelayanan_(attitude)": "detail_etika_pelayanan_(attitude)", "detail_etika_pelayanan": "detail_etika_pelayanan_(attitude)",
      "responsiveness_(attitude)": "responsiveness_(attitude)", "responsiveness": "responsiveness_(attitude)",
      "detail_responsiveness_(attitude)": "detail_responsiveness_(attitude)", "detail_responsiveness": "detail_responsiveness_(attitude)",

      "gali_informasi_(skill)": "gali_informasi_(skill)", "gali_informasi": "gali_informasi_(skill)",
      "detail_gali_informasi_(skill)": "detail_gali_informasi_(skill)", "detail_gali_informasi": "detail_gali_informasi_(skill)",
      "analisa_kebutuhan_(skill)": "analisa_kebutuhan_(skill)", "analisa_kebutuhan": "analisa_kebutuhan_(skill)",
      "detail_analisa_kebutuhan_(skill)": "detail_analisa_kebutuhan_(skill)", "detail_analisa_kebutuhan": "detail_analisa_kebutuhan_(skill)",
      "kejelasan_informasi_(skill)": "kejelasan_informasi_(skill)", "kejelasan_informasi": "kejelasan_informasi_(skill)",
      "detail_kejelasan_informasi_(skill)": "detail_kejelasan_informasi_(skill)", "detail_kejelasan_informasi": "detail_kejelasan_informasi_(skill)",
      "holding_time_(skill)": "holding_time_(skill)", "holding_time": "holding_time_(skill)",
      "detail_holding_time_(skill)": "detail_holding_time_(skill)", "detail_holding_time": "detail_holding_time_(skill)",
      "dokumentasi_(skill)": "dokumentasi_(skill)", "dokumentasi": "dokumentasi_(skill)",
      "detail_dokumentasi_(skill)": "detail_dokumentasi_(skill)", "detail_dokumentasi": "detail_dokumentasi_(skill)",

      "fcr_atau_ketepatan_eskalasi_(knowledge)": "fcr_atau_ketepatan_eskalasi_(knowledge)", "fcr_atau_ketepatan_eskalasi": "fcr_atau_ketepatan_eskalasi_(knowledge)",
      "detail_fcr_atau_ketepatan_eskalasi_(knowledge)": "detail_fcr_atau_ketepatan_eskalasi_(knowledge)", "detail_fcr_atau_ketepatan_eskalasi": "detail_fcr_atau_ketepatan_eskalasi_(knowledge)",
      "solusi_&_konfirmasi_(knowledge)": "solusi_&_konfirmasi_(knowledge)", "solusi_&_konfirmasi": "solusi_&_konfirmasi_(knowledge)",
      "detail_solusi_&_konfirmasi_(knowledge)": "detail_solusi_&_konfirmasi_(knowledge)", "detail_solusi_&_konfirmasi": "detail_solusi_&_konfirmasi_(knowledge)",
      "edukasi_layanan_(knowledge)": "edukasi_layanan_(knowledge)", "edukasi_layanan": "edukasi_layanan_(knowledge)",
      "detail_edukasi_layanan_(knowledge)": "detail_edukasi_layanan_(knowledge)", "detail_edukasi_layanan": "detail_edukasi_layanan_(knowledge)",
      "cross_selling_dan_upselling_(knowledge)": "cross_selling_dan_upselling_(knowledge)", "cross_selling_dan_upselling": "cross_selling_dan_upselling_(knowledge)",
      "detail_cross_selling_dan_upselling_(knowledge)": "detail_cross_selling_dan_upselling_(knowledge)", "detail_cross_selling_dan_upselling": "detail_cross_selling_dan_upselling_(knowledge)"
    },
    tryout: {
      "nik_siad": "nik_csr", "full_name": "nama_csr", "phone_number": "phone_number", 
      "job": "job", "job_name": "job_name", "unit_type": "unit_type", "unit_id": "unit_id", 
      "unit_name": "unit_name", "region": "region", "area": "area", "ctp": "ctp", "session": "session", 
      "level": "level", "company_or_vendor": "company_or_vendor", "email": "email", 
      "nilai": "nilai", "bintang": "bintang", "keterangan": "keterangan", "soal_benar": "soal_benar", 
      "soal_salah": "soal_salah", "pengerjaan": "pengerjaan", "keterangan_1": "keterangan_1"
    },
    csr: {
      "region": "region", "regional": "region",
      "cluster": "cluster",
      "unit_name": "unit_name", "unitname": "unit_name", "nama_grapari": "unit_name",
      "nama_csr": "nama_csr", "nama": "nama_csr", "nama_lengkap": "nama_csr",
      "nik_csr": "nik_csr", "nik": "nik_csr", "siad": "nik_csr",
      "email": "email",
      "job": "job", "posisi": "job",
      "contact": "contact", "phone": "contact", "telepon": "contact"
    }
  };

  const DataHandlers = {
    tapping: {
      label: "Data Tapping CSR",
      tableName: "nilai_tapping",
      requiredColumns: ["nik_csr", "nama_csr", "total_nilai"],
      transform: (row) => {
        const result = {};
        Object.keys(row).forEach(header => {
          const normKey = normalize(header.trim());
          const targetKey = MAPPINGS.tapping[normKey] || normKey;
          if (row[header] !== undefined && row[header] !== "") {
            result[targetKey] = row[header];
          }
        });
        if (result.no !== undefined) {
          result.no = cleanToInteger(result.no);
        }
        const dateFields = ["tanggal_assessor", "tanggal_rekaman"];
        const integerFields = [
          "total_nilai", "nilai_attitude", "nilai_skill", "nilai_knowledge",
          "disiplin_kerja_(attitude)", "penampilan_(attitude)", "etika_pelayanan_(attitude)", "responsiveness_(attitude)",
          "gali_informasi_(skill)", "analisa_kebutuhan_(skill)", "kejelasan_informasi_(skill)", "holding_time_(skill)", "dokumentasi_(skill)",
          "fcr_atau_ketepatan_eskalasi_(knowledge)", "solusi_&_konfirmasi_(knowledge)", "edukasi_layanan_(knowledge)", "cross_selling_dan_upselling_(knowledge)"
        ];
        dateFields.forEach(col => {
          if (result[col]) {
            const formattedDate = cleanToDate(result[col]);
            if (formattedDate) result[col] = formattedDate;
            else delete result[col];
          }
        });
        integerFields.forEach(col => {
          if (result[col] !== undefined) {
            result[col] = cleanToInteger(result[col]);
          }
        });
        if (result.nik_csr) result.nik_csr = String(result.nik_csr).trim();
        if (result.nama_csr) result.nama_csr = String(result.nama_csr).trim();
        return result;
      }
    },
    tryout: {
      label: "Data Try Out CSR",
      tableName: "nilai_to",
      requiredColumns: ["nik_csr", "nama_csr", "nilai", "pengerjaan"],
      transform: (row, manualPeriod) => {
        const result = {
          tahun: manualPeriod.tahun,
          bulan: manualPeriod.bulan,
          minggu_ke: "Satu"
        };
        Object.keys(row).forEach(header => {
          const normKey = normalize(header.trim());
          const targetKey = MAPPINGS.tryout[normKey];
          if (targetKey && row[header] !== undefined && row[header] !== "") {
            result[targetKey] = row[header];
          }
        });
        delete result.no;
        delete result.tanggal;
        const pengerjaanRaw = String(result["pengerjaan"] || "").trim();
        if (pengerjaanRaw) {
          const pLower = pengerjaanRaw.toLowerCase();
          if (pLower.includes("week 1") || pLower.includes("w1")) result.minggu_ke = "Satu";
          else if (pLower.includes("week 2") || pLower.includes("w2")) result.minggu_ke = "Dua";
          else if (pLower.includes("week 3") || pLower.includes("w3")) result.minggu_ke = "Tiga";
          else if (pLower.includes("week 4") || pLower.includes("w4")) result.minggu_ke = "Empat";
          else result.minggu_ke = pengerjaanRaw;
        }
        ["nilai", "soal_benar", "soal_salah"].forEach(col => {
          if (result[col] !== undefined) {
            result[col] = cleanToInteger(result[col]);
          }
        });
        if (result.nik_csr) result.nik_csr = String(result.nik_csr).trim();
        if (result.nama_csr) result.nama_csr = String(result.nama_csr).trim();
        return result;
      }
    },
    csr: {
      label: "Database CSR (database_csr)",
      tableName: "database_csr",
      requiredColumns: ["nik_csr", "nama_csr"],
      transform: (row) => {
        const result = {};
        Object.keys(row).forEach(header => {
          const normKey = normalize(header.trim());
          const targetKey = MAPPINGS.csr[normKey];
          if (targetKey && row[header] !== undefined && row[header] !== "") {
            result[targetKey] = String(row[header]).trim();
          }
        });
        return result;
      }
    }
  };

  const appendLog = (msg, type = 'text') => {
    setLogs(prev => [...prev, { text: msg, type }]);
  };

  const clearImportLog = () => {
    setLogs([{ text: '> Console dipulihkan...', type: 'text' }]);
  };

  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setFileNameLabel(file.name);
    appendLog(`File dipilih: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const saveLogToSupabase = async (jenisDataKey, fileName, sukses, gagal, durasi, status, errorText) => {
    const userName = localStorage.getItem('sqUserName') || 'System';
    try {
      const { error } = await supabase.from('import_logs').insert([{
        jenis_data: jenisDataKey,
        file_name: fileName,
        jumlah_sukses: sukses,
        jumlah_gagal: gagal,
        durasi_detik: parseFloat(durasi),
        status: status,
        error_details: errorText,
        uploaded_by: userName
      }]);
      if (error) {
        appendLog(`Gagal menyimpan riwayat ke import_logs: ${error.message}`, 'warn');
      }
    } catch (e) {
      appendLog(`Error simpan log: ${e.message}`, 'warn');
    }
  };

  const loadImportLogs = async () => {
    try {
      const { data, error } = await supabase.from('import_logs').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setImportLogs(data);
      }
    } catch (e) {
      console.error("Gagal memuat log import:", e);
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const processImport = async () => {
    if (!selectedFile) return;

    const handler = DataHandlers[jenisData];
    setIsProcessing(true);
    setBtnText("Memproses...");
    
    const manualPeriod = {
      tahun: inputTahun,
      bulan: inputBulan
    };

    const startTime = performance.now();
    let countSuccess = 0;
    let countFailed = 0;
    let errorMessage = "";

    appendLog(`Memulai validasi & transformasi data untuk [${handler.label}] -> Tabel: ${handler.tableName}...`);

    try {
      const dataArray = await parseExcelFile(selectedFile);
      if (!dataArray || dataArray.length === 0) throw new Error("File Excel kosong!");

      appendLog(`Parsing file sukses. Total baris ditemukan: ${dataArray.length}`);

      const batchPayload = [];
      dataArray.forEach((row, idx) => {
        try {
          const transformed = handler.transform(row, manualPeriod);
          batchPayload.push(transformed);
          countSuccess++;
        } catch (e) {
          countFailed++;
          appendLog(`Baris #${idx + 2} gagal ditransformasi: ${e.message}`, 'warn');
        }
      });

      if (batchPayload.length > 0) {
        const uniqueMap = new Map();
        batchPayload.forEach(item => {
          let uniqueKey = '';
          if (jenisData === 'tapping') {
            uniqueKey = `${item.nik_csr}_${item.tanggal_rekaman}`;
          } else if (jenisData === 'tryout') {
            uniqueKey = `${item.nik_csr}_${item.tahun || ''}_${item.bulan || ''}_${item.minggu_ke || ''}`;
          } else if (jenisData === 'csr') {
            uniqueKey = `${item.nik_csr || idx}`;
          }
          uniqueMap.set(uniqueKey, item);
        });
        const finalPayload = Array.from(uniqueMap.values());

        appendLog(`Mengirim ${finalPayload.length} baris data ke Supabase (${handler.tableName})...`);
        
        if (jenisData === 'csr') {
          const { error } = await supabase
            .from('database_csr')
            .upsert(finalPayload, { onConflict: 'nik_csr' });

          if (error) throw error;
        } else {
          let conflictColumns = jenisData === 'tapping' ? 'nik_csr,tanggal_rekaman' : 'nik_csr,tahun,bulan,minggu_ke';
          const { error } = await supabase
            .from(handler.tableName)
            .upsert(finalPayload, { onConflict: conflictColumns });

          if (error) throw error;
        }

        // AUTO-COACHING UNTUK NILAI < 85
        if (jenisData === 'tapping') {
          const lowPerformers = finalPayload.filter(item => {
            const nilai = Number(item.total_nilai) || 0;
            return nilai > 0 && nilai < 85;
          });

          if (lowPerformers.length > 0) {
            appendLog(`Mendeteksi ${lowPerformers.length} agen dengan nilai < 85%. Menyinkronkan ke database_coaching...`);
            
            const coachingPayload = lowPerformers.map(item => ({
              nik_csr: item.nik_csr,
              nama_csr: item.nama_csr,
              tanggal: item.tanggal_rekaman,
              total_nilai: item.total_nilai,
              status_coaching: 'Pending',
              catatan: `Auto-generated dari Tapping tanggal ${item.tanggal_rekaman} karena nilai total (${item.total_nilai}%) di bawah 85%`
            }));

            const { error: coachingError } = await supabase
              .from('database_coaching')
              .upsert(coachingPayload, { onConflict: 'nik_csr,tanggal' });

            if (coachingError) {
              appendLog(`Warning/Gagal auto-input coaching: ${coachingError.message}`, 'warn');
            } else {
              appendLog(`Berhasil menyinkronkan ${lowPerformers.length} data ke database_coaching secara bersih!`, 'success');
            }
          }
        }
      }

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      setStatSukses(countSuccess);
      setStatGagal(countFailed);
      setStatWaktu(`${duration}s`);

      appendLog(`Import berhasil diselesaikan dalam ${duration} detik!`, 'success');
      triggerConfetti();

      await saveLogToSupabase(jenisData, selectedFile.name, countSuccess, countFailed, duration, 'Success', null);
      loadImportLogs();

    } catch (err) {
      appendLog(`ERR: ${err.message}`, 'error');
      errorMessage = err.message;
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      await saveLogToSupabase(jenisData, selectedFile.name, countSuccess, countFailed, duration, 'Failed', errorMessage);
      loadImportLogs();
    } finally {
      setIsProcessing(false);
      setBtnText("Mulai Proses Import");
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = importLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(importLogs.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="space-y-6 font-sans relative">
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-md border border-slate-400/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-emerald-600/30">
            <i className="fa-solid fa-file-import"></i>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Import Data Excel</h3>
            <p className="text-xs text-slate-700 font-medium">Unggah data mingguan otomatis ke database Supabase dengan validasi & transformasi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-300 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Jenis Data Modul <span className="text-rose-500">*</span></label>
            <select 
              value={jenisData} 
              onChange={(e) => setJenisData(e.target.value)} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition cursor-pointer"
            >
              <option value="tapping">Data Tapping CSR (nilai_tapping)</option>
              <option value="tryout">Data Try Out CSR (nilai_to)</option>
              <option value="csr">Database CSR (database_csr)</option>
            </select>
          </div>

          {jenisData === 'tryout' && (
            <div className="space-y-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">Pengaturan Periode Try Out:</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Tahun (Ketik Manual)</label>
                  <input 
                    type="number" 
                    value={inputTahun} 
                    onChange={(e) => setInputTahun(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/25 transition shadow-inner placeholder:text-slate-400" 
                    placeholder="Contoh: 2026" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Bulan</label>
                  <select 
                    value={inputBulan} 
                    onChange={(e) => setInputBulan(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition cursor-pointer"
                  >
                    {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold text-slate-700 mb-1.5"><i className="fa-solid fa-list-check text-emerald-600 mr-1"></i> Kolom Wajib Pada Excel:</p>
            <ul className="text-[10px] font-medium text-slate-600 list-disc list-inside space-y-0.5">
              {DataHandlers[jenisData].requiredColumns.map(col => (
                <li key={col}><code className="bg-emerald-100/60 px-1.5 py-0.5 rounded text-emerald-800 border border-emerald-200 font-mono text-[10px]">{col}</code></li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">File Excel (.xlsx / .csv)</label>
            <div 
              onClick={() => fileInputRef.current?.click()} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelect(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/50 p-6 rounded-3xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
            >
              <i className="fa-solid fa-cloud-arrow-up text-3xl text-emerald-500"></i>
              <div>
                <p className="text-xs font-bold text-slate-800">{fileNameLabel}</p>
                <p className="text-[10px] text-slate-400 font-medium">atau klik untuk memilih file dari komputer</p>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={(e) => handleFileSelect(e.target.files)} 
              />
            </div>
          </div>

          <button 
            onClick={processImport} 
            disabled={!selectedFile || isProcessing} 
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <i className="fa-solid fa-rocket"></i>
            <span>{btnText}</span>
          </button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 text-white p-5 rounded-3xl border-t border-emerald-200/50 border-b border-emerald-900/50 shadow-[0_12px_28px_-6px_rgba(16,185,129,0.45)]">
              <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100 bg-emerald-950/30 px-3 py-1 rounded-full">Sukses Di-insert</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-xs"><i className="fa-solid fa-check text-white"></i></div>
                </div>
                <div>
                  <h4 className="text-3xl font-black tracking-tight text-white">{statSukses}</h4>
                  <p className="text-[10px] text-emerald-100/80 font-medium mt-0.5">Baris data berhasil diunggah</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-rose-400 via-rose-500 to-red-700 text-white p-5 rounded-3xl border-t border-rose-200/50 border-b border-rose-900/50 shadow-[0_12px_28px_-6px_rgba(244,63,94,0.45)]">
              <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-100 bg-rose-950/30 px-3 py-1 rounded-full">Gagal / Dilewati</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-xs"><i className="fa-solid fa-xmark text-white"></i></div>
                </div>
                <div>
                  <h4 className="text-3xl font-black tracking-tight text-white">{statGagal}</h4>
                  <p className="text-[10px] text-rose-100/80 font-medium mt-0.5">Baris data tidak valid / error</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-800 text-white p-5 rounded-3xl border-t border-indigo-200/50 border-b border-indigo-950/50 shadow-[0_12px_28px_-6px_rgba(99,102,241,0.45)]">
              <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100 bg-indigo-950/30 px-3 py-1 rounded-full">Waktu Proses</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-xs"><i className="fa-solid fa-bolt text-white"></i></div>
                </div>
                <div>
                  <h4 className="text-3xl font-black tracking-tight text-white">{statWaktu}</h4>
                  <p className="text-[10px] text-indigo-100/80 font-medium mt-0.5">Durasi eksekusi import</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 p-5 rounded-3xl border border-slate-800 shadow-inner space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-400 flex items-center gap-2"><i className="fa-solid fa-terminal text-emerald-400"></i> Import Execution Log</span>
              <button onClick={clearImportLog} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer">Clear</button>
            </div>
            <div ref={consoleLogRef} className="h-48 overflow-y-auto space-y-1 pr-2 text-[11px] leading-relaxed">
              {logs.map((log, idx) => (
                <p 
                  key={idx} 
                  className={
                    log.type === 'error' ? 'text-rose-400 font-bold' :
                    log.type === 'success' ? 'text-emerald-400 font-bold' :
                    log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                  }
                >
                  &gt; {log.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-300 shadow-md space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-clock-rotate-left text-sm"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">Riwayat Import Data</h4>
              <p className="text-[10px] text-slate-500 font-medium">Catatan riwayat transaksi eksekusi unggah data Excel</p>
            </div>
          </div>
          <button 
            onClick={loadImportLogs} 
            className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-orange-600/20 flex items-center gap-2 cursor-pointer border-t border-orange-400/40"
          >
            <i className="fa-solid fa-arrows-rotate text-[11px]"></i>
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-orange-800 via-amber-900 to-orange-900 text-amber-100 text-[10px] font-black uppercase tracking-wider shadow-md">
                <th className="py-3.5 px-4"><i className="fa-regular fa-calendar-check mr-1.5 text-amber-300"></i>Waktu</th>
                <th className="py-3.5 px-4"><i className="fa-solid fa-database mr-1.5 text-amber-300"></i>Jenis Data</th>
                <th className="py-3.5 px-4"><i className="fa-regular fa-file-excel mr-1.5 text-amber-300"></i>Nama File</th>
                <th className="py-3.5 px-4 text-center"><i className="fa-solid fa-circle-check mr-1.5 text-amber-300"></i>Sukses</th>
                <th className="py-3.5 px-4 text-center"><i className="fa-solid fa-circle-xmark mr-1.5 text-rose-300"></i>Gagal</th>
                <th className="py-3.5 px-4 text-center"><i className="fa-solid fa-stopwatch mr-1.5 text-amber-300"></i>Durasi</th>
                <th className="py-3.5 px-4 text-center"><i className="fa-solid fa-shield-halved mr-1.5 text-amber-300"></i>Status</th>
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="divide-y divide-slate-200 bg-white">
              {currentLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-slate-400 italic">Belum ada riwayat import.</td>
                </tr>
              ) : (
                currentLogs.map((log) => (
                  <tr key={log.id || log.created_at} className="hover:bg-orange-50/40 transition duration-150">
                    <td className="py-3 px-4 font-medium text-slate-600">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 uppercase tracking-tight">{log.jenis_data}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{log.file_name}</td>
                    <td className="py-3 px-4 text-center font-extrabold text-emerald-600">{log.jumlah_sukses}</td>
                    <td className="py-3 px-4 text-center font-extrabold text-rose-600">{log.jumlah_gagal}</td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-600">{log.durasi_detik}s</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                        log.status === 'Success' 
                          ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-emerald-300' 
                          : 'bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border-rose-300'
                      }`}>
                        <i className={`fa-solid ${log.status === 'Success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'} text-[11px]`}></i>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, importLogs.length)} dari {importLogs.length} data
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Prev
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => paginate(i + 1)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}