import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabase';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

export default function TryOut() {
  const [filterTahun, setFilterTahun] = useState('ALL');
  const [filterBulan, setFilterBulan] = useState('ALL');
  const [filterMinggu, setFilterMinggu] = useState('ALL');
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterUnit, setFilterUnit] = useState('ALL');

  const [showTahunMenu, setShowTahunMenu] = useState(false);
  const [showBulanMenu, setShowBulanMenu] = useState(false);
  const [showMingguMenu, setShowMingguMenu] = useState(false);
  const [showRegionMenu, setShowRegionMenu] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);

  const [tahunSearch, setTahunSearch] = useState('');
  const [bulanSearch, setBulanSearch] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  const [availableYears, setAvailableYears] = useState(['2026']);
  const [unitsList, setUnitsList] = useState([]);
  const [globalCsrDatabase, setGlobalCsrDatabase] = useState([]);

  const [kpiData, setKpiData] = useState({
    peserta: '--',
    avg: '--',
    max: '--',
    min: '--',
    passRate: '--%',
    underCount: '--'
  });

  const [remedialList, setRemedialList] = useState([]);
  const [searchCsrQuery, setSearchCsrQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const chartRegionRef = useRef(null);
  const chartTrendRef = useRef(null);
  const chartJobRef = useRef(null);
  const chartTopUnitRef = useRef(null);
  const chartBottomUnitRef = useRef(null);

  const regionInst = useRef(null);
  const trendInst = useRef(null);
  const jobInst = useRef(null);
  const topUnitInst = useRef(null);
  const bottomUnitInst = useRef(null);

  const regionDropdownRef = useRef(null);
  const unitDropdownRef = useRef(null);
  const tahunDropdownRef = useRef(null);
  const bulanDropdownRef = useRef(null);
  const mingguDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(event.target)) setShowRegionMenu(false);
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target)) setShowUnitMenu(false);
      if (tahunDropdownRef.current && !tahunDropdownRef.current.contains(event.target)) setShowTahunMenu(false);
      if (bulanDropdownRef.current && !bulanDropdownRef.current.contains(event.target)) setShowBulanMenu(false);
      if (mingguDropdownRef.current && !mingguDropdownRef.current.contains(event.target)) setShowMingguMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadTOData();
  }, [filterTahun, filterBulan, filterMinggu, filterRegion, filterUnit]);

  useEffect(() => {
    updateCascadeUnits(filterRegion);
  }, [filterRegion, globalCsrDatabase]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchCsrQuery]);

  const updateCascadeUnits = (reg) => {
    let filtered = globalCsrDatabase;
    if (reg !== 'ALL') {
      filtered = globalCsrDatabase.filter(i => (i.region || '') === reg);
    }
    const units = [...new Set(filtered.map(i => i.unitName || i.unit_name).filter(Boolean))].sort();
    setUnitsList(units);
    if (!units.includes(filterUnit) && filterUnit !== 'ALL') {
      setFilterUnit('ALL');
    }
  };

  const fetchAllRows = async (tableName) => {
    let semuaData = [];
    let step = 1000;
    let mulai = 0;
    let lanjut = true;
    let safetyCounter = 0;

    while (lanjut && safetyCounter < 20) {
      safetyCounter++;
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(mulai, mulai + step - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        semuaData = semuaData.concat(data);
        if (data.length < step) {
          lanjut = false;
        } else {
          mulai += step;
        }
      } else {
        lanjut = false;
      }
    }
    return semuaData;
  };

  const loadTOData = async () => {
    try {
      const csrRes = await fetchAllRows('database_csr');
      setGlobalCsrDatabase(csrRes || []);

      const rawList = await fetchAllRows('nilai_to');

      const enrichedList = (rawList || []).map(row => {
        const nik = String(row.nik || row.nik_csr || '').trim();
        const foundCsr = (csrRes || []).find(c => String(c.nik || c.nik_csr || '').trim() === nik);

        const tanggalStr = row.tanggal || row.created_at || '';
        let tahun = row.tahun || '';
        let bulan = row.bulan || '';
        if (tanggalStr && (!tahun || !bulan)) {
          const d = new Date(tanggalStr);
          if (!isNaN(d)) {
            tahun = String(d.getFullYear());
            const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            bulan = monthNames[d.getMonth()];
          }
        }

        return {
          id: row.id,
          tahun: tahun || '2026',
          bulan: bulan || 'Januari',
          minggu: row.minggu || row.minggu_ke || 'Satu',
          nik: nik,
          nama: row.nama || row.nama_csr || foundCsr?.nama || foundCsr?.nama_csr || foundCsr?.name || '-',
          jobName: row.job_name || foundCsr?.job_name || row.job || foundCsr?.job || '-',
          unitName: row.unitName || row.unit_name || foundCsr?.unitName || foundCsr?.unit_name || '-',
          region: row.region || foundCsr?.region || '-',
          nilai: Number(row.nilai ?? row.score ?? 0)
        };
      });

      const years = [...new Set(enrichedList.map(i => i.tahun).filter(Boolean))].sort().reverse();
      if (years.length === 0) years.push('2026');
      setAvailableYears(years);

      const filteredList = enrichedList.filter(item => {
        const matchTahun = filterTahun === 'ALL' || item.tahun === filterTahun;
        const matchBulan = filterBulan === 'ALL' || item.bulan === filterBulan;
        const matchMinggu = filterMinggu === 'ALL' || item.minggu === filterMinggu;
        const matchRegion = filterRegion === 'ALL' || item.region === filterRegion;
        const matchUnit = filterUnit === 'ALL' || item.unitName === filterUnit;
        return matchTahun && matchBulan && matchMinggu && matchRegion && matchUnit;
      });

      const totalPeserta = filteredList.length;
      const scores = filteredList.map(i => i.nilai);
      const avgScore = totalPeserta > 0 ? (scores.reduce((a, b) => a + b, 0) / totalPeserta).toFixed(1) : '0.0';
      const maxScore = totalPeserta > 0 ? Math.max(...scores) : 0;
      const minScore = totalPeserta > 0 ? Math.min(...scores) : 0;

      const passCount = filteredList.filter(i => i.nilai >= 80).length;
      const passRate = totalPeserta > 0 ? ((passCount / totalPeserta) * 100).toFixed(1) : '0.0';
      const underCount = filteredList.filter(i => i.nilai < 80).length;

      setKpiData({
        peserta: totalPeserta,
        avg: avgScore,
        max: maxScore,
        min: minScore,
        passRate: passRate + '%',
        underCount: underCount
      });

      // Region Analytics
      const regionMap = {};
      filteredList.forEach(i => {
        const reg = i.region || 'Lainnya';
        if (!regionMap[reg]) regionMap[reg] = { total: 0, sum: 0 };
        regionMap[reg].total++;
        regionMap[reg].sum += i.nilai;
      });
      const regionAnalytics = Object.entries(regionMap).map(([region, data]) => ({
        region,
        avg: (data.sum / data.total).toFixed(1)
      }));
      renderTORegionChart(regionAnalytics);

      // Weekly Trend
      const weekMap = { 'Satu': 'Minggu 1', 'Dua': 'Minggu 2', 'Tiga': 'Minggu 3', 'Empat': 'Minggu 4' };
      const weeklyMap = {};
      ['Satu', 'Dua', 'Tiga', 'Empat'].forEach(w => { weeklyMap[weekMap[w]] = { sum: 0, count: 0 }; });
      filteredList.forEach(i => {
        const wLabel = weekMap[i.minggu] || i.minggu;
        if (!weeklyMap[wLabel]) weeklyMap[wLabel] = { sum: 0, count: 0 };
        weeklyMap[wLabel].sum += i.nilai;
        weeklyMap[wLabel].count++;
      });
      const weeklyTrend = Object.entries(weeklyMap).map(([minggu, data]) => ({
        minggu,
        avg: data.count > 0 ? (data.sum / data.count).toFixed(1) : 0
      }));
      renderTOTrendChart(weeklyTrend);

      // Job Analytics
      const jobMap = {};
      filteredList.forEach(i => {
        const j = i.jobName || 'Lainnya';
        if (!jobMap[j]) jobMap[j] = { sum: 0, count: 0 };
        jobMap[j].sum += i.nilai;
        jobMap[j].count++;
      });
      const jobAnalytics = Object.entries(jobMap).map(([job, data]) => ({
        job,
        avg: (data.sum / data.count).toFixed(1)
      })).sort((a, b) => b.avg - a.avg);
      renderTOJobChart(jobAnalytics);

      // Unit Analytics
      const unitMap = {};
      filteredList.forEach(i => {
        const u = i.unitName || 'Lainnya';
        if (!unitMap[u]) unitMap[u] = { sum: 0, count: 0 };
        unitMap[u].sum += i.nilai;
        unitMap[u].count++;
      });
      const unitAverages = Object.entries(unitMap).map(([unit, data]) => ({
        unit,
        avg: Number((data.sum / data.count).toFixed(1))
      })).sort((a, b) => b.avg - a.avg);

      renderTOTopUnitChart(unitAverages.slice(0, 5));
      renderTOBottomUnitChart([...unitAverages].reverse().slice(0, 5));

      // Remedial List
      const remedial = filteredList.filter(i => i.nilai < 80).sort((a, b) => a.nilai - b.nilai);
      setRemedialList(remedial);

    } catch (err) {
      console.error("Error loading TryOut data:", err);
    }
  };

  const resetTOFilters = () => {
    setFilterTahun('ALL');
    setFilterBulan('ALL');
    setFilterMinggu('ALL');
    setFilterRegion('ALL');
    setFilterUnit('ALL');
    setSearchCsrQuery('');
  };

  // Chart Renders
  const renderTORegionChart = (dataList) => {
    if (!chartRegionRef.current || !dataList.length) return;
    const ctx = chartRegionRef.current.getContext('2d');
    if (regionInst.current) regionInst.current.destroy();

    const labels = dataList.map(d => d.region);
    const avgs = dataList.map(d => Number(d.avg) || 0);
    const backgroundColors = avgs.map((_, index) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 300);
      if (index === 0) { grad.addColorStop(0, '#059669'); grad.addColorStop(1, '#34D399'); }
      else if (index === 1) { grad.addColorStop(0, '#2563EB'); grad.addColorStop(1, '#60A5FA'); }
      else { grad.addColorStop(0, '#7C3AED'); grad.addColorStop(1, '#A78BFA'); }
      return grad;
    });

    regionInst.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: avgs, backgroundColor: backgroundColors, borderRadius: 8, barPercentage: 0.45, categoryPercentage: 0.65 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18, bottom: 5, left: 10, right: 10 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: true, anchor: 'end', align: 'top', color: '#047857', font: { weight: 'bold', size: 11 }, formatter: v => Number(v).toFixed(1) }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } },
          y: { display: false, min: Math.min(...avgs) > 15 ? Math.min(...avgs) - 15 : 0, max: Math.max(...avgs, 80) + 8 }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderTOTrendChart = (dataList) => {
    if (!chartTrendRef.current || !dataList.length) return;
    const ctx = chartTrendRef.current.getContext('2d');
    if (trendInst.current) trendInst.current.destroy();

    const labels = dataList.map(d => d.minggu);
    const avgs = dataList.map(d => Number(d.avg) || 0);
    const gradientTrendArea = ctx.createLinearGradient(0, 0, 0, 300);
    gradientTrendArea.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    gradientTrendArea.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

    trendInst.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: avgs, borderColor: '#2563EB', backgroundColor: gradientTrendArea, fill: true, tension: 0.35, pointBackgroundColor: '#2563EB', pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18, bottom: 5, left: 15, right: 15 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: true, anchor: 'end', align: 'top', color: '#1E40AF', font: { weight: 'bold', size: 11 }, formatter: v => Number(v).toFixed(1) }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } },
          y: { display: false, min: Math.min(...avgs, 80) > 10 ? Math.min(...avgs, 80) - 10 : 0, max: Math.max(...avgs, 90) + 8 }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderTOJobChart = (dataList) => {
    if (!chartJobRef.current || !dataList.length) return;
    const ctx = chartJobRef.current.getContext('2d');
    if (jobInst.current) jobInst.current.destroy();

    const labels = dataList.map(d => d.job);
    const avgs = dataList.map(d => Number(d.avg) || 0);
    const gradientJob = ctx.createLinearGradient(0, 0, 400, 0);
    gradientJob.addColorStop(0, '#6366F1'); gradientJob.addColorStop(0.5, '#8B5CF6'); gradientJob.addColorStop(1, '#C084FC');

    jobInst.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: avgs, backgroundColor: gradientJob, borderRadius: 8, barPercentage: 0.6, categoryPercentage: 0.75 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 12, bottom: 12, left: 5, right: 65 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: true, anchor: 'end', align: 'right', color: '#5B21B6', font: { weight: 'bold', size: 11 }, formatter: v => Number(v).toFixed(1) }
        },
        scales: {
          x: { display: false, min: 0, max: Math.max(...avgs, 80) + 12 },
          y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderTOTopUnitChart = (dataList) => {
    if (!chartTopUnitRef.current || !dataList.length) return;
    const ctx = chartTopUnitRef.current.getContext('2d');
    if (topUnitInst.current) topUnitInst.current.destroy();

    const labels = dataList.map(d => d.unit);
    const avgs = dataList.map(d => Number(d.avg) || 0);
    const gradientTop = ctx.createLinearGradient(0, 0, 400, 0);
    gradientTop.addColorStop(0, '#059669'); gradientTop.addColorStop(1, '#34D399');

    topUnitInst.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: avgs, backgroundColor: gradientTop, borderRadius: 8, barPercentage: 0.6, categoryPercentage: 0.75 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 12, bottom: 12, left: 5, right: 65 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: true, anchor: 'end', align: 'right', color: '#047857', font: { weight: 'bold', size: 11 }, formatter: v => Number(v).toFixed(1) }
        },
        scales: {
          x: { display: false, min: 0, max: Math.max(...avgs, 80) + 12 },
          y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderTOBottomUnitChart = (dataList) => {
    if (!chartBottomUnitRef.current || !dataList.length) return;
    const ctx = chartBottomUnitRef.current.getContext('2d');
    if (bottomUnitInst.current) bottomUnitInst.current.destroy();

    const labels = dataList.map(d => d.unit);
    const avgs = dataList.map(d => Number(d.avg) || 0);
    const gradientBottomSoft = ctx.createLinearGradient(0, 0, 400, 0);
    gradientBottomSoft.addColorStop(0, '#E11D48'); gradientBottomSoft.addColorStop(1, '#FDA4AF');

    bottomUnitInst.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: avgs, backgroundColor: gradientBottomSoft, borderRadius: 8, barPercentage: 0.6, categoryPercentage: 0.75 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 12, bottom: 12, left: 5, right: 65 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: true, anchor: 'end', align: 'right', color: '#9F1239', font: { weight: 'bold', size: 11 }, formatter: v => Number(v).toFixed(1) }
        },
        scales: {
          x: { display: false, min: 0, max: Math.max(...avgs, 80) + 12 },
          y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  // Pagination & Search for Remedial Table
  const filteredRemedial = remedialList.filter(row => {
    const s = searchCsrQuery.toLowerCase().trim();
    if (!s) return true;
    return String(row.nik || '').toLowerCase().includes(s) || String(row.nama || '').toLowerCase().includes(s);
  });

  const totalData = filteredRemedial.length;
  const totalPages = Math.ceil(totalData / rowsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages) || 1;
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalData);
  const paginatedData = filteredRemedial.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 font-sans relative">

      {/* Header & Professional Metallic Gray Gradient Filter Bar */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-[0_15px_35px_-5px_rgba(100,116,139,0.35)] border border-slate-400/80 space-y-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold border border-emerald-200 shadow-sm">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Evaluasi Try Out CSR</h3>
              <p className="text-xs text-slate-700 font-medium">Monitoring tingkat pemahaman dan kelulusan materi Try Out pelayanan (Standar Pass Rate: ≥ 80).</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button type="button" onClick={resetTOFilters} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer backdrop-blur-md">
              <i className="fa-solid fa-rotate-left text-xs"></i>
              <span>Reset Filter</span>
            </button>
            <button type="button" onClick={loadTOData} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer backdrop-blur-md">
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Modern Filter Control Bar (5 Column Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-4 border-t border-slate-400/70 relative z-40">
          
          {/* 1. Custom Dropdown TAHUN */}
          <div className="relative z-50" ref={tahunDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tahun</label>
            <button type="button" onClick={() => { setShowTahunMenu(!showTahunMenu); setShowBulanMenu(false); setShowMingguMenu(false); setShowRegionMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-emerald-600 transition flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{filterTahun === 'ALL' ? 'Semua Tahun' : filterTahun}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-calendar text-slate-500 text-xs absolute left-3.5 top-[31px] pointer-events-none"></i>

            {showTahunMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Tahun..." value={tahunSearch} onChange={e => setTahunSearch(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                  <div onClick={() => { setFilterTahun('ALL'); setShowTahunMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterTahun === 'ALL' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>
                    Semua Tahun
                  </div>
                  {availableYears.filter(yr => yr.toLowerCase().includes(tahunSearch.toLowerCase())).map(yr => (
                    <div key={yr} onClick={() => { setFilterTahun(yr); setShowTahunMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterTahun === yr ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-semibold text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>
                      {yr}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Custom Dropdown BULAN */}
          <div className="relative z-50" ref={bulanDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Bulan</label>
            <button type="button" onClick={() => { setShowBulanMenu(!showBulanMenu); setShowTahunMenu(false); setShowMingguMenu(false); setShowRegionMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-emerald-600 transition flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{filterBulan === 'ALL' ? 'Semua Bulan' : filterBulan}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-calendar-days text-slate-500 text-xs absolute left-3.5 top-[31px] pointer-events-none"></i>

            {showBulanMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Bulan..." value={bulanSearch} onChange={e => setBulanSearch(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                  <div onClick={() => { setFilterBulan('ALL'); setShowBulanMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterBulan === 'ALL' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Semua Bulan</div>
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].filter(b => b.toLowerCase().includes(bulanSearch.toLowerCase())).map(b => (
                    <div key={b} onClick={() => { setFilterBulan(b); setShowBulanMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterBulan === b ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>{b}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Custom Dropdown MINGGU KE */}
          <div className="relative z-50" ref={mingguDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Minggu Ke</label>
            <button type="button" onClick={() => { setShowMingguMenu(!showMingguMenu); setShowTahunMenu(false); setShowBulanMenu(false); setShowRegionMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-emerald-600 transition flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{filterMinggu === 'ALL' ? 'Semua Minggu' : `Minggu ${filterMinggu}`}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-clock flex items-center justify-center text-slate-500 text-xs absolute left-3.5 top-[31px] pointer-events-none"></i>

            {showMingguMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden p-2 space-y-1">
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  <div onClick={() => { setFilterMinggu('ALL'); setShowMingguMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterMinggu === 'ALL' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Semua Minggu</div>
                  <div onClick={() => { setFilterMinggu('Satu'); setShowMingguMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterMinggu === 'Satu' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Minggu 1</div>
                  <div onClick={() => { setFilterMinggu('Dua'); setShowMingguMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterMinggu === 'Dua' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Minggu 2</div>
                  <div onClick={() => { setFilterMinggu('Tiga'); setShowMingguMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterMinggu === 'Tiga' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Minggu 3</div>
                  <div onClick={() => { setFilterMinggu('Empat'); setShowMingguMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterMinggu === 'Empat' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Minggu 4</div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Custom Dropdown REGION */}
          <div className="relative z-50" ref={regionDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Region</label>
            <button type="button" onClick={() => { setShowRegionMenu(!showRegionMenu); setShowTahunMenu(false); setShowBulanMenu(false); setShowMingguMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-emerald-600 transition flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{filterRegion === 'ALL' ? 'Semua Region' : filterRegion}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-map-location-dot text-slate-500 text-xs absolute left-3.5 top-[31px] pointer-events-none"></i>

            {showRegionMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Region..." value={regionSearch} onChange={e => setRegionSearch(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  <div onClick={() => { setFilterRegion('ALL'); setShowRegionMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterRegion === 'ALL' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Semua Region</div>
                  {['Sulawesi', 'Kalimantan', 'Papua Maluku'].filter(r => r.toLowerCase().includes(regionSearch.toLowerCase())).map(r => (
                    <div key={r} onClick={() => { setFilterRegion(r); setShowRegionMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterRegion === r ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>{r}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Custom Dropdown UNIT NAME (Cascading dari Region) */}
          <div className="relative z-50" ref={unitDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Unit Name</label>
            <button type="button" onClick={() => { setShowUnitMenu(!showUnitMenu); setShowTahunMenu(false); setShowBulanMenu(false); setShowMingguMenu(false); setShowRegionMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-emerald-600 transition flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{filterUnit === 'ALL' ? 'Semua Unit Name' : filterUnit}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-building text-slate-500 text-xs absolute left-3.5 top-[31px] pointer-events-none"></i>

            {showUnitMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Unit..." value={unitSearch} onChange={e => setUnitSearch(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  <div onClick={() => { setFilterUnit('ALL'); setShowUnitMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterUnit === 'ALL' ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>Semua Unit Name</div>
                  {unitsList.filter(u => u.toLowerCase().includes(unitSearch.toLowerCase())).map(u => (
                    <div key={u} onClick={() => { setFilterUnit(u); setShowUnitMenu(false); }} className={`px-3 py-2 rounded-xl text-xs ${filterUnit === u ? 'font-bold bg-emerald-50 text-emerald-600' : 'font-medium text-slate-700'} hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition`}>{u}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Scorecards KPI 6 Cards Try Out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        
        <div className="bg-gradient-to-br from-slate-50 to-slate-200/90 p-4 rounded-3xl border-2 border-slate-300 shadow-xl shadow-slate-300/50 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Total Peserta</p>
            <h4 className="text-2xl font-black text-slate-950 mt-0.5">{kpiData.peserta}</h4>
            <span className="text-[10px] text-slate-600 font-bold">Peserta TO</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-200/90 p-4 rounded-3xl border-2 border-emerald-400 shadow-xl shadow-emerald-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">Average Nilai</p>
            <h4 className="text-2xl font-black text-emerald-950 mt-0.5">{kpiData.avg}</h4>
            <span className="text-[9px] text-emerald-900 bg-emerald-200/90 px-2 py-0.5 rounded font-black">Target: ≥ 80.0</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-calculator"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-200/90 p-4 rounded-3xl border-2 border-blue-400 shadow-xl shadow-blue-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-900 uppercase tracking-wider">Nilai Max</p>
            <h4 className="text-2xl font-black text-blue-950 mt-0.5">{kpiData.max}</h4>
            <span className="text-[10px] text-blue-900 font-bold">Skor Tertinggi</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-blue-700 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-trophy"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-200/90 p-4 rounded-3xl border-2 border-amber-400 shadow-xl shadow-amber-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-950 uppercase tracking-wider">Nilai Min</p>
            <h4 className="text-2xl font-black text-amber-950 mt-0.5">{kpiData.min}</h4>
            <span className="text-[10px] text-amber-900 font-bold">Skor Terendah</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-arrow-down-short-wide"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-200/90 p-4 rounded-3xl border-2 border-teal-400 shadow-xl shadow-teal-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-teal-900 uppercase tracking-wider">Pass Rate</p>
            <h4 className="text-2xl font-black text-teal-950 mt-0.5">{kpiData.passRate}</h4>
            <span className="text-[10px] text-teal-900 font-bold">Lulus (≥ 80)</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-teal-700 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-user-check"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-200/90 p-4 rounded-3xl border-2 border-rose-400 shadow-xl shadow-rose-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-rose-950 uppercase tracking-wider">Under Target</p>
            <h4 className="text-2xl font-black text-rose-950 mt-0.5">{kpiData.underCount}</h4>
            <span className="text-[10px] text-rose-900 font-bold">Remedial (&lt; 80)</span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-sm shadow-md">
            <i className="fa-solid fa-user-xmark"></i>
          </div>
        </div>

      </div>

      {/* SECTION CHARTS ANALYTICS: Region & Trend Mingguan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2 border-b border-slate-200/80 pb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base font-bold border border-emerald-100 shadow-sm">
                <i className="fa-solid fa-chart-column"></i>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Performa TO per Region</h4>
                <p className="text-xs text-slate-500">Rata-rata Nilai & Pass Rate per Wilayah</p>
              </div>
            </div>
            <div className="relative h-[420px]">
              <canvas ref={chartRegionRef}></canvas>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2 border-b border-slate-200/80 pb-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base font-bold border border-blue-100 shadow-sm">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Trend Nilai Mingguan</h4>
                <p className="text-xs text-slate-500">Perkembangan average nilai dari Minggu 1 - 4</p>
              </div>
            </div>
            <div className="relative h-[420px]">
              <canvas ref={chartTrendRef}></canvas>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION CHARTS ANALYTICS: 3 Kolom Bawah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3 border-b border-slate-200/80 pb-3">
              <div className="w-8 h-8 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold border border-purple-100 shadow-sm">
                <i className="fa-solid fa-briefcase"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Average Nilai Per Role</h4>
                <p className="text-[11px] text-slate-500">Perbandingan hasil TO per role</p>
              </div>
            </div>
            <div className="relative h-[380px]">
              <canvas ref={chartJobRef}></canvas>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3 border-b border-slate-200/80 pb-3">
              <div className="w-8 h-8 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold border border-emerald-100 shadow-sm">
                <i className="fa-solid fa-trophy"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Top 5 Unit / GraPARI</h4>
                <p className="text-[11px] text-slate-500">Unit nilai Try Out tertinggi</p>
              </div>
            </div>
            <div className="relative h-[380px]">
              <canvas ref={chartTopUnitRef}></canvas>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3 border-b border-slate-200/80 pb-3">
              <div className="w-8 h-8 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm font-bold border border-rose-100 shadow-sm">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Bottom 5 Unit / GraPARI</h4>
                <p className="text-[11px] text-slate-500">Unit nilai Try Out terendah</p>
              </div>
            </div>
            <div className="relative h-[380px]">
              <canvas ref={chartBottomUnitRef}></canvas>
            </div>
          </div>
        </div>

      </div>

      {/* TABEL PRIORITAS REMEDIAL CSR (< 80) */}
      <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] space-y-5">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎯</span>
              <h3 className="text-base font-bold text-slate-900">Daftar Remedial TO CSR (Nilai &lt; 80)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Menampilkan peserta yang memerlukan pembinaan atau Try Out ulang.</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </div>
              <input 
                type="text" 
                value={searchCsrQuery}
                onChange={e => { setSearchCsrQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Cari NIK / Nama CSR..." 
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition shadow-sm w-48 focus:w-60"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-[11px] font-black text-white uppercase tracking-wider shadow-md">
                <th className="py-3.5 px-4 first:rounded-l-2xl">Bulan / Minggu</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Job Name</th>
                <th className="py-3.5 px-4">Unit / GraPARI</th>
                <th className="py-3.5 px-4">Region</th>
                <th className="py-3.5 px-4 text-center last:rounded-r-2xl">Nilai TO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs font-medium text-slate-800">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-slate-500 italic">Tidak ada data CSR under target Try Out (&lt; 80).</td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-white/80 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{row.bulan} (Minggu {row.minggu})</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nik}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nama}</td>
                    <td className="py-3.5 px-4"><span className="px-2.5 py-1 bg-white text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-300 shadow-sm">{row.jobName}</span></td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{row.unitName}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{row.region}</td>
                    <td className="py-3.5 px-4 text-center font-black text-rose-600 bg-rose-50 rounded-xl">{row.nilai}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200/80 gap-3">
          <p className="text-xs text-slate-600 font-medium">
            Menampilkan {totalData > 0 ? startIndex + 1 : 0} - {endIndex} dari {totalData} data
          </p>
          <div className="flex items-center space-x-2">
            <button 
              type="button" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
              disabled={safeCurrentPage <= 1} 
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <i className="fa-solid fa-chevron-left mr-1"></i> Sebelumnya
            </button>
            <span className="text-xs font-bold text-slate-800 px-3 py-1">Hal {safeCurrentPage} dari {totalPages}</span>
            <button 
              type="button" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={safeCurrentPage >= totalPages} 
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Berikutnya <i className="fa-solid fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}