import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabase';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';

Chart.register(ChartDataLabels);

export default function SalesRetensi() {
  const currentDate = new Date();
  const curYear = currentDate.getFullYear();
  const curMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const defaultMonth = `${curYear}-${curMonth}`;

  // State Filter
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedRegional, setSelectedRegional] = useState('ALL');
  const [selectedCluster, setSelectedCluster] = useState('ALL');
  const [selectedUnit, setSelectedUnit] = useState('ALL');

  // State List Lookup dari database_csr
  const [globalCsrDb, setGlobalCsrDb] = useState([]);
  const [regionalsList, setRegionalsList] = useState([]);
  const [clustersList, setClustersList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);

  const [salesRetensiData, setSalesRetensiData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // State Modal Input
  const [showModal, setShowModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().substring(0, 10),
    nik: '',
    nama: '',
    unit: '',
    msisdn: '',
    transaksi: '',
    cross_upselling: 'Ya',
    retensi: 'Ya',
    catatan: ''
  });

  // State Modern Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  // Chart Refs
  const trendChartRef = useRef(null);
  const pieCrossChartRef = useRef(null);
  const pieRetensiRef = useRef(null);

  const chartTrendInstance = useRef(null);
  const chartPieCrossInstance = useRef(null);
  const chartPieRetensiInstance = useRef(null);

  useEffect(() => {
    loadInitialCsr();
  }, []);

  // Update dropdown options (Cascading) berdasarkan database_csr
  useEffect(() => {
    if (globalCsrDb.length > 0) {
      const regs = [...new Set(globalCsrDb.map(c => c.regional || c.region).filter(Boolean))].sort();
      setRegionalsList(regs);
    }
  }, [globalCsrDb]);

  useEffect(() => {
    let filtered = globalCsrDb;
    if (selectedRegional !== 'ALL') {
      filtered = filtered.filter(c => (c.regional || c.region) === selectedRegional);
    }
    const cls = [...new Set(filtered.map(c => c.cluster || c.cluster_name).filter(Boolean))].sort();
    setClustersList(cls);
    if (selectedCluster !== 'ALL' && !cls.includes(selectedCluster)) {
      setSelectedCluster('ALL');
    }
  }, [selectedRegional, globalCsrDb]);

  useEffect(() => {
    let filtered = globalCsrDb;
    if (selectedRegional !== 'ALL') {
      filtered = filtered.filter(c => (c.regional || c.region) === selectedRegional);
    }
    if (selectedCluster !== 'ALL') {
      filtered = filtered.filter(c => (c.cluster || c.cluster_name) === selectedCluster);
    }
    const unts = [...new Set(filtered.map(c => c.unitName || c.unit_name).filter(Boolean))].sort();
    setUnitsList(unts);
    if (selectedUnit !== 'ALL' && !unts.includes(selectedUnit)) {
      setSelectedUnit('ALL');
    }
  }, [selectedRegional, selectedCluster, globalCsrDb]);

  // Load Data Sales Retensi setiap filter berubah
  useEffect(() => {
    if (globalCsrDb.length > 0) {
      loadSalesRetensiData();
    }
  }, [selectedMonth, selectedRegional, selectedCluster, selectedUnit, globalCsrDb]);

  useEffect(() => {
    renderCharts();
  }, [salesRetensiData]);

  const loadInitialCsr = async () => {
    try {
      const { data, error } = await supabase.from('database_csr').select('*');
      if (error) throw error;
      setGlobalCsrDb(data || []);
    } catch (err) {
      console.error("Gagal memuat database CSR:", err);
    }
  };

  const loadSalesRetensiData = async () => {
    try {
      let query = supabase.from('sales_retensi').select('*').order('tanggal', { ascending: false });

      if (selectedMonth) {
        const [yr, mn] = selectedMonth.split('-');
        const lastDay = new Date(parseInt(yr), parseInt(mn), 0).getDate();
        const firstDate = `${selectedMonth}-01`;
        const endDateMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('tanggal', firstDate).lte('tanggal', endDateMonth);
      }

      let { data, error } = await query;
      if (error) {
        console.error("Tabel sales_retensi mungkin belum ada:", error);
        setSalesRetensiData([]);
        return;
      }

      const csrMap = {};
      globalCsrDb.forEach(c => {
        const cNik = String(c.nik || c.nik_csr || '').trim();
        if (cNik) {
          csrMap[cNik] = {
            regional: c.regional || c.region || '',
            cluster: c.cluster || c.cluster_name || '',
            unitName: c.unitName || c.unit_name || ''
          };
        }
      });

      const enriched = (data || []).map(item => {
        const info = csrMap[String(item.nik).trim()] || {};
        return {
          ...item,
          lookup_regional: info.regional || 'Unknown',
          lookup_cluster: info.cluster || 'Unknown',
          lookup_unit: item.unit || info.unitName || 'Unknown'
        };
      });

      const filtered = enriched.filter(d => {
        if (selectedRegional !== 'ALL' && d.lookup_regional !== selectedRegional) return false;
        if (selectedCluster !== 'ALL' && d.lookup_cluster !== selectedCluster) return false;
        if (selectedUnit !== 'ALL' && d.lookup_unit !== selectedUnit) return false;
        return true;
      });

      setSalesRetensiData(filtered);
    } catch (err) {
      console.error("Gagal memuat data Sales-Retensi:", err);
    }
  };

  const renderCharts = () => {
    // 1. Trend Line Chart (Total Sample, Cross-Selling Ya, Retensi Ya)
    if (trendChartRef.current) {
      if (chartTrendInstance.current) chartTrendInstance.current.destroy();

      const dateMap = {};
      salesRetensiData.forEach(row => {
        const tgl = row.tanggal;
        if (!dateMap[tgl]) {
          dateMap[tgl] = { total: 0, csYa: 0, retYa: 0 };
        }
        dateMap[tgl].total += 1;
        if (row.cross_upselling === 'Ya') dateMap[tgl].csYa += 1;
        if (row.retensi === 'Ya') dateMap[tgl].retYa += 1;
      });

      const sortedDates = Object.keys(dateMap).sort();
      const labels = sortedDates.length > 0 ? sortedDates : ['-'];
      const totalVals = sortedDates.map(d => dateMap[d].total);
      const csYaVals = sortedDates.map(d => dateMap[d].csYa);
      const retYaVals = sortedDates.map(d => dateMap[d].retYa);

      chartTrendInstance.current = new Chart(trendChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Total Sample', data: totalVals, borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
            { label: 'Cross-Selling (Ya)', data: csYaVals, borderColor: '#10B981', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 },
            { label: 'Retensi (Ya)', data: retYaVals, borderColor: '#3B82F6', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              top: 35,
              left: 10,
              right: 15,
              bottom: 5
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' }, color: '#334155' } },
            datalabels: {
              display: true,
              color: '#1e293b',
              font: { weight: 'bold', size: 11 },
              align: 'top',
              offset: 6,
              formatter: (value) => value
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#64748B' } },
            y: { 
              display: false,
              suggestedMax: 4
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }

    // 2. Doughnut Chart Cross Selling
    if (pieCrossChartRef.current) {
      if (chartPieCrossInstance.current) chartPieCrossInstance.current.destroy();

      let csYa = 0;
      let csTidak = 0;
      salesRetensiData.forEach(r => {
        if (r.cross_upselling === 'Ya') csYa++;
        else csTidak++;
      });

      if (salesRetensiData.length === 0) { csYa = 1; csTidak = 1; }

      chartPieCrossInstance.current = new Chart(pieCrossChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Cross-Selling Ya', 'Cross-Selling Tidak'],
          datasets: [{
            data: [csYa, csTidak],
            backgroundColor: ['#10B981', '#F43F5E'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          rotation: 180,
          layout: {
            padding: 20
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' }, color: '#334155' } },
            datalabels: {
              display: true,
              color: '#1e293b',
              font: { weight: 'bold', size: 11 },
              anchor: 'end',
              align: 'end',
              offset: 6,
              formatter: (value) => value
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }

    // 3. Doughnut Chart Retensi
    if (pieRetensiRef.current) {
      if (chartPieRetensiInstance.current) chartPieRetensiInstance.current.destroy();

      let retYa = 0;
      let retTidak = 0;
      salesRetensiData.forEach(r => {
        if (r.retensi === 'Ya') retYa++;
        else retTidak++;
      });

      if (salesRetensiData.length === 0) { retYa = 1; retTidak = 1; }

      chartPieRetensiInstance.current = new Chart(pieRetensiRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Retensi Ya', 'Retensi Tidak'],
          datasets: [{
            data: [retYa, retTidak],
            backgroundColor: ['#3B82F6', '#F59E0B'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          rotation: 180,
          layout: {
            padding: 20
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' }, color: '#334155' } },
            datalabels: {
              display: true,
              color: '#1e293b',
              font: { weight: 'bold', size: 11 },
              anchor: 'end',
              align: 'end',
              offset: 6,
              formatter: (value) => value
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }
  };

  const handleNikChange = (val) => {
    const cleanedNik = val.trim();
    const found = globalCsrDb.find(c => String(c.nik || c.nik_csr || '').trim() === cleanedNik);
    
    if (found) {
      setFormData(prev => ({
        ...prev,
        nik: val,
        nama: found.nama || found.nama_csr || '',
        unit: found.unitName || found.unit_name || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        nik: val,
        nama: cleanedNik === '' ? '' : 'NIK tidak ditemukan di database',
        unit: cleanedNik === '' ? '' : '-'
      }));
    }
  };

  const handleOpenModal = () => {
    setFormData({
      tanggal: new Date().toISOString().substring(0, 10),
      nik: '',
      nama: '',
      unit: '',
      msisdn: '',
      transaksi: '',
      cross_upselling: 'Ya',
      retensi: 'Ya',
      catatan: ''
    });
    setShowModal(true);
    setIsClosingModal(false);
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosingModal(false);
    }, 200);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.nik || !formData.nama || formData.nama === 'NIK tidak ditemukan di database') {
      showToast('Silakan masukkan NIK CSR yang valid dan terdaftar.', 'warning');
      return;
    }

    try {
      const { error } = await supabase.from('sales_retensi').insert([{
        tanggal: formData.tanggal,
        nik: formData.nik,
        nama: formData.nama,
        unit: formData.unit,
        msisdn: formData.msisdn,
        transaksi: formData.transaksi,
        cross_upselling: formData.cross_upselling,
        retensi: formData.retensi,
        catatan: formData.catatan
      }]);

      if (error) throw error;

      showToast('Data Sales & Retensi berhasil disimpan!', 'success');
      handleCloseModal();
      loadSalesRetensiData();
    } catch (err) {
      console.error("Gagal menyimpan data:", err);
      showToast('Gagal menyimpan data. Pastikan tabel "sales_retensi" di Supabase sudah memiliki kolom "msisdn".', 'error');
    }
  };

  // Fungsi Export ke File Excel Asli (.xlsx)
  const handleDownloadExcel = () => {
    if (filteredTableData.length === 0) {
      showToast('Tidak ada data untuk di-download.', 'warning');
      return;
    }

    const dataToExport = filteredTableData.map((row, index) => ({
      'No': index + 1,
      'Tanggal': row.tanggal || '',
      'NIK': row.nik || '',
      'Nama CSR': row.nama || '',
      'Unit / GraPARI': row.unit || '',
      'MSISDN / ID IH': row.msisdn || '',
      'Transaksi': row.transaksi || '',
      'Cross/Up Selling': row.cross_upselling || '',
      'Retensi': row.retensi || '',
      'Catatan': row.catatan || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales & Retensi");

    // Mengatur lebar kolom agar rapi
    const colWidths = [
      {wch: 5},  // No
      {wch: 12}, // Tanggal
      {wch: 15}, // NIK
      {wch: 25}, // Nama CSR
      {wch: 20}, // Unit
      {wch: 18}, // MSISDN
      {wch: 15}, // Transaksi
      {wch: 16}, // Cross Selling
      {wch: 12}, // Retensi
      {wch: 30}  // Catatan
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Sales_Retensi_${selectedMonth || 'All'}.xlsx`);
    showToast('File Excel berhasil di-download!', 'success');
  };

  const filteredTableData = salesRetensiData.filter(row => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return String(row.nik).toLowerCase().includes(q) || 
           String(row.nama).toLowerCase().includes(q) || 
           String(row.unit).toLowerCase().includes(q) ||
           String(row.msisdn || '').toLowerCase().includes(q) ||
           String(row.transaksi || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filteredTableData.length / rowsPerPage) || 1;
  const paginatedData = filteredTableData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6 font-sans relative">
      
      {/* Header & Filter Bar */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-md border border-slate-400 space-y-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold border border-indigo-200 shadow-sm">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Fokus Sales & Retensi</h3>
              <p className="text-xs text-slate-700 font-medium">Monitoring performa khusus indikator penjualan dan retensi layanan CSR.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button onClick={handleOpenModal} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-md transition cursor-pointer">
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Input Sample</span>
            </button>
            <button onClick={() => { setSelectedMonth(defaultMonth); setSelectedRegional('ALL'); setSelectedCluster('ALL'); setSelectedUnit('ALL'); setSearchQuery(''); }} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 border border-slate-300 shadow-sm cursor-pointer">
              <i className="fa-solid fa-rotate-left text-xs"></i>
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-4 border-t border-slate-400/70">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Periode Tahun-Bulan</label>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-indigo-600" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Regional</label>
            <select value={selectedRegional} onChange={e => setSelectedRegional(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-indigo-600">
              <option value="ALL">Semua Regional</option>
              {regionalsList.map((r, i) => <option key={i} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cluster</label>
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-indigo-600">
              <option value="ALL">Semua Cluster</option>
              {clustersList.map((cl, i) => <option key={i} value={cl}>{cl}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Unit / GraPARI</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-indigo-600">
              <option value="ALL">Semua Unit</option>
              {unitsList.map((u, i) => <option key={i} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pencarian Cepat</label>
            <input type="text" placeholder="Cari NIK / MSISDN / Transaksi..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-indigo-600" />
          </div>
        </div>
      </div>

      {/* --- 3 CHARTS SECTION DI ATAS TABEL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Trend Line Perbandingan */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center">
            <i className="fa-solid fa-chart-line text-indigo-600 mr-2"></i> Tren Performa Sales & Retensi
          </h4>
          <div className="relative h-64 w-full">
            <canvas ref={trendChartRef}></canvas>
          </div>
        </div>

        {/* Chart 2: Doughnut Cross Selling */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center">
            <i className="fa-solid fa-chart-pie text-emerald-600 mr-2"></i> Rasio Cross-Up Selling
          </h4>
          <div className="relative h-64 w-full">
            <canvas ref={pieCrossChartRef}></canvas>
          </div>
        </div>

        {/* Chart 3: Doughnut Retensi */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center">
            <i className="fa-solid fa-chart-pie text-blue-600 mr-2"></i> Rasio Retensi
          </h4>
          <div className="relative h-64 w-full">
            <canvas ref={pieRetensiRef}></canvas>
          </div>
        </div>
      </div>

      {/* Tabel Utama Fokus Sales & Retensi */}
      <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Daftar Sample Sales & Retensi CSR</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Menampilkan data evaluasi penjualan dan retensi.</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Tombol Logo Excel (.xlsx) */}
            <button 
              onClick={handleDownloadExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition cursor-pointer"
              title="Download Excel (.xlsx)"
            >
              <i className="fa-solid fa-file-excel text-sm"></i>
              <span>Export Excel</span>
            </button>
            <span className="text-xs font-bold text-slate-600 bg-slate-200 px-3 py-1.5 rounded-xl">Total: {filteredTableData.length} Data</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-indigo-900 to-indigo-600 text-[11px] font-black text-white uppercase tracking-wider shadow-md">
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Unit / GraPARI</th>
                <th className="py-3.5 px-4">MSISDN / ID IH</th>
                <th className="py-3.5 px-4">Transaksi</th>
                <th className="py-3.5 px-4 text-center">Cross/Up Selling</th>
                <th className="py-3.5 px-4 text-center">Retensi</th>
                <th className="py-3.5 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800 bg-white">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 italic">Belum ada data sales & retensi yang tersimpan.</td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{row.tanggal}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nik}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nama}</td>
                    <td className="py-3.5 px-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200">{row.unit}</span></td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{row.msisdn || '-'}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{row.transaksi || '-'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${row.cross_upselling === 'Ya' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                        {row.cross_upselling || 'Tidak'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${row.retensi === 'Ya' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                        {row.retensi || 'Tidak'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={row.catatan}>{row.catatan || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-600 font-medium">Halaman {currentPage} dari {totalPages}</p>
          <div className="flex items-center space-x-2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40">Sebelumnya</button>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      </div>

      {/* --- MODAL INPUT SALES & RETENSI --- */}
      {showModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity duration-200 flex items-center justify-center z-[99999] p-4 ${isClosingModal ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={handleCloseModal}>
          <div className={`bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-300 transition-all duration-200 ${isClosingModal ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <h3 className="text-sm font-black tracking-tight">Form Input Sample</h3>
              </div>
              <button onClick={handleCloseModal} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tanggal Assessor / Input</label>
                <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600" required />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">NIK SIAD</label>
                <input 
                  type="text" 
                  value={formData.nik} 
                  onChange={e => {
                    setFormData({...formData, nik: e.target.value});
                    handleNikChange(e.target.value);
                  }} 
                  placeholder="Ketik NIK untuk auto-detect..." 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nama CSR (Auto)</label>
                  <input type="text" value={formData.nama} readOnly placeholder="Otomatis terisi..." className="w-full px-3.5 py-2.5 bg-slate-200/70 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Unit / GraPARI (Auto)</label>
                  <input type="text" value={formData.unit} readOnly placeholder="Otomatis terisi..." className="w-full px-3.5 py-2.5 bg-slate-200/70 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">MSISDN / ID IH</label>
                  <input type="text" value={formData.msisdn} onChange={e => setFormData({...formData, msisdn: e.target.value})} placeholder="Masukkan MSISDN / ID IH..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Transaksi</label>
                  <input type="text" value={formData.transaksi} onChange={e => setFormData({...formData, transaksi: e.target.value})} placeholder="Masukkan jenis/nomor transaksi..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cross / Up Selling</label>
                  <select value={formData.cross_upselling} onChange={e => setFormData({...formData, cross_upselling: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600">
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Retensi</label>
                  <select value={formData.retensi} onChange={e => setFormData({...formData, retensi: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600">
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Catatan</label>
                <textarea rows="3" value={formData.catatan} onChange={e => setFormData({...formData, catatan: e.target.value})} placeholder="Masukkan catatan atau keterangan tambahan..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600"></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">Batal</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODERN TOAST NOTIFICATION PORTAL --- */}
      {toast.show && ReactDOM.createPortal(
        <div className="fixed top-6 right-6 z-[999999] animate-[fadeIn_0.2s_ease-out_forwards]">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-slate-900 text-emerald-400 border-emerald-500/30 shadow-emerald-950/20' 
              : toast.type === 'error'
              ? 'bg-slate-900 text-rose-400 border-rose-500/30 shadow-rose-950/20'
              : 'bg-slate-900 text-amber-400 border-amber-500/30 shadow-amber-950/20'
          }`}>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm ${
              toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : toast.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : toast.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-exclamation'}`}></i>
            </div>
            <span className="tracking-wide text-white">{toast.message}</span>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}