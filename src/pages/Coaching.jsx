import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabase';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';

Chart.register(ChartDataLabels);

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzGef1rY95Af6g1iOtS5VONWusA-uCLZZmK8nGrgPHdVKscVPH15JH32RX7CQ4yV6wq2w/exec";

export default function Coaching() {
  const [coachList, setCoachList] = useState([]);
  const [csrDatabase, setCsrDatabase] = useState([]);
  
  const [filterPeriode, setFilterPeriode] = useState('');
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [regionsList, setRegionsList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);
  
  const [showRegMenu, setShowRegMenu] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  const [statusSortState, setStatusSortState] = useState('none');

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [showInputModal, setShowInputModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [toastInfo, setToastInfo] = useState({ show: false, title: '', msg: '', mode: 'success' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', msg: '', onConfirm: null });

  // Cek role pengguna aktif dari localStorage
  const rawRole = (localStorage.getItem('sqUserRole') || 'Viewer').trim().toUpperCase();
  const isViewer = rawRole === 'VIEWER';
  const isTeamLeader = rawRole === 'TEAM LEADER' || rawRole === 'TL';
  const isSQ = rawRole === 'SQ' || rawRole === 'SERVICE QUALITY';

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    nik: '', nama: '', region: '', cluster: '', unitName: '', job: '',
    tipe: 'Coaching', area: 'Attitude', rootCause: '', komitmen: '', file: null
  });

  const [editData, setEditData] = useState({
    id: '', tanggal: '', status: 'Open', nik: '', nama: '', region: '', cluster: '',
    unitName: '', job: '', tipe: 'Coaching', area: 'Attitude', rootCause: '', komitmen: '', linkEviden: '', file: null
  });

  const chartTypeRef = useRef(null);
  const chartStatusRef = useRef(null);
  const chartUnitsRef = useRef(null);
  const chartCsrRef = useRef(null);

  const typeInst = useRef(null);
  const statusInst = useRef(null);
  const unitsInst = useRef(null);
  const csrInst = useRef(null);

  const regDropdownRef = useRef(null);
  const unitDropdownRef = useRef(null);

  useEffect(() => {
    loadCoachData();
    const handleClickOutside = (event) => {
      if (regDropdownRef.current && !regDropdownRef.current.contains(event.target)) setShowRegMenu(false);
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target)) setShowUnitMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    updateCascadeUnits(filterRegion);
  }, [filterRegion, csrDatabase]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPeriode, filterRegion, filterUnit, searchQuery, statusSortState]);

  const showToast = (title, msg, mode = 'success') => {
    setToastInfo({ show: true, title, msg, mode });
    setTimeout(() => setToastInfo(prev => ({ ...prev, show: false })), 4000);
  };

  const loadCoachData = async () => {
    try {
      const { data: csrRes, error: csrErr } = await supabase.from('database_csr').select('*');
      if (csrErr) throw csrErr;
      const csrData = csrRes || [];
      setCsrDatabase(csrData);

      const allRegions = ['ALL', ...new Set(csrData.map(i => i.region).filter(Boolean))].sort();
      setRegionsList(allRegions.filter(r => r !== 'ALL'));

      let { data: coachRes, error: coachErr } = await supabase.from('database_coaching').select('*').order('tanggal', { ascending: false });
      if (coachErr) throw coachErr;
      let coachData = coachRes || [];

      const { data: tapRes, error: tapErr } = await supabase.from('nilai_tapping')
        .select('*')
        .gte('tanggal_assessor', '2026-09-01')
        .lt('total_nilai', 85);

      if (!tapErr && tapRes && tapRes.length > 0) {
        const missingCoaching = [];
        tapRes.forEach(tap => {
          const tglTap = typeof tap.tanggal_assessor === 'string' ? tap.tanggal_assessor.substring(0, 10) : '';
          const exist = coachData.find(c => (c.nik_csr === tap.nik_csr || c.nik === tap.nik_csr) && c.tanggal === tglTap);
          
          if (!exist && tglTap && tap.nik_csr) {
            missingCoaching.push({
              tanggal: tglTap,
              nik_csr: tap.nik_csr,
              nama_csr: tap.nama_csr,
              region: tap.regional || '-',
              unit_name: tap.unit_name || '-',
              tipe: 'Coaching',
              jenis_temuan: 'Tapping UnderTarget (<85%)',
              status: 'Open',
              root_cause: '',
              komitmen: '',
              link_eviden: ''
            });
          }
        });

        if (missingCoaching.length > 0) {
          const { error: insertErr } = await supabase.from('database_coaching').insert(missingCoaching);
          if (!insertErr) {
            const { data: reloadedCoach } = await supabase.from('database_coaching').select('*').order('tanggal', { ascending: false });
            coachData = reloadedCoach || [];
          }
        }
      }

      const formatted = coachData.map(row => {
        const nik = String(row.nik || row.nik_csr || '').trim();
        const found = csrData.find(c => String(c.nik || c.nik_csr || '').trim() === nik);
        return {
          ...row,
          nik,
          nama: row.nama || row.nama_csr || found?.nama || found?.nama_csr || '-',
          region: row.region || found?.region || '-',
          cluster: row.cluster || found?.cluster || '-',
          unitName: row.unitName || row.unit_name || found?.unitName || found?.unit_name || '-',
          job: row.job || found?.job || '-',
          tipe: row.tipe || 'Coaching',
          area: row.area || row.jenis_temuan || '-',
          status: row.status || 'Open',
          fileUrl: row.fileUrl || row.file_url || row.link_eviden || ''
        };
      });

      setCoachList(formatted);
    } catch (err) {
      console.error(err);
      showToast("Gagal Memuat", err.message, 'error');
    }
  };

  const updateCascadeUnits = (reg) => {
    let filtered = csrDatabase;
    if (reg !== 'ALL') {
      filtered = csrDatabase.filter(i => i.region === reg);
    }
    const units = [...new Set(filtered.map(i => i.unitName || i.unit_name).filter(Boolean))].sort();
    setUnitsList(units);
    if (!units.includes(filterUnit) && filterUnit !== 'ALL') {
      setFilterUnit('ALL');
    }
  };

  const uploadFileToDrive = async (fileObj) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileObj);
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          const res = await fetch(GAS_WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ fileName: fileObj.name, mimeType: fileObj.type, base64 })
          });
          const result = await res.json();
          if (result.status === "success") resolve(result.url);
          else reject(new Error(result.message || "Gagal upload"));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = err => reject(err);
    });
  };

  const deleteFileFromDrive = async (url) => {
    if (!url) return;
    const match = url.match(/[-\w]{25,}/);
    if (!match) return;
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete", fileId: match[0] })
      });
    } catch (err) {
      console.error("Gagal hapus file dari Drive", err);
    }
  };

  const handleAutoFill = (nikVal) => {
    const clean = nikVal.trim();
    const found = csrDatabase.find(i => String(i.nik || i.nik_csr || '').trim() === clean);
    if (found) {
      setFormData(prev => ({
        ...prev,
        nik: clean,
        nama: found.nama || found.nama_csr || '',
        region: found.region || '',
        cluster: found.cluster || '',
        unitName: found.unitName || found.unit_name || '',
        job: found.job || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, nik: clean, nama: '', region: '', cluster: '', unitName: '', job: '' }));
    }
  };

  const handleInputSubmit = async (e) => {
    e.preventDefault();
    if (isViewer) {
      showToast("Akses Ditolak", "Akun Viewer hanya dapat melihat data (Read-Only).", 'error');
      return;
    }
    if (!formData.nik || !formData.nama) {
      showToast("Kolom Wajib!", "Harap isi NIK dan Nama CSR.", 'warning');
      return;
    }

    try {
      let fileUrl = '';
      if (formData.file) {
        fileUrl = await uploadFileToDrive(formData.file);
      }

      const payload = {
        tanggal: formData.tanggal,
        nik_csr: formData.nik,
        nama_csr: formData.nama,
        region: formData.region,
        cluster: formData.cluster,
        unit_name: formData.unitName,
        job: formData.job,
        tipe: formData.tipe,
        jenis_temuan: formData.area,
        root_cause: formData.rootCause,
        komitmen: formData.komitmen,
        link_eviden: fileUrl,
        status: 'Open'
      };

      const { error } = await supabase.from('database_coaching').insert([payload]);
      if (error) throw error;

      setShowInputModal(false);
      setFormData({
        tanggal: new Date().toISOString().slice(0, 10),
        nik: '', nama: '', region: '', cluster: '', unitName: '', job: '',
        tipe: 'Coaching', area: 'Attitude', rootCause: '', komitmen: '', file: null
      });
      loadCoachData();
      showToast("Sukses!", "Data coaching berhasil disimpan!", 'success');
    } catch (err) {
      showToast("Gagal!", err.message, 'error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (isViewer) {
      showToast("Akses Ditolak", "Akun Viewer tidak diizinkan mengubah data.", 'error');
      return;
    }

    try {
      let fileUrl = editData.linkEviden;
      if (editData.file) {
        fileUrl = await uploadFileToDrive(editData.file);
      }

      const payload = {
        tanggal: editData.tanggal,
        nik_csr: editData.nik,
        nama_csr: editData.nama,
        region: editData.region,
        cluster: editData.cluster,
        unit_name: editData.unitName,
        job: editData.job,
        tipe: editData.tipe,
        jenis_temuan: editData.area,
        root_cause: editData.rootCause,
        komitmen: editData.komitmen,
        status: editData.status,
        link_eviden: fileUrl
      };

      const { error } = await supabase.from('database_coaching').update(payload).eq('id', editData.id);
      if (error) throw error;

      setShowEditModal(false);
      loadCoachData();
      showToast("Sukses!", "Data berhasil diperbarui!", 'success');
    } catch (err) {
      showToast("Gagal!", err.message, 'error');
    }
  };

  const handleDeleteRecord = (targetRow = null) => {
    if (isViewer) {
      showToast("Akses Ditolak", "Akun Viewer tidak diizinkan menghapus data.", 'error');
      return;
    }
    if (isTeamLeader) {
      showToast("Akses Ditolak", "Fitur hapus data hanya dapat diakses oleh akun dengan role Service Quality (SQ).", 'error');
      return;
    }

    const rowToDelete = targetRow || editData;
    if (!rowToDelete.id) {
      showToast("Error", "ID Data tidak valid.", 'error');
      return;
    }

    setConfirmModal({
      show: true,
      title: "Hapus Data Coaching",
      msg: "Apakah Anda yakin ingin menghapus data ini dari database?",
      onConfirm: async () => {
        try {
          if (rowToDelete.fileUrl || rowToDelete.link_eviden) {
            await deleteFileFromDrive(rowToDelete.fileUrl || rowToDelete.link_eviden);
          }
          
          const { error } = await supabase
            .from('database_coaching')
            .delete()
            .eq('id', rowToDelete.id);

          if (error) throw error;
          
          setShowEditModal(false);
          loadCoachData();
          showToast("Terhapus!", "Data berhasil dihapus secara permanen.", 'success');
        } catch (err) {
          showToast("Gagal Hapus!", err.message, 'error');
        }
      }
    });
  };

  const handleSortClick = () => {
    if (statusSortState === 'none') setStatusSortState('asc');
    else if (statusSortState === 'asc') setStatusSortState('desc');
    else setStatusSortState('none');
  };

  let filteredList = coachList.filter(row => {
    const matchPeriode = !filterPeriode || (row.tanggal && row.tanggal.startsWith(filterPeriode));
    const matchRegion = filterRegion === 'ALL' || row.region === filterRegion;
    const matchUnit = filterUnit === 'ALL' || row.unitName === filterUnit;
    const matchSearch = !searchQuery || (row.nama?.toLowerCase().includes(searchQuery.toLowerCase()) || row.nik?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchPeriode && matchRegion && matchUnit && matchSearch;
  });

  if (statusSortState === 'asc') {
    filteredList.sort((a, b) => (a.status || 'Open').localeCompare(b.status || 'Open'));
  } else if (statusSortState === 'desc') {
    filteredList.sort((a, b) => (b.status || 'Open').localeCompare(a.status || 'Open'));
  }

  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTableData = filteredList.slice(indexOfFirstItem, indexOfLastItem);

  const totalSesi = filteredList.length;
  const coachingCount = filteredList.filter(i => i.tipe === 'Coaching').length;
  const counselingCount = filteredList.filter(i => i.tipe === 'Counseling').length;
  
  const areaCounts = {};
  filteredList.forEach(i => { if (i.area && i.area !== '-') areaCounts[i.area] = (areaCounts[i.area] || 0) + 1; });
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  const closedCount = filteredList.filter(i => (i.status || '').trim().toLowerCase() === 'closed').length;
  const closedRate = totalSesi > 0 ? ((closedCount / totalSesi) * 100).toFixed(1) + '%' : '0%';

  useEffect(() => {
    if (chartTypeRef.current) {
      if (typeInst.current) typeInst.current.destroy();
      typeInst.current = new Chart(chartTypeRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Coaching', 'Counseling'],
          datasets: [{ data: [coachingCount, counselingCount], backgroundColor: ['#4F46E5', '#C026D3'], borderWidth: 3, borderColor: '#ffffff', hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold' } } }, datalabels: { color: '#1E293B', font: { weight: 'bold', size: 11 }, formatter: v => v > 0 ? v : '' } } },
        plugins: [ChartDataLabels]
      });
    }

    let openTotal = totalSesi - closedCount;
    if (chartStatusRef.current) {
      if (statusInst.current) statusInst.current.destroy();
      statusInst.current = new Chart(chartStatusRef.current, {
        type: 'bar',
        data: {
          labels: ['Selesai (Closed)', 'Belum (Open)'],
          datasets: [{ label: 'Jumlah Sesi', data: [closedCount, openTotal], backgroundColor: ['#059669', '#D97706'], borderRadius: 12, barPercentage: 0.45 }]
        },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#334155', font: { weight: 'bold', size: 11 }, formatter: v => v } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }, y: { display: false } } },
        plugins: [ChartDataLabels]
      });
    }

    const unitCounts = {};
    filteredList.forEach(i => { unitCounts[i.unitName || 'Lainnya'] = (unitCounts[i.unitName || 'Lainnya'] || 0) + 1; });
    const sortedUnits = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (chartUnitsRef.current) {
      if (unitsInst.current) unitsInst.current.destroy();
      const ctx = chartUnitsRef.current.getContext('2d');
      const gradUnits = ctx.createLinearGradient(0, 0, 400, 0);
      gradUnits.addColorStop(0, '#D97706');
      gradUnits.addColorStop(1, '#FBBF24');

      unitsInst.current = new Chart(chartUnitsRef.current, {
        type: 'bar',
        data: {
          labels: sortedUnits.length ? sortedUnits.map(i => i[0]) : ['Tidak ada data'],
          datasets: [{ data: sortedUnits.length ? sortedUnits.map(i => i[1]) : [0], backgroundColor: gradUnits, borderRadius: 8, barPercentage: 0.6 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 35 } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#B45309', font: { weight: 'bold', size: 11 }, formatter: v => v } }, scales: { x: { display: false, grid: { display: false } }, y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 } } } } },
        plugins: [ChartDataLabels]
      });
    }

    const csrCounts = {};
    filteredList.forEach(i => { csrCounts[i.nama || 'Tanpa Nama'] = (csrCounts[i.nama || 'Tanpa Nama'] || 0) + 1; });
    const sortedCsr = Object.entries(csrCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (chartCsrRef.current) {
      if (csrInst.current) csrInst.current.destroy();
      const ctx = chartCsrRef.current.getContext('2d');
      const gradCsr = ctx.createLinearGradient(0, 0, 400, 0);
      gradCsr.addColorStop(0, '#059669');
      gradCsr.addColorStop(1, '#34D399');

      csrInst.current = new Chart(chartCsrRef.current, {
        type: 'bar',
        data: {
          labels: sortedCsr.length ? sortedCsr.map(i => i[0]) : ['Tidak ada data'],
          datasets: [{ data: sortedCsr.length ? sortedCsr.map(i => i[1]) : [0], backgroundColor: gradCsr, borderRadius: 8, barPercentage: 0.6 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 35 } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#047857', font: { weight: 'bold', size: 11 }, formatter: v => v } }, scales: { x: { display: false, grid: { display: false } }, y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 } } } } },
        plugins: [ChartDataLabels]
      });
    }
  }, [filteredList]);

  const exportExcel = () => {
    const table = document.getElementById("coachTableElement");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Data_Coaching" });
    XLSX.writeFile(wb, "Data_Coaching_Lensa.xlsx");
  };

  return (
    <div className="space-y-6 font-sans relative">
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-[0_15px_35px_-5px_rgba(100,116,139,0.35)] border border-slate-400/80 space-y-4 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold border border-indigo-200 shadow-sm">
              <i className="fa-solid fa-comments"></i>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Data Coaching & Counseling CSR</h3>
              <p className="text-xs text-slate-700 font-medium">Monitoring pembinaan, evaluasi temuan, dan komitmen perbaikan CSR</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button onClick={() => { setFilterPeriode(''); setFilterRegion('ALL'); setFilterUnit('ALL'); setSearchQuery(''); setStatusSortState('none'); }} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer backdrop-blur-md">
              <i className="fa-solid fa-rotate-left text-xs"></i>
              <span>Reset Filter</span>
            </button>
            <button onClick={loadCoachData} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer backdrop-blur-md">
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-slate-400/70 relative z-40">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Periode (Tahun - Bulan)</label>
            <input type="month" value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:border-purple-600 cursor-pointer" />
          </div>

          <div className="relative" ref={regDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Region</label>
            <div onClick={() => { setShowRegMenu(!showRegMenu); setShowUnitMenu(false); }} className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-sm flex items-center justify-between cursor-pointer transition select-none">
              <div className="flex items-center space-x-2 truncate">
                <i className="fa-solid fa-map-location-dot text-slate-400"></i>
                <span>{filterRegion === 'ALL' ? 'Semua Region' : filterRegion}</span>
              </div>
              <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
            </div>
            {showRegMenu && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-3 space-y-2 z-50">
                <div className="relative">
                  <input type="text" value={regSearchQuery} onChange={e => setRegSearchQuery(e.target.value)} placeholder="Cari Region..." className="w-full px-3.5 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 transition" />
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-[10px] text-slate-400"></i>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  <div onClick={() => { setFilterRegion('ALL'); setShowRegMenu(false); }} className={`px-3 py-2 rounded-xl cursor-pointer transition text-xs ${filterRegion === 'ALL' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}>Semua Region</div>
                  {regionsList.filter(r => r.toLowerCase().includes(regSearchQuery.toLowerCase())).map((r, i) => (
                    <div key={i} onClick={() => { setFilterRegion(r); setShowRegMenu(false); }} className={`px-3 py-2 rounded-xl cursor-pointer transition text-xs ${filterRegion === r ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}>{r}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={unitDropdownRef}>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Unit Name</label>
            <div onClick={() => { setShowUnitMenu(!showUnitMenu); setShowRegMenu(false); }} className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-sm flex items-center justify-between cursor-pointer transition select-none">
              <div className="flex items-center space-x-2 truncate">
                <i className="fa-solid fa-building text-slate-400"></i>
                <span>{filterUnit === 'ALL' ? 'Semua Unit Name' : filterUnit}</span>
              </div>
              <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
            </div>
            {showUnitMenu && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-3 space-y-2 z-50">
                <div className="relative">
                  <input type="text" value={unitSearchQuery} onChange={e => setUnitSearchQuery(e.target.value)} placeholder="Cari Unit Name..." className="w-full px-3.5 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 transition" />
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-[10px] text-slate-400"></i>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  <div onClick={() => { setFilterUnit('ALL'); setShowUnitMenu(false); }} className={`px-3 py-2 rounded-xl cursor-pointer transition text-xs ${filterUnit === 'ALL' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}>Semua Unit Name</div>
                  {unitsList.filter(u => u.toLowerCase().includes(unitSearchQuery.toLowerCase())).map((u, i) => (
                    <div key={i} onClick={() => { setFilterUnit(u); setShowUnitMenu(false); }} className={`px-3 py-2 rounded-xl cursor-pointer transition text-xs ${filterUnit === u ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}>{u}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pencarian CSR</label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-[11px] text-slate-500 text-xs"></i>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari Nama / NIK CSR..." className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-inner focus:outline-none focus:border-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-900 p-5 rounded-3xl border border-indigo-500 shadow-[0_12px_25px_-5px_rgba(79,70,229,0.4)] flex items-center justify-between text-white">
          <div><p className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Total Sesi Pembinaan</p><h4 className="text-3xl font-black mt-1 text-white drop-shadow-md">{totalSesi}</h4></div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-users-rays"></i></div>
        </div>
        <div className="relative bg-gradient-to-br from-fuchsia-600 to-purple-950 p-5 rounded-3xl border border-fuchsia-500 shadow-[0_12px_25px_-5px_rgba(217,70,239,0.4)] flex items-center justify-between text-white">
          <div><p className="text-[11px] font-black uppercase tracking-wider text-fuchsia-200">Coach vs Counsel</p><h4 className="text-3xl font-black mt-1 text-white drop-shadow-md">{coachingCount} / {counselingCount}</h4></div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-scale-balanced"></i></div>
        </div>
        <div className="relative bg-gradient-to-br from-amber-500 to-orange-800 p-5 rounded-3xl border border-amber-400 shadow-[0_12px_25px_-5px_rgba(245,158,11,0.4)] flex items-center justify-between text-white">
          <div><p className="text-[11px] font-black uppercase tracking-wider text-amber-100">Top Kategori Pembinaan</p><h4 className="text-lg font-black mt-1 text-white drop-shadow-md truncate w-36">{topArea}</h4></div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-triangle-exclamation"></i></div>
        </div>
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-950 p-5 rounded-3xl border border-emerald-500 shadow-[0_12px_25px_-5px_rgba(16,185,129,0.4)] flex items-center justify-between text-white">
          <div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-200">Closed Rate</p><h4 className="text-3xl font-black mt-1 text-white drop-shadow-md">{closedRate}</h4></div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-check-double"></i></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <h4 className="text-sm font-extrabold text-slate-900 mb-4"><i className="fa-solid fa-chart-pie text-indigo-600 mr-2"></i> Proporsi Tipe Pembinaan</h4>
          <div className="relative h-64"><canvas ref={chartTypeRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <h4 className="text-sm font-extrabold text-slate-900 mb-4"><i className="fa-solid fa-chart-bar text-indigo-600 mr-2"></i> Status Penyelesaian (Open vs Closed)</h4>
          <div className="relative h-64"><canvas ref={chartStatusRef}></canvas></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <h4 className="text-sm font-extrabold text-slate-900 mb-4"><i className="fa-solid fa-ranking-star text-amber-600 mr-2"></i> Top 5 Pembinaan GraPARI</h4>
          <div className="relative h-64"><canvas ref={chartUnitsRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <h4 className="text-sm font-extrabold text-slate-900 mb-4"><i className="fa-solid fa-user-check text-emerald-600 mr-2"></i> Top 5 Pembinaan CSR</h4>
          <div className="relative h-64"><canvas ref={chartCsrRef}></canvas></div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-table-list text-indigo-600"></i>
            <h3 className="text-base font-bold text-slate-900">Database History Coaching & Counseling</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={exportExcel} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center space-x-2 border border-emerald-200 shadow-sm cursor-pointer">
              <i className="fa-solid fa-file-excel"></i>
              <span>Unduh Excel</span>
            </button>
            <button onClick={() => {
              if (isViewer) {
                showToast("Akses Ditolak", "Akun Viewer hanya dapat melihat data (Read-Only).", "warning");
                return;
              }
              setShowInputModal(true);
            }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md shadow-indigo-600/30 cursor-pointer">
              <i className="fa-solid fa-plus"></i>
              <span>Input Coaching</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-300 shadow-sm bg-white">
          <table id="coachTableElement" className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                <th className="py-4 px-4 first:rounded-l-2xl text-left">Tanggal</th>
                <th className="py-4 px-4 text-left">Region</th>
                <th className="py-4 px-4 text-left">Cluster</th>
                <th className="py-4 px-4 text-left">Unit Name</th>
                <th className="py-4 px-4 text-left">Nama CSR</th>
                <th className="py-4 px-4 text-left">NIK CSR</th>
                <th className="py-4 px-4 text-left">Job</th>
                <th className="py-4 px-4 text-left">Tipe</th>
                <th className="py-4 px-4 text-left">Jenis Temuan</th>
                <th className="py-4 px-4 text-center cursor-pointer select-none hover:bg-white/10 transition" onClick={handleSortClick} title="Klik untuk mengurutkan berdasarkan Status">
                  <div className="inline-flex items-center justify-center space-x-1.5">
                    <span>Status</span>
                    {statusSortState === 'asc' ? <i className="fa-solid fa-caret-up text-xs text-amber-400"></i> : 
                     statusSortState === 'desc' ? <i className="fa-solid fa-caret-down text-xs text-emerald-400"></i> : 
                     <i className="fa-solid fa-sort text-[10px] text-slate-400"></i>}
                  </div>
                </th>
                <th className="py-4 px-4 text-center">Link Eviden</th>
                <th className="py-4 px-4 text-center last:rounded-r-2xl">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs font-medium text-slate-800">
              {currentTableData.length === 0 ? (
                <tr><td colSpan="12" className="py-8 text-center text-slate-500 italic">Belum ada data coaching tersimpan atau sesuai filter.</td></tr>
              ) : (
                currentTableData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-all duration-200 group">
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.tanggal || '-'}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.region || '-'}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.cluster || '-'}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.unitName || '-'}</td>
                    <td className="py-4 px-4 font-extrabold text-slate-900 text-left">{row.nama || '-'}</td>
                    <td className="py-4 px-4 font-bold text-slate-800 tracking-wide text-left">{row.nik || '-'}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.job || '-'}</td>
                    <td className="py-4 px-4 text-left">
                      <span className={`px-2.5 py-1 ${row.tipe === 'Counseling' ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'} rounded-xl text-[10px] font-black tracking-wide shadow-sm`}>
                        {row.tipe || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-left">{row.area || '-'}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase shadow-sm ${row.status === 'Closed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {row.status || 'Open'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {row.fileUrl ? (
                        <a href={row.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-extrabold transition shadow-sm border border-indigo-100">
                          <i className="fa-solid fa-file"></i><span>Buka File</span>
                        </a>
                      ) : <span className="text-slate-400 italic text-[10px] font-medium">Tidak ada</span>}
                    </td>
                    <td className="py-4 px-4 text-left">
                      <div className="flex items-center justify-start space-x-1.5">
                        <button onClick={() => { setSelectedRecord(row); setShowViewModal(true); }} title="Lihat Detail" className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition border border-red-200 shadow-sm cursor-pointer">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        
                        <button onClick={() => {
                          if (isViewer) {
                            showToast("Akses Ditolak", "Akun Viewer hanya dapat melihat data (Read-Only).", "warning");
                            return;
                          }
                          setEditData({
                            id: row.id, 
                            tanggal: row.tanggal || '', 
                            status: row.status || 'Open',
                            nik: row.nik || '', 
                            nama: row.nama || '', 
                            region: row.region || '', 
                            cluster: row.cluster || '',
                            unitName: row.unitName || '', 
                            job: row.job || '', 
                            tipe: row.tipe || 'Coaching',
                            area: row.area || 'Attitude', 
                            rootCause: row.rootCause || row.root_cause || '', 
                            komitmen: row.actionPlan || row.komitmen || '', 
                            linkEviden: row.fileUrl || '', 
                            file: null
                          });
                          setShowEditModal(true);
                        }} title="Update Data" className="px-3 py-1.5 bg-white hover:bg-amber-500 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm border border-slate-300 cursor-pointer flex items-center">
                          <i className="fa-solid fa-pen-to-square mr-1"></i> Update
                        </button>

                        <button onClick={() => {
                          if (isViewer) {
                            showToast("Akses Ditolak", "Akun Viewer tidak diizinkan menghapus data.", "warning");
                            return;
                          }
                          if (isTeamLeader) {
                            showToast("Akses Ditolak", "Fitur hapus data hanya dapat diakses oleh akun dengan role Service Quality (SQ).", "warning");
                            return;
                          }
                          handleDeleteRecord(row);
                        }} title="Hapus Langsung" className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs transition border border-rose-200 shadow-sm cursor-pointer">
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 px-2 text-xs font-semibold text-slate-600">
            <div>
              Menampilkan <span className="font-bold text-slate-900">{indexOfFirstItem + 1}</span> sampai <span className="font-bold text-slate-900">{Math.min(indexOfLastItem, totalItems)}</span> dari <span className="font-bold text-slate-900">{totalItems}</span> total data
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1} 
                className={`px-3.5 py-2 rounded-xl border border-slate-300 bg-white shadow-sm transition flex items-center space-x-1 ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer text-slate-800'}`}>
                <i className="fa-solid fa-chevron-left text-[10px]"></i>
                <span>Sebelumnya</span>
              </button>
              
              <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl font-black">
                Halaman {currentPage} dari {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages} 
                className={`px-3.5 py-2 rounded-xl border border-slate-300 bg-white shadow-sm transition flex items-center space-x-1 ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer text-slate-800'}`}>
                <span>Selanjutnya</span>
                <i className="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
        )}

      </div>

      {showInputModal && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Form Input Sesi Coaching & Counseling</h3>
              <button onClick={() => setShowInputModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer transition">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleInputSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIK CSR (Auto-Fill)</label>
                  <input type="text" value={formData.nik} onChange={e => handleAutoFill(e.target.value)} placeholder="Masukkan NIK..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama CSR</label>
                  <input type="text" value={formData.nama} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Region</label>
                  <input type="text" value={formData.region} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cluster</label>
                  <input type="text" value={formData.cluster} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Name</label>
                  <input type="text" value={formData.unitName} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Job Role</label>
                  <input type="text" value={formData.job} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Pembinaan</label>
                  <select value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                    <option value="Coaching">Coaching</option>
                    <option value="Counseling">Counseling</option>
                    <option value="Surat Peringatan">Surat Peringatan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Temuan / Area</label>
                  <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                    <option value="Attitude">Attitude</option>
                    <option value="Skill">Skill</option>
                    <option value="Knowledge">Knowledge</option>
                    <option value="Tapping UnderTarget (<85%)">Tapping UnderTarget (&lt;85%)</option>
                    <option value="Pelanggaran SOP / Fraud">Pelanggaran SOP / Fraud</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Akar Masalah (Root Cause)</label>
                <textarea rows="2" value={formData.rootCause} onChange={e => setFormData({...formData, rootCause: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="Tuliskan akar masalah..."></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Komitmen / Action Plan</label>
                <textarea rows="2" value={formData.komitmen} onChange={e => setFormData({...formData, komitmen: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="Tuliskan komitmen perbaikan..."></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lampiran Eviden (File)</label>
                <input type="file" onChange={e => setFormData({...formData, file: e.target.files[0]})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition cursor-pointer" />
              </div>
              <div className="pt-4 border-t flex justify-end space-x-2">
                <button type="button" onClick={() => setShowInputModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition">Batal</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md transition">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEditModal && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Update Data Coaching & Counseling</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer transition">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={editData.tanggal} onChange={e => setEditData({...editData, tanggal: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Penyelesaian</label>
                  <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none transition cursor-pointer font-extrabold ${editData.status === 'Closed' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIK CSR</label>
                  <input type="text" value={editData.nik} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama CSR</label>
                  <input type="text" value={editData.nama} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-semibold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Pembinaan</label>
                  <select value={editData.tipe} onChange={e => setEditData({...editData, tipe: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                    <option value="Coaching">Coaching</option>
                    <option value="Counseling">Counseling</option>
                    <option value="Surat Peringatan">Surat Peringatan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Temuan / Area</label>
                  <select value={editData.area} onChange={e => setEditData({...editData, area: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                    <option value="Attitude">Attitude</option>
                    <option value="Skill">Skill</option>
                    <option value="Knowledge">Knowledge</option>
                    <option value="Tapping UnderTarget (<85%)">Tapping UnderTarget (&lt;85%)</option>
                    <option value="Pelanggaran SOP / Fraud">Pelanggaran SOP / Fraud</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Akar Masalah (Root Cause)</label>
                <textarea rows="2" value={editData.rootCause} onChange={e => setEditData({...editData, rootCause: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition"></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Komitmen / Action Plan</label>
                <textarea rows="2" value={editData.komitmen} onChange={e => setEditData({...editData, komitmen: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition"></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lampiran Eviden Baru (Opsional)</label>
                <input type="file" onChange={e => setEditData({...editData, file: e.target.files[0]})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition cursor-pointer" />
                {editData.linkEviden && (
                  <p className="text-[10px] mt-1.5 text-slate-600 font-medium">Status Eviden: <a href={editData.linkEviden} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">File Tersimpan (Klik untuk melihat)</a></p>
                )}
              </div>
              <div className="pt-4 border-t flex items-center justify-between">
                <button type="button" onClick={() => handleDeleteRecord(editData)} className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl font-bold cursor-pointer transition flex items-center space-x-1.5">
                  <i className="fa-solid fa-trash-can"></i><span>Hapus Data</span>
                </button>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition">Batal</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md transition">Simpan Perubahan</button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showViewModal && selectedRecord && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between relative shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shadow-sm">
                  <i className="fa-solid fa-file-lines"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Detail Sesi Pembinaan</h3>
                  <p className="text-[10px] font-semibold text-slate-500">Melihat rincian dan root cause CSR</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer transition">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">TANGGAL</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.tanggal}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-1">STATUS</span>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${selectedRecord.status === 'Closed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                    {selectedRecord.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">NAMA CSR</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.nama}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">NIK</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.nik}</strong>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">REGION / CLUSTER</span>
                  <strong className="text-slate-800 text-[11px] block">{selectedRecord.region}</strong>
                  <span className="text-slate-500 text-[10px] font-medium">{selectedRecord.cluster}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">UNIT NAME</span>
                  <strong className="text-slate-800 text-[11px]">{selectedRecord.unitName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">TIPE PEMBINAAN</span>
                  <strong className="text-slate-800 text-[11px]">{selectedRecord.tipe}</strong>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
                <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-1">AKAR MASALAH (ROOT CAUSE)</span>
                <p className="text-slate-700 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {selectedRecord.rootCause || selectedRecord.root_cause || 'Belum diisi'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
                <span className="text-slate-400 font-extrabold block text-[9px] uppercase tracking-wider mb-1">KOMITMEN / ACTION PLAN</span>
                <p className="text-slate-700 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {selectedRecord.actionPlan || selectedRecord.komitmen || 'Belum diisi'}
                </p>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-extrabold block text-[9px] uppercase tracking-wider mb-0.5">LAMPIRAN EVIDEN</span>
                  <span className="text-indigo-900 font-bold text-xs">{selectedRecord.fileUrl ? 'Tersedia tautan dokumen' : 'Tidak ada tautan eviden'}</span>
                </div>
                {selectedRecord.fileUrl ? (
                  <a href={selectedRecord.fileUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-sm">
                    <i className="fa-solid fa-file text-xs"></i> Buka Eviden
                  </a>
                ) : (
                  <span className="text-xs text-indigo-400 italic font-medium bg-white px-3 py-1 rounded-lg border border-indigo-200">Kosong</span>
                )}
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shadow-inner">
              <button onClick={() => setShowViewModal(false)} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-md">Tutup Detail</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toastInfo.show && ReactDOM.createPortal(
        <div className="fixed bottom-6 right-6 z-[9999999] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3.5 animate-[fadeIn_0.2s_ease-out]">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner ${toastInfo.mode === 'error' ? 'bg-rose-500' : toastInfo.mode === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
            {toastInfo.mode === 'error' ? <i className="fa-solid fa-xmark"></i> : toastInfo.mode === 'warning' ? <i className="fa-solid fa-triangle-exclamation"></i> : <i className="fa-solid fa-check"></i>}
          </div>
          <div>
            <h5 className="text-sm font-black tracking-tight">{toastInfo.title}</h5>
            <p className="text-xs text-slate-300 font-medium mt-0.5">{toastInfo.msg}</p>
          </div>
        </div>,
        document.body
      )}

      {confirmModal.show && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-xs text-center border border-slate-200 animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2 shadow-inner">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h4 className="font-black text-base text-slate-900">{confirmModal.title}</h4>
            <p className="text-slate-600 font-medium text-sm px-2">{confirmModal.msg}</p>
            <div className="flex justify-center space-x-3 pt-4">
              <button onClick={() => setConfirmModal({ show: false })} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition">Batal</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ show: false }); }} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-md transition">Ya, Hapus</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.92) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}