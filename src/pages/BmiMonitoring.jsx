import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import * as XLSX from 'xlsx';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  Title, 
  Tooltip, 
  Legend
);

// Plugin kustom Chart.js agar angka di atas batang chart tampil kontras dan jelas terbaca
const datalabelsPlugin = {
  id: 'datalabelsPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value > 0) {
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(value, bar.x, bar.y - 6);
          ctx.restore();
        }
      });
    });
  }
};

// Helper untuk Export Data ke File Excel (.xlsx) Asli
const exportToExcel = (data, fileName) => {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diunduh.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// Komponen Multiple Select Dropdown Modern dengan Checkbox & Pencarian (Ukuran Compact untuk 1 Line)
function MultiSelectDropdown({ label, values, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    String(opt).toLowerCase().includes(String(search || '').toLowerCase())
  );

  const handleToggle = (opt) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  const handleSelectAll = () => {
    onChange([...options]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayText = values.length === 0 
    ? `${label}` 
    : values.length === 1 
    ? values[0] 
    : `${label} (${values.length})`;

  return (
    <div className="relative flex-1 min-w-[130px]" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-[11px] font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-sm cursor-pointer flex items-center justify-between truncate"
      >
        <span className="truncate">{displayText}</span>
        <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150 min-w-[180px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[10px] font-black uppercase text-slate-500">{label}</span>
            <div className="space-x-2">
              <button type="button" onClick={handleSelectAll} className="text-[10px] font-bold text-indigo-600 hover:underline">Semua</button>
              <span className="text-slate-300">|</span>
              <button type="button" onClick={handleClearAll} className="text-[10px] font-bold text-rose-600 hover:underline">Reset</button>
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari ${label}...`}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-600 font-semibold"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-slate-400 italic text-center">Tidak ditemukan</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = values.includes(opt);
                return (
                  <div
                    key={idx}
                    onClick={() => handleToggle(opt)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-between ${
                      isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <i className="fa-solid fa-check"></i>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BmiMonitoring() {
  useEffect(() => {
    document.title = 'Monitoring BMI T-Fronters | Lensa Insight';
  }, []);

  const getCurrentYearMonth = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };
  const currentMonthStr = getCurrentYearMonth();

  const [bmiData, setBmiData] = useState([]);
  const [csrData, setCsrData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States (Multiple Select Arrays)
  const [selectedPeriodes, setSelectedPeriodes] = useState([currentMonthStr]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedClusters, setSelectedClusters] = useState([]);
  const [selectedMitras, setSelectedMitras] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedKategoris, setSelectedKategoris] = useState([]);

  // State untuk Sorting Tabel Utama
  const [sortField, setSortField] = useState('tanggal');
  const [sortDirection, setSortDirection] = useState('desc');

  // State untuk Paging Tabel Utama
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // State untuk Paging Tabel Tambahan
  const [pageUnsubmitted, setPageUnsubmitted] = useState(1);
  const [pageStreak, setPageStreak] = useState(1);
  const rowsPerPageExtra = 10;

  const [tableBodyRef] = useAutoAnimate();

  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('database_bmi_and_csr_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'database_bmi' }, () => {
        fetchAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'database_csr' }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bmiRes, csrRes] = await Promise.all([
        supabase.from('database_bmi').select('*'),
        supabase.from('database_csr').select('*')
      ]);

      if (bmiRes.error) throw bmiRes.error;
      if (csrRes.error) throw csrRes.error;

      setBmiData(bmiRes.data || []);
      setCsrData(csrRes.data || []);
    } catch (err) {
      console.error("Gagal memuat data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk lookup field data
  const getRecordRegion = (item) => item.region || item.regional || '';
  const getRecordCluster = (item) => item.cluster || item.cluster_name || '';
  const getRecordMitra = (item) => item.mitra || item.vendor || item.mitra_csr || item.mitra_name || 'Lainnya';
  const getRecordJob = (item) => item.job || item.job_role || '';
  const getRecordPeriode = (item) => item.tanggal ? item.tanggal.slice(0, 7) : '';

  // Cascading Dropdown Options Calculation
  const allPeriods = Array.from(
    new Set([
      currentMonthStr,
      ...bmiData.map(getRecordPeriode).filter(Boolean)
    ])
  ).sort().reverse();

  const allRegions = Array.from(
    new Set([...bmiData.map(getRecordRegion), ...csrData.map(getRecordRegion)].filter(Boolean))
  ).sort();

  // Cluster difilter berdasarkan Region yang dipilih
  const clustersSource = [...bmiData, ...csrData].filter(item => {
    if (selectedRegions.length > 0 && !selectedRegions.includes(getRecordRegion(item))) return false;
    return true;
  });
  const allClusters = Array.from(new Set(clustersSource.map(getRecordCluster).filter(Boolean))).sort();

  // Mitra difilter berdasarkan Region & Cluster yang dipilih
  const mitrasSource = [...bmiData, ...csrData].filter(item => {
    if (selectedRegions.length > 0 && !selectedRegions.includes(getRecordRegion(item))) return false;
    if (selectedClusters.length > 0 && !selectedClusters.includes(getRecordCluster(item))) return false;
    return true;
  });
  const allMitras = Array.from(new Set(mitrasSource.map(getRecordMitra).filter(Boolean))).sort();

  // Job difilter berdasarkan Region, Cluster, & Mitra yang dipilih
  const jobsSource = [...bmiData, ...csrData].filter(item => {
    if (selectedRegions.length > 0 && !selectedRegions.includes(getRecordRegion(item))) return false;
    if (selectedClusters.length > 0 && !selectedClusters.includes(getRecordCluster(item))) return false;
    if (selectedMitras.length > 0 && !selectedMitras.includes(getRecordMitra(item))) return false;
    return true;
  });
  const allJobs = Array.from(new Set(jobsSource.map(getRecordJob).filter(Boolean))).sort();

  const allKategori = [
    'Normal (Ideal)',
    'Kelebihan Berat Badan (Overweight)',
    'Obesitas (Obesity)',
    'Kekurangan Berat Badan (Underweight)'
  ];

  // Fungsi Handler untuk Sorting Kolom Tabel Utama
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Logika Filter Utama yang diterapkan ke seluruh komponen di bawahnya
  const filteredData = bmiData.filter(item => {
    const reg = getRecordRegion(item);
    const cls = getRecordCluster(item);
    const mit = getRecordMitra(item);
    const job = getRecordJob(item);
    const kat = item.kategori || '';
    const per = getRecordPeriode(item);

    const matchSearch = 
      String(item.nik_csr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.nama_csr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.unit_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchRegion = selectedRegions.length === 0 || selectedRegions.includes(reg);
    const matchCluster = selectedClusters.length === 0 || selectedClusters.includes(cls);
    const matchMitra = selectedMitras.length === 0 || selectedMitras.includes(mit);
    const matchJob = selectedJobs.length === 0 || selectedJobs.includes(job);
    const matchKategori = selectedKategoris.length === 0 || selectedKategoris.some(k => kat.toLowerCase().includes(k.toLowerCase()));
    const matchPeriode = selectedPeriodes.length === 0 || selectedPeriodes.includes(per);

    return matchSearch && matchRegion && matchCluster && matchMitra && matchJob && matchKategori && matchPeriode;
  }).sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
    if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    setCurrentPage(1);
    setPageUnsubmitted(1);
    setPageStreak(1);
  }, [searchTerm, selectedRegions, selectedClusters, selectedMitras, selectedJobs, selectedKategoris, selectedPeriodes]);

  // Kalkulasi Pagination Tabel Utama
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  // Statistik dihitung berdasarkan data yang sudah terfilter
  const totalSubmissions = filteredData.length;
  const idealCount = filteredData.filter(i => i.kategori && i.kategori.includes('Normal')).length;
  const overweightCount = filteredData.filter(i => i.kategori && (i.kategori.includes('Overweight') || i.kategori.includes('Obesitas'))).length;
  const underweightCount = filteredData.filter(i => i.kategori && i.kategori.includes('Kekurangan')).length;

  // --- TABEL TAMBAHAN 1: List T-Fronters yang Belum Submit ---
  const unsubmittedList = csrData.filter(csr => {
    const csrNik = String(csr.nik || csr.nik_csr || '').trim();
    if (!csrNik) return false;

    const csrReg = getRecordRegion(csr);
    const csrCls = getRecordCluster(csr);
    const csrMit = getRecordMitra(csr);
    const csrJob = getRecordJob(csr);

    if (selectedRegions.length > 0 && !selectedRegions.includes(csrReg)) return false;
    if (selectedClusters.length > 0 && !selectedClusters.includes(csrCls)) return false;
    if (selectedMitras.length > 0 && !selectedMitras.includes(csrMit)) return false;
    if (selectedJobs.length > 0 && !selectedJobs.includes(csrJob)) return false;

    if (selectedPeriodes.length > 0) {
      const hasSubmitted = selectedPeriodes.some(per => {
        return bmiData.some(b => {
          const bNik = String(b.nik_csr || '').trim();
          const bPer = getRecordPeriode(b);
          return bNik === csrNik && bPer === per;
        });
      });
      return !hasSubmitted;
    } else {
      const hasSubmittedAny = bmiData.some(b => String(b.nik_csr || '').trim() === csrNik);
      return !hasSubmittedAny;
    }
  }).filter(csr => {
    const matchSearch = !searchTerm || 
      String(csr.nik || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(csr.nama || csr.nama_csr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(csr.unitName || csr.unit_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const indexOfLastUnsub = pageUnsubmitted * rowsPerPageExtra;
  const indexOfFirstUnsub = indexOfLastUnsub - rowsPerPageExtra;
  const currentUnsubRows = unsubmittedList.slice(indexOfFirstUnsub, indexOfLastUnsub);
  const totalPagesUnsub = Math.ceil(unsubmittedList.length / rowsPerPageExtra) || 1;

  // --- TABEL TAMBAHAN 2: CSR yang BMI-nya Tidak Ideal dalam 3 Bulan Berturut-turut ---
  const getNonIdealStreakList = () => {
    const mapByNik = {};
    bmiData.forEach(item => {
      const nik = String(item.nik_csr || '').trim();
      if (!nik) return;
      if (!mapByNik[nik]) mapByNik[nik] = [];
      mapByNik[nik].push(item);
    });

    const result = [];
    Object.keys(mapByNik).forEach(nik => {
      const records = mapByNik[nik].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
      
      for (let i = 0; i <= records.length - 3; i++) {
        const r1 = records[i];
        const r2 = records[i + 1];
        const r3 = records[i + 2];

        const kat1 = String(r1.kategori || '');
        const kat2 = String(r2.kategori || '');
        const kat3 = String(r3.kategori || '');

        const isNotIdeal1 = kat1 && !kat1.includes('Normal');
        const isNotIdeal2 = kat2 && !kat2.includes('Normal');
        const isNotIdeal3 = kat3 && !kat3.includes('Normal');

        if (isNotIdeal1 && isNotIdeal2 && isNotIdeal3) {
          const d1 = new Date(r1.tanggal);
          const d2 = new Date(r2.tanggal);
          const d3 = new Date(r3.tanggal);

          const diffMonths1 = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
          const diffMonths2 = (d3.getFullYear() - d2.getFullYear()) * 12 + (d3.getMonth() - d2.getMonth());

          if (diffMonths1 === 1 && diffMonths2 === 1) {
            result.push({
              nik_csr: nik,
              nama_csr: r3.nama_csr || r1.nama_csr,
              region: getRecordRegion(r3),
              cluster: getRecordCluster(r3),
              mitra: getRecordMitra(r3),
              unit_name: r3.unit_name || r1.unit_name,
              job: getRecordJob(r3),
              periode_streak: `${r1.tanggal.slice(0, 7)}, ${r2.tanggal.slice(0, 7)}, ${r3.tanggal.slice(0, 7)}`,
              kategori_terakhir: r3.kategori,
              last_record: r3
            });
            break;
          }
        }
      }
    });

    return result.filter(item => {
      const matchRegion = selectedRegions.length === 0 || selectedRegions.includes(item.region);
      const matchCluster = selectedClusters.length === 0 || selectedClusters.includes(item.cluster);
      const matchMitra = selectedMitras.length === 0 || selectedMitras.includes(item.mitra);
      const matchJob = selectedJobs.length === 0 || selectedJobs.includes(item.job);
      const matchSearch = !searchTerm || 
        String(item.nik_csr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.nama_csr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.unit_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchRegion && matchCluster && matchMitra && matchJob && matchSearch;
    });
  };

  const streakList = getNonIdealStreakList();
  const indexOfLastStreak = pageStreak * rowsPerPageExtra;
  const indexOfFirstStreak = indexOfLastStreak - rowsPerPageExtra;
  const currentStreakRows = streakList.slice(indexOfFirstStreak, indexOfLastStreak);
  const totalPagesStreak = Math.ceil(streakList.length / rowsPerPageExtra) || 1;

  // Helper untuk membuat Dataset Chart Bar (Regional & Job)
  const generateChartDataByGroup = (groupKey) => {
    const groups = Array.from(new Set(filteredData.map(i => {
      if (groupKey === 'region') return getRecordRegion(i);
      if (groupKey === 'job') return getRecordJob(i);
      return i[groupKey];
    }).filter(Boolean))).sort();

    const normalArr = [];
    const underArr = [];
    const overArr = [];

    groups.forEach(group => {
      const groupData = filteredData.filter(i => {
        let val = groupKey === 'region' ? getRecordRegion(i) : (groupKey === 'job' ? getRecordJob(i) : i[groupKey]);
        return val === group;
      });
      normalArr.push(groupData.filter(i => i.kategori?.includes('Normal')).length);
      underArr.push(groupData.filter(i => i.kategori?.includes('Kekurangan')).length);
      overArr.push(groupData.filter(i => i.kategori?.includes('Overweight') || i.kategori?.includes('Obesitas')).length);
    });

    let themeColors = { normal: '#10b981', under: '#f59e0b', over: '#f43f5e' };
    if (groupKey === 'region') {
      themeColors = { normal: '#06b6d4', under: '#fbbf24', over: '#6366f1' };
    } else if (groupKey === 'job') {
      themeColors = { normal: '#059669', under: '#f59e0b', over: '#e11d48' };
    }

    return {
      labels: groups.length > 0 ? groups : ['Tidak Ada Data'],
      datasets: [
        { label: 'Normal / Ideal', data: normalArr.length > 0 ? normalArr : [0], backgroundColor: themeColors.normal, borderRadius: 8 },
        { label: 'Underweight', data: underArr.length > 0 ? underArr : [0], backgroundColor: themeColors.under, borderRadius: 8 },
        { label: 'Overweight / Obesitas', data: overArr.length > 0 ? overArr : [0], backgroundColor: themeColors.over, borderRadius: 8 },
      ],
    };
  };

  // Helper untuk Line Chart Tren Waktu Pengukuran
  const generateMonthlyTrendData = () => {
    const months = Array.from(
      new Set(
        filteredData
          .map(item => item.tanggal ? item.tanggal.slice(0, 7) : '')
          .filter(Boolean)
      )
    ).sort();

    const avgBmiArr = [];
    const overweightArr = [];

    months.forEach(month => {
      const monthData = filteredData.filter(i => i.tanggal && i.tanggal.slice(0, 7) === month);
      const totalBmi = monthData.reduce((acc, curr) => acc + (Number(curr.nilai_bmi) || 0), 0);
      const avgBmi = monthData.length > 0 ? Number((totalBmi / monthData.length).toFixed(1)) : 0;
      avgBmiArr.push(avgBmi);

      const overCount = monthData.filter(i => i.kategori?.includes('Overweight') || i.kategori?.includes('Obesitas')).length;
      overweightArr.push(overCount);
    });

    return {
      labels: months.length > 0 ? months : ['Belum Ada Data'],
      datasets: [
        { label: 'Rata-rata BMI', data: avgBmiArr.length > 0 ? avgBmiArr : [0], borderColor: '#7c3aed', backgroundColor: '#7c3aed', tension: 0.3, yAxisID: 'y' },
        { label: 'Kasus Overweight/Obesitas', data: overweightArr.length > 0 ? overweightArr : [0], borderColor: '#e11d48', backgroundColor: '#e11d48', tension: 0.3, yAxisID: 'y1' }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 28 } },
    plugins: {
      datalabels: { display: false },
      legend: {
        position: 'bottom',
        labels: { font: { weight: 'bold', size: 10 }, color: '#334155', boxWidth: 12, useBorderRadius: true, borderRadius: 4 }
      },
      tooltip: { backgroundColor: '#0f172a', titleFont: { weight: 'bold', size: 12 }, bodyFont: { size: 11 }, padding: 12, cornerRadius: 10 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } },
      y: { display: false, grid: { display: false }, ticks: { display: false } }
    }
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { weight: 'bold', size: 10 }, color: '#334155', boxWidth: 12, useBorderRadius: true, borderRadius: 4 }
      },
      tooltip: { backgroundColor: '#0f172a', titleFont: { weight: 'bold', size: 12 }, bodyFont: { size: 11 }, padding: 12, cornerRadius: 10 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } },
      y: { type: 'linear', display: false, position: 'left', grid: { display: false }, ticks: { display: false } },
      y1: { type: 'linear', display: false, position: 'right', grid: { drawOnChartArea: false }, ticks: { display: false } },
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Atas */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-md border border-slate-400/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white/80 text-slate-900 flex items-center justify-center text-lg font-bold shadow-sm border border-slate-300">
            <i className="fa-solid fa-weight-scale"></i>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Monitoring BMI T-Fronters</h3>
            <p className="text-xs text-slate-700 font-medium">Rekapitulasi data indeks massa tubuh dan status gizi seluruh CSR</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <a 
            href="https://lensa-qualityinsight.netlify.app/bmi-form" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-file-pen"></i>
            <span>Isi Form BMI</span>
          </a>

          <button 
            onClick={fetchAllData} 
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer w-fit"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>Muat Ulang Data</span>
          </button>
        </div>
      </div>

      {/* Bar Filter Single Line (Cascading & Multiple Select) */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-4 sm:p-5 rounded-3xl shadow-md border border-slate-400/80">
        <div className="flex flex-col xl:flex-row items-center gap-2.5">
          <div className="w-full xl:w-52 shrink-0">
            <input 
              type="text" 
              placeholder="Cari NIK, Nama, Unit..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-[11px] font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-inner"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-row items-center gap-2 w-full">
            <MultiSelectDropdown label="Periode" values={selectedPeriodes} onChange={setSelectedPeriodes} options={allPeriods} />
            <MultiSelectDropdown label="Region" values={selectedRegions} onChange={setSelectedRegions} options={allRegions} />
            <MultiSelectDropdown label="Cluster" values={selectedClusters} onChange={setSelectedClusters} options={allClusters} />
            <MultiSelectDropdown label="Mitra" values={selectedMitras} onChange={setSelectedMitras} options={allMitras} />
            <MultiSelectDropdown label="Job" values={selectedJobs} onChange={setSelectedJobs} options={allJobs} />
            <MultiSelectDropdown label="Status Gizi" values={selectedKategoris} onChange={setSelectedKategoris} options={allKategori} />
          </div>
        </div>
      </div>

      {/* Kartu Statistik dengan Ilustrasi Siluet Tubuh Manusia */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 p-5 rounded-3xl border border-slate-400 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-slate-500 cursor-pointer flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">Total Pengukuran</span>
            <h4 className="text-2xl font-black text-slate-950">{totalSubmissions}</h4>
            <p className="text-[10px] text-slate-700 font-bold">Data masuk terekam</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/80 border border-slate-300 flex items-center justify-center text-slate-800 shadow-inner">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-300 via-emerald-200 to-emerald-400 p-5 rounded-3xl border border-emerald-500 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-emerald-600 cursor-pointer flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-950 block">Normal / Ideal</span>
            <h4 className="text-2xl font-black text-emerald-950">{idealCount}</h4>
            <p className="text-[10px] text-emerald-900 font-black">BMI 18.5 - 24.9</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/80 border border-emerald-400 flex items-center justify-center text-emerald-700 shadow-inner">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="4" r="2.5"/>
              <path d="M12 8c-2 0-4 1-4 3v3h2v7h2v-5h2v5h2v-7h2v-3c0-2-2-3-4-3z"/>
            </svg>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-300 via-rose-200 to-rose-400 p-5 rounded-3xl border border-rose-500 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-rose-600 cursor-pointer flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-950 block">Overweight / Obesitas</span>
            <h4 className="text-2xl font-black text-rose-950">{overweightCount}</h4>
            <p className="text-[10px] text-rose-900 font-black">BMI &gt; 25.0</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/80 border border-rose-400 flex items-center justify-center text-rose-700 shadow-inner">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="4" r="2.5"/>
              <path d="M12 8c-3 0-6 1.5-6 4.5v2.5h2.5v6h2.5v-4.5h2v4.5h2.5v-6H18V12.5C18 9.5 15 8 12 8z"/>
            </svg>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-300 via-amber-200 to-amber-400 p-5 rounded-3xl border border-amber-500 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-amber-600 cursor-pointer flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-950 block">Underweight</span>
            <h4 className="text-2xl font-black text-amber-950">{underweightCount}</h4>
            <p className="text-[10px] text-amber-900 font-black">BMI &lt; 18.5</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/80 border border-amber-400 flex items-center justify-center text-amber-700 shadow-inner">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="4" r="2"/>
              <path d="M12 7c-1.2 0-2.5.8-2.5 2.5v4h1.5v7.5h2V13.5h1.5v-4C14.5 7.8 13.2 7 12 7z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Chart Visualisasi Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-cyan-50/80 via-white to-sky-50/80 p-6 rounded-3xl border border-cyan-200 shadow-sm space-y-3 flex flex-col justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-map-location-dot text-cyan-600"></i>
            Komposisi BMI Berdasarkan Regional
          </h4>
          <div className="h-64 w-full">
            <Bar data={generateChartDataByGroup('region')} options={chartOptions} plugins={[datalabelsPlugin]} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 p-6 rounded-3xl border border-emerald-200 shadow-sm space-y-3 flex flex-col justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-briefcase text-emerald-600"></i>
            Komposisi BMI Berdasarkan Job
          </h4>
          <div className="h-64 w-full">
            <Bar data={generateChartDataByGroup('job')} options={chartOptions} plugins={[datalabelsPlugin]} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/80 p-6 rounded-3xl border border-violet-200 shadow-sm space-y-3 flex flex-col justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-violet-600"></i>
            Tren Waktu Pengukuran (Monthly Trend)
          </h4>
          <div className="h-64 w-full">
            <Line data={generateMonthlyTrendData()} options={lineChartOptions} />
          </div>
        </div>
      </div>

      {/* Tabel Utama Riwayat BMI */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-table text-indigo-600"></i> Riwayat Pengukuran BMI T-Fronters
          </h4>
          <button 
            onClick={() => exportToExcel(filteredData, 'Riwayat_BMI_T-Fronters')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-file-excel"></i>
            <span>Download Excel</span>
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('tanggal')}>Tanggal</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('region')}>Region / Cluster</th>
                <th className="py-3.5 px-4">Mitra</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('unit_name')}>Unit Name</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('nik_csr')}>NIK SIAD</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('nama_csr')}>Nama CSR</th>
                <th className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('tinggi_badan')}>Tinggi (cm)</th>
                <th className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('berat_badan')}>Berat (kg)</th>
                <th className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('nilai_bmi')}>BMI</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-700 transition" onClick={() => handleSort('kategori')}>Kategori Gizi</th>
                <th className="py-3.5 px-4 text-center">Eviden</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="12" className="py-8 text-center text-slate-400 italic">Memuat data...</td></tr>
              ) : currentRows.length === 0 ? (
                <tr><td colSpan="12" className="py-8 text-center text-slate-400 italic">Tidak ada data BMI ditemukan.</td></tr>
              ) : (
                currentRows.map((item) => {
                  const kat = String(item.kategori || '');
                  const isOverOrObe = kat.includes('Overweight') || kat.includes('Obesitas');
                  const isUnder = kat.includes('Kekurangan');

                  return (
                    <tr key={item.id || item.nik_csr} className="hover:bg-slate-100/80 transition duration-200">
                      <td className="py-3 px-4 font-medium text-slate-600">{item.tanggal}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{getRecordRegion(item)} / {getRecordCluster(item) || '-'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{getRecordMitra(item)}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{item.unit_name}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.nik_csr}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.nama_csr}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{item.tinggi_badan}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{item.berat_badan}</td>
                      <td className="py-3 px-4 text-center font-black text-indigo-700">{item.nilai_bmi}</td>
                      <td className="py-3 px-4 font-bold">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] ${
                          kat.includes('Normal') ? 'bg-emerald-100 text-emerald-800' :
                          isUnder ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.kategori}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.link_eviden ? (
                          <a href={item.link_eviden} target="_blank" rel="noreferrer" className="px-3 py-1 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition inline-flex items-center gap-1 shadow-sm">
                            <i className="fa-solid fa-link text-[9px]"></i> Lihat
                          </a>
                        ) : <span className="text-slate-400 italic">Tidak ada</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOverOrObe ? (
                          <span className="inline-block px-3 py-1 bg-rose-600 text-white rounded-xl text-[10px] font-black shadow-sm uppercase tracking-wider">Turunkan BB</span>
                        ) : isUnder ? (
                          <span className="inline-block px-3 py-1 bg-amber-500 text-white rounded-xl text-[10px] font-black shadow-sm uppercase tracking-wider">Naikkan BB</span>
                        ) : (
                          <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-sm uppercase tracking-wider">Ideal</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredData.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstRow + 1}</span> sampai <span className="font-bold text-slate-800">{Math.min(indexOfLastRow, filteredData.length)}</span> dari <span className="font-bold text-slate-800">{filteredData.length}</span> data
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold rounded-xl transition cursor-pointer">
                <i className="fa-solid fa-chevron-left mr-1.5 text-[10px]"></i> Sebelumnya
              </button>
              <span className="px-3 py-2 bg-slate-900 text-white font-bold rounded-xl shadow-sm">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold rounded-xl transition cursor-pointer">
                Selanjutnya <i className="fa-solid fa-chevron-right ml-1.5 text-[10px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- TABEL TAMBAHAN 1: List T-Fronters yang Belum Submit --- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-user-clock text-amber-600"></i> List T-Fronters Belum Submit BMI
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Daftar CSR yang belum melakukan pengisian laporan BMI mengacu pada database CSR.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 font-black text-xs rounded-xl">
              Total: {unsubmittedList.length} Orang
            </span>
            <button 
              onClick={() => exportToExcel(unsubmittedList, 'T-Fronters_Belum_Submit')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span>Download Excel</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-700 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-3.5 px-4">Region</th>
                <th className="py-3.5 px-4">Cluster</th>
                <th className="py-3.5 px-4">Mitra</th>
                <th className="py-3.5 px-4">Unit Name</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Job Role</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="8" className="py-6 text-center text-slate-400 italic">Memuat data...</td></tr>
              ) : currentUnsubRows.length === 0 ? (
                <tr><td colSpan="8" className="py-6 text-center text-slate-400 italic">Semua T-Fronters sudah melakukan submit!</td></tr>
              ) : (
                currentUnsubRows.map((csr, idx) => (
                  <tr key={csr.id || idx} className="hover:bg-amber-50/50 transition duration-200">
                    <td className="py-3 px-4 font-bold text-slate-700">{getRecordRegion(csr) || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{getRecordCluster(csr) || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{getRecordMitra(csr) || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{csr.unitName || csr.unit_name || '-'}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{csr.nik || csr.nik_csr || '-'}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{csr.nama || csr.nama_csr || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{getRecordJob(csr) || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">Belum Submit</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {unsubmittedList.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between pt-3 border-t border-slate-100 gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstUnsub + 1}</span> sampai <span className="font-bold text-slate-800">{Math.min(indexOfLastUnsub, unsubmittedList.length)}</span> dari <span className="font-bold text-slate-800">{unsubmittedList.length}</span> data
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPageUnsubmitted(prev => Math.max(prev - 1, 1))} disabled={pageUnsubmitted === 1} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                <i className="fa-solid fa-chevron-left mr-1 text-[9px]"></i> Prev
              </button>
              <span className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-xl">{pageUnsubmitted} / {totalPagesUnsub}</span>
              <button onClick={() => setPageUnsubmitted(prev => Math.min(prev + 1, totalPagesUnsub))} disabled={pageUnsubmitted === totalPagesUnsub} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                Next <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- TABEL TAMBAHAN 2: CSR yang BMI Tidak Ideal 3 Bulan Berturut-turut --- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-rose-600"></i> T-Fronters BMI Tidak Ideal (3 Bulan Berturut-turut)
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Daftar CSR yang tercatat mengalami kategori Overweight, Obesitas, atau Underweight selama 3 bulan berturut-turut.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-rose-100 text-rose-800 font-black text-xs rounded-xl">
              Total: {streakList.length} Orang
            </span>
            <button 
              onClick={() => exportToExcel(streakList, 'CSR_BMI_Tidak_Ideal_3_Bulan')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span>Download Excel</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-rose-950 via-rose-900 to-rose-800 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-3.5 px-4">Region / Cluster</th>
                <th className="py-3.5 px-4">Mitra</th>
                <th className="py-3.5 px-4">Unit Name</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Periode Streak (3 Bulan)</th>
                <th className="py-3.5 px-4">Status Terakhir</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="8" className="py-6 text-center text-slate-400 italic">Memuat data...</td></tr>
              ) : currentStreakRows.length === 0 ? (
                <tr><td colSpan="8" className="py-6 text-center text-slate-400 italic">Tidak ada CSR yang mengalami status tidak ideal 3 bulan berturut-turut.</td></tr>
              ) : (
                currentStreakRows.map((item, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/50 transition duration-200">
                    <td className="py-3 px-4 font-bold text-slate-800">{item.region} / {item.cluster || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{item.mitra}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{item.unit_name}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.nik_csr}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{item.nama_csr}</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">{item.periode_streak}</td>
                    <td className="py-3 px-4 font-bold">
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">
                        {item.kategori_terakhir}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-3 py-1 bg-rose-600 text-white rounded-xl text-[10px] font-black shadow-sm uppercase">
                        Perlu Coaching
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {streakList.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between pt-3 border-t border-slate-100 gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstStreak + 1}</span> sampai <span className="font-bold text-slate-800">{Math.min(indexOfLastStreak, streakList.length)}</span> dari <span className="font-bold text-slate-800">{streakList.length}</span> data
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPageStreak(prev => Math.max(prev - 1, 1))} disabled={pageStreak === 1} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                <i className="fa-solid fa-chevron-left mr-1 text-[9px]"></i> Prev
              </button>
              <span className="px-3 py-1.5 bg-rose-700 text-white font-bold rounded-xl">{pageStreak} / {totalPagesStreak}</span>
              <button onClick={() => setPageStreak(prev => Math.min(prev + 1, totalPagesStreak))} disabled={pageStreak === totalPagesStreak} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                Next <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}