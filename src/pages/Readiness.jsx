import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabase';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';

Chart.register(ChartDataLabels);

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzGef1rY95Af6g1iOtS5VONWusA-uCLZZmK8nGrgPHdVKscVPH15JH32RX7CQ4yV6wq2w/exec";

export default function Readiness() {
  // State Global & Filter
  const [globalReadinessData, setGlobalReadinessData] = useState([]);
  const [masterUnitObjectsList, setMasterUnitObjectsList] = useState([]);
  const [masterUnitList, setMasterUnitList] = useState([]);
  const [unportedUnitsList, setUnportedUnitsList] = useState([]);

  // State untuk melacak baris catatan khusus mana saja yang sedang di-expand
  const [expandedNotes, setExpandedNotes] = useState({});

  // State untuk Pagination Tabel
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [filterStartDate, setFilterStartDate] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [filterEndDate, setFilterEndDate] = useState(today.toISOString().slice(0, 10));
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [searchReadiness, setSearchReadiness] = useState('');
  const [availableRegions, setAvailableRegions] = useState([]);

  // State KPI & Tabel
  const [cardFindings, setCardFindings] = useState(0);
  const [cardTopIssue, setCardTopIssue] = useState('-');
  const [cardCompliance, setCardCompliance] = useState('0%');
  const [cardComplianceSub, setCardComplianceSub] = useState('dari 0 Unit Ceklis');
  const [cardMissing, setCardMissing] = useState(0);
  const [manualTableData, setManualTableData] = useState([]);

  // State Modal Visibility
  const [showManualModal, setShowManualModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // State Animasi Close (Fade Out Trigger)
  const [isClosing, setIsClosing] = useState(false);

  // State Form / Selected Record
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', msg: '', onConfirm: null });
  
  // State Input Manual
  const [inputDate, setInputDate] = useState(today.toISOString().slice(0, 10));
  const [inputNik, setInputNik] = useState('');
  const [inputNama, setInputNama] = useState('');
  const [inputRegion, setInputRegion] = useState('');
  const [inputCluster, setInputCluster] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [inputJob, setInputJob] = useState('');
  const [inputTipe, setInputTipe] = useState('Coaching');
  const [inputArea, setInputArea] = useState('Attitude');
  const [inputRootCause, setInputRootCause] = useState('');
  const [inputKomitmen, setInputKomitmen] = useState('');
  const [inputFile, setInputFile] = useState(null);

  // State Edit
  const [editId, setEditId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editKategori, setEditKategori] = useState('-');
  const [editCatatan, setEditCatatan] = useState('');
  const [editEviden, setEditEviden] = useState('');

  // State Toast Notification
  const [toast, setToast] = useState({ show: false, title: '', msg: '', type: 'success' });
  const [excelFileName, setExcelFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Mapping Excel Settings
  const [mapTanggal, setMapTanggal] = useState('Date');
  const [mapUnit, setMapUnit] = useState('Unit Name');

  // Chart Refs
  const trendChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const regionalChartRef = useRef(null);
  const topUnitChartRef = useRef(null);
  
  const chartTrendInstance = useRef(null);
  const chartCategoryInstance = useRef(null);
  const chartRegionalInstance = useRef(null);
  const chartTopUnitInstance = useRef(null);

  useEffect(() => {
    loadReadinessData();
  }, []);

  useEffect(() => {
    applyReadinessFilter();
  }, [globalReadinessData, filterStartDate, filterEndDate, filterRegion, filterSource, searchReadiness, masterUnitList]);

  // Reset halaman ke 1 setiap kali filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, filterRegion, filterSource, searchReadiness]);

  // Helper untuk menutup modal secara smooth dengan animasi fade-out
  const closeModalWithAnimation = (closeSetter) => {
    setIsClosing(true);
    setTimeout(() => {
      closeSetter(false);
      setIsClosing(false);
    }, 200);
  };

  // Toast Handler
  const showReadinessToast = (title, msg, type = 'success') => {
    setToast({ show: true, title, msg, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const checkUserIsSqRole = () => {
    let rawRole = localStorage.getItem('sqUserRole') || 'Viewer';
    return rawRole.trim().toUpperCase() === 'SQ';
  };

  const handleProtectedAction = (actionType) => {
    if (!checkUserIsSqRole()) {
      showReadinessToast("Akses Terbatas (Read-Only)", "Fitur ini hanya dapat diakses oleh role Service Quality (SQ).", "warning");
      return;
    }
    if (actionType === 'mapping') setShowMappingModal(true);
    else if (actionType === 'import') setShowImportModal(true);
    else if (actionType === 'manual') setShowManualModal(true);
  };

  const normalizeUnitName = (name) => {
    if (!name) return "";
    return name.toString().toLowerCase().replace(/grapari/g, "").replace(/lite/g, "").replace(/[^a-z0-9]/g, "").trim();
  };

  const findOfficialUnitName = (excelName, masterList) => {
    if (!excelName) return "";
    let raw = excelName.toString().trim();
    let cleanExcel = normalizeUnitName(raw);
    if (cleanExcel.length <= 2) return raw;

    for (let item of masterList) {
      if (normalizeUnitName(item) === cleanExcel) return item;
    }
    for (let item of masterList) {
      let cleanMaster = normalizeUnitName(item);
      if (cleanMaster.length > 3 && cleanExcel.length > 3) {
        if (cleanMaster.includes(cleanExcel) || cleanExcel.includes(cleanMaster)) return item;
      }
    }
    return raw;
  };

  const parseExcelDate = (dateVal) => {
    if (!dateVal) return new Date().toISOString().slice(0, 10);
    if (typeof dateVal === 'string' && dateVal.includes('-')) {
      let parts = dateVal.split('-');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateVal;
  };

  const loadReadinessData = async () => {
    try {
      let raisaRes = await supabase.from('database_raisa').select('*');
      if (raisaRes.data) {
        setMasterUnitObjectsList(raisaRes.data);
        let extracted = raisaRes.data.map(d => d.raisa_name).filter(Boolean);
        setMasterUnitList(Array.from(new Set(extracted)).sort());

        let regExtracted = raisaRes.data.map(d => d.region || d.area).filter(Boolean);
        setAvailableRegions(Array.from(new Set(regExtracted)).sort());
      }

      let readinessRes = await supabase.from('database_readiness').select('*').order('tanggal', { ascending: false });
      if (readinessRes.data) {
        setGlobalReadinessData(readinessRes.data);
      } else {
        setGlobalReadinessData([]);
      }
    } catch (err) {
      console.warn("Error loading readiness:", err.message);
      setGlobalReadinessData([]);
    }
  };

  const applyReadinessFilter = () => {
    let allowedUnitsSet = null;
    if (filterRegion !== 'ALL') {
      allowedUnitsSet = new Set();
      masterUnitObjectsList.forEach(m => {
        let reg = m.region || m.area || '';
        if (reg === filterRegion && m.raisa_name) {
          allowedUnitsSet.add(normalizeUnitName(m.raisa_name));
        }
      });
    }

    let manualList = [];
    let analyticalList = [];

    for (let row of globalReadinessData) {
      let sumber = (row.sumber || "").toLowerCase();
      let isManual = sumber.includes('manual');
      let matchSearch = searchReadiness === "" || (row.unit_name && row.unit_name.toLowerCase().includes(searchReadiness.toLowerCase()));
      let matchDate = !filterStartDate || !filterEndDate || (row.tanggal >= filterStartDate && row.tanggal <= filterEndDate);
      
      let matchRegion = true;
      if (allowedUnitsSet) {
        matchRegion = allowedUnitsSet.has(normalizeUnitName(row.unit_name));
      }

      if (isManual && matchSearch && matchDate && matchRegion) {
        manualList.push(row);
      }

      let matchSource = filterSource === 'ALL' || (filterSource === 'Excel' && sumber.includes('excel')) || (filterSource === 'Manual' && sumber.includes('manual'));
      if (matchSource && matchSearch && matchDate && matchRegion) {
        analyticalList.push(row);
      }
    }

    setManualTableData(manualList);

    let evalDate = filterEndDate || new Date().toISOString().slice(0, 10);
    let raisaToday = globalReadinessData.filter(r => {
      let dateMatch = r.tanggal === evalDate && (r.sumber || "").toLowerCase().includes('excel');
      if (!dateMatch) return false;
      if (allowedUnitsSet) {
        return allowedUnitsSet.has(normalizeUnitName(r.unit_name));
      }
      return true;
    });
    
    let filteredMasterUnits = filterRegion === 'ALL' ? masterUnitList : masterUnitList.filter(m => allowedUnitsSet.has(normalizeUnitName(m)));

    let checkedCount = raisaToday.length;
    let totalTarget = filteredMasterUnits.length;
    let missing = Math.max(0, totalTarget - checkedCount);
    let compliance = totalTarget > 0 ? Math.min(100, Math.round((checkedCount / totalTarget) * 100)) : 0;

    setCardCompliance(`${compliance}%`);
    setCardComplianceSub(`dari ${checkedCount} / ${totalTarget} Unit Ceklis`);
    setCardMissing(missing);

    let checkedNormSet = new Set(raisaToday.map(r => normalizeUnitName(r.unit_name)));
    let unported = filteredMasterUnits.filter(m => !checkedNormSet.has(normalizeUnitName(m)));
    setUnportedUnitsList(unported);

    let manualFindings = analyticalList.filter(r => (r.status || "").toLowerCase().includes('temuan') && (r.sumber || "").toLowerCase().includes('manual'));
    setCardFindings(manualFindings.length);

    let categoryMap = {};
    let unitMap = {};
    for (let f of manualFindings) {
      let cat = f.kategori || 'Lainnya';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      let u = f.unit_name || 'Tidak Diketahui';
      unitMap[u] = (unitMap[u] || 0) + 1;
    }

    let sortedCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    setCardTopIssue(sortedCats.length > 0 ? sortedCats[0][0] : '-');

    renderTrendChart(analyticalList);
    renderCategoryChart(manualFindings);
    renderRegionalChart(masterUnitObjectsList, raisaToday);
    renderTopUnitChart(unitMap);
  };

  const renderTrendChart = (records) => {
    if (!trendChartRef.current) return;
    if (chartTrendInstance.current) chartTrendInstance.current.destroy();

    let dailyMap = {};
    for (let r of records) {
      if (r.tanggal) {
        if (!dailyMap[r.tanggal]) dailyMap[r.tanggal] = { aman: 0, temuan: 0 };
        if ((r.status || "").toLowerCase().includes('temuan')) dailyMap[r.tanggal].temuan++;
        else dailyMap[r.tanggal].aman++;
      }
    }

    let labels = Object.keys(dailyMap).sort();
    let amanVals = labels.map(l => dailyMap[l].aman);
    let temuanVals = labels.map(l => dailyMap[l].temuan);

    if (labels.length === 0) {
      labels = ['-'];
      amanVals = [0];
      temuanVals = [0];
    }

    chartTrendInstance.current = new Chart(trendChartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Ceklis / Aman', data: amanVals, borderColor: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 3, fill: true, tension: 0.4 },
          { label: 'Temuan', data: temuanVals, borderColor: '#F59E0B', backgroundColor: 'transparent', borderWidth: 3, borderDash: [5, 5], tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 30 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true, align: 'top', anchor: 'end', offset: 4,
            font: { weight: 'black', size: 10 },
            formatter: (val) => val > 0 ? val : ''
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 9 }, color: '#475569', maxRotation: 45 } },
          y: { beginAtZero: true, grid: { color: 'rgba(99, 102, 241, 0.1)', borderDash: [5, 5] }, ticks: { display: false }, border: { display: false } }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderCategoryChart = (manualFindings) => {
    if (!categoryChartRef.current) return;
    if (chartCategoryInstance.current) chartCategoryInstance.current.destroy();

    let catCounts = { Grooming: 0, Kehadiran: 0, Fasilitas: 0 };
    for (let f of manualFindings) {
      let cat = (f.kategori || '').toLowerCase();
      if (cat.includes('grooming')) catCounts.Grooming++;
      else if (cat.includes('kehadiran')) catCounts.Kehadiran++;
      else if (cat.includes('fasilitas')) catCounts.Fasilitas++;
    }

    let labels = ['Grooming', 'Kehadiran', 'Fasilitas Layanan'];
    let data = [catCounts.Grooming, catCounts.Kehadiran, catCounts.Fasilitas];
    let colors = ['#F59E0B', '#3B82F6', '#10B981'];

    chartCategoryInstance.current = new Chart(categoryChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 8, barPercentage: 0.55 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            offset: 4,
            font: { weight: 'bold', size: 11 },
            color: '#334155'
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#475569' } },
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(99, 102, 241, 0.1)', borderDash: [5, 5] }, 
            ticks: { display: false }, 
            border: { display: false } 
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderRegionalChart = (masterObjs, raisaToday) => {
    if (!regionalChartRef.current) return;
    if (chartRegionalInstance.current) chartRegionalInstance.current.destroy();

    let regMap = {};
    for (let m of masterObjs) {
      let reg = m.region || m.area || 'Nasional';
      if (m.raisa_name) {
        if (!regMap[reg]) regMap[reg] = new Set();
        regMap[reg].add(normalizeUnitName(m.raisa_name));
      }
    }

    let checkedSet = new Set(raisaToday.map(r => normalizeUnitName(r.unit_name)));
    let regLabels = Object.keys(regMap).sort();
    let totalVals = [];
    let checkedVals = [];

    for (let reg of regLabels) {
      let units = regMap[reg];
      totalVals.push(units.size);
      let chkCount = 0;
      units.forEach(u => { if (checkedSet.has(u)) chkCount++; });
      checkedVals.push(chkCount);
    }

    if (regLabels.length === 0) {
      regLabels = ['Nasional'];
      totalVals = [0];
      checkedVals = [0];
    }

    let palette = ['#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4', '#C2410C', '#A21CAF', '#4338CA'];
    let colors = regLabels.map((_, i) => palette[i % palette.length]);

    let ctx = regionalChartRef.current.getContext('2d');
    let emeraldGrad = ctx.createLinearGradient(0, 0, 0, 300);
    emeraldGrad.addColorStop(0, '#34D399');
    emeraldGrad.addColorStop(0.5, '#059669');
    emeraldGrad.addColorStop(1, '#064E3B');

    chartRegionalInstance.current = new Chart(regionalChartRef.current, {
      type: 'bar',
      data: {
        labels: regLabels,
        datasets: [
          { label: 'Total Unit (Master Raisa)', data: totalVals, backgroundColor: colors, borderRadius: 6, barPercentage: 0.6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
          { label: 'Sudah Ceklis', data: checkedVals, backgroundColor: emeraldGrad, borderRadius: 6, barPercentage: 0.6, borderWidth: 1, borderColor: '#047857' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' } } },
          datalabels: { display: true, anchor: 'end', align: 'top', font: { weight: 'bold', size: 9 } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#475569' } },
          y: { beginAtZero: true, grid: { color: 'rgba(99, 102, 241, 0.1)', borderDash: [5, 5] }, ticks: { font: { size: 9 } } }
        }
      },
      plugins: [ChartDataLabels]
    });
  };

  const renderTopUnitChart = (unitMap) => {
    if (!topUnitChartRef.current) return;
    if (chartTopUnitInstance.current) chartTopUnitInstance.current.destroy();

    let sorted = Object.entries(unitMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let labels = sorted.map(s => s[0]);
    let data = sorted.map(s => s[1]);

    if (labels.length === 0) {
      labels = ['Kosong'];
      data = [0];
    }

    chartTopUnitInstance.current = new Chart(topUnitChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: '#34D399', borderRadius: 6, barPercentage: 0.5 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: true, align: 'right', anchor: 'end', font: { weight: 'bold', size: 10 }, color: '#047857' }
        },
        scales: {
          x: { display: false },
          y: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } }
        },
        layout: { padding: { right: 25 } }
      },
      plugins: [ChartDataLabels]
    });
  };

  const downloadMissingUnitsExcel = () => {
    if (unportedUnitsList.length === 0) {
      showReadinessToast("Informasi", "Tidak ada unit yang belum ceklis untuk di-download.", "warning");
      return;
    }
    let dataToExport = unportedUnitsList.map((u, i) => ({ "No": i + 1, "Unit Belum Ceklis": u }));
    let worksheet = XLSX.utils.json_to_sheet(dataToExport);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Belum Ceklis");
    XLSX.writeFile(workbook, "Unit_Belum_Ceklis.xlsx");
    showReadinessToast("Sukses", "File Excel unit belum ceklis berhasil di-download.", "success");
  };

  // Fitur Download Excel Tabel Histori Temuan
  const downloadTableFindingsExcel = () => {
    if (manualTableData.length === 0) {
      showReadinessToast("Informasi", "Tidak ada data temuan pada tabel untuk di-download.", "warning");
      return;
    }
    let dataToExport = manualTableData.map((item, idx) => ({
      "No": idx + 1,
      "Tanggal": item.tanggal || '-',
      "Unit Name": item.unit_name || '-',
      "Status": item.status || '-',
      "Kategori Temuan": item.kategori || '-',
      "Catatan Khusus": item.catatan || '-',
      "Link Eviden": item.link_eviden || '-'
    }));

    let worksheet = XLSX.utils.json_to_sheet(dataToExport);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Histori Temuan");
    XLSX.writeFile(workbook, "Histori_Temuan_Readiness.xlsx");
    showReadinessToast("Sukses", "File Excel database histori temuan berhasil di-download.", "success");
  };

  const handleAutoFillInput = async (nikVal) => {
    const cleanNik = nikVal.trim();
    setInputNik(cleanNik);
    if (!cleanNik) return;
    try {
      const { data, error } = await supabase
        .from('database_csr')
        .select('*')
        .or(`nik.eq.${cleanNik},nik_csr.eq.${cleanNik}`)
        .limit(1);
      
      if (!error && data && data.length > 0) {
        const row = data[0];
        setInputNama(row.nama || row.nama_csr || '');
        setInputRegion(row.region || '');
        setInputCluster(row.cluster || '');
        setInputUnit(row.unitName || row.unit_name || '');
        setInputJob(row.job || '');
      }
    } catch (err) {
      console.error("Gagal auto-fill CSR:", err);
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

  const submitManualData = async () => {
    if (!inputNik.trim() || !inputNama.trim()) {
      showReadinessToast("Perhatian", "Harap isi NIK dan Nama CSR terlebih dahulu!", "warning");
      return;
    }
    try {
      let fileUrl = '';
      if (inputFile) {
        fileUrl = await uploadFileToDrive(inputFile);
      }

      let { error } = await supabase.from('database_readiness').insert([{
        tanggal: inputDate,
        nik_csr: inputNik.trim(),
        nama_csr: inputNama.trim(),
        region: inputRegion,
        cluster: inputCluster,
        unit_name: inputUnit.trim(),
        job: inputJob,
        sumber: 'Manual (SQ)',
        status: 'Temuan',
        kategori: inputKategori,
        catatan: inputCatatan,
        link_eviden: fileUrl || inputEviden
      }]);
      if (error) throw error;

      closeModalWithAnimation(setShowManualModal);
      loadReadinessData();
      showReadinessToast("Sukses!", "Temuan Manual Berhasil Disimpan!", "success");
    } catch (err) {
      showReadinessToast("Gagal Menyimpan!", err.message, "error");
    }
  };

  const openEditModal = (id) => {
    if (!checkUserIsSqRole()) {
      showReadinessToast("Akses Terbatas (Read-Only)", "Fitur edit data ini hanya dapat diakses oleh role Service Quality (SQ).", "warning");
      return;
    }
    let target = globalReadinessData.find(r => r.id === id);
    if (target) {
      setEditId(target.id);
      setEditDate(target.tanggal || '');
      setEditUnit(target.unit_name || '');
      setEditKategori(target.kategori || '-');
      setEditCatatan(target.catatan || '');
      setEditEviden(target.link_eviden || '');
      setShowEditModal(true);
    }
  };

  const submitEditData = async () => {
    if (!editUnit.trim()) {
      showReadinessToast("Perhatian", "Pilih atau ketik unit terlebih dahulu!", "warning");
      return;
    }
    try {
      let { error } = await supabase.from('database_readiness').update({
        tanggal: editDate,
        unit_name: editUnit.trim(),
        kategori: editKategori,
        catatan: editCatatan,
        link_eviden: editEviden
      }).eq('id', editId);
      if (error) throw error;

      closeModalWithAnimation(setShowEditModal);
      loadReadinessData();
      showReadinessToast("Berhasil!", "Data temuan berhasil diperbarui!", "success");
    } catch (err) {
      showReadinessToast("Gagal Update!", err.message, "error");
    }
  };

  const deleteReadiness = (id) => {
    if (!checkUserIsSqRole()) {
      showReadinessToast("Akses Terbatas (Read-Only)", "Fitur hapus data ini hanya dapat diakses oleh role Service Quality (SQ).", "warning");
      return;
    }
    setConfirmConfig({
      title: "Hapus Histori Temuan",
      msg: "Data temuan yang dihapus tidak dapat dikembalikan. Apakah Anda yakin?",
      onConfirm: async () => {
        try {
          let { error } = await supabase.from('database_readiness').delete().eq('id', id);
          if (error) throw error;
          loadReadinessData();
          showReadinessToast("Terhapus", "Data temuan berhasil dihapus dari database.", "success");
        } catch (err) {
          showReadinessToast("Gagal Menghapus", err.message, "error");
        }
      }
    });
    setShowConfirmModal(true);
  };

  const processExcelImport = async (e) => {
    let fileInput = document.getElementById('importFile');
    if (!fileInput || fileInput.files.length === 0) {
      showReadinessToast("Perhatian", "Pilih file excel terlebih dahulu!", "warning");
      return;
    }
    setIsImporting(true);
    try {
      let file = fileInput.files[0];
      let buffer = await file.arrayBuffer();
      let wb = XLSX.read(buffer);
      let sheetName = wb.SheetNames[0];
      let rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      let importedDates = new Set();
      let uniqueMap = new Map();

      rows.forEach((row, idx) => {
        let rawDate = row[mapTanggal] || row['Date'] || row['tanggal'];
        let rawUnit = row[mapUnit] || row['Unit Name'] || row['unit_name'] || row['Unit'];
        let rawPetugas = row['Petugas'] || row['catatan'];

        if (rawUnit) {
          let officialName = findOfficialUnitName(rawUnit, masterUnitList);
          let stdDate = parseExcelDate(rawDate);
          importedDates.add(stdDate);
          let uniqueKey = `${stdDate}_${officialName}_${idx}`;

          if (!uniqueMap.has(uniqueKey)) {
            uniqueMap.set(uniqueKey, {
              tanggal: stdDate,
              unit_name: officialName,
              sumber: 'Excel (Raisa)',
              status: 'Ceklis',
              kategori: '-',
              catatan: rawPetugas ? (`Petugas: ${rawPetugas}`) : '-'
            });
          }
        }
      });

      let payload = Array.from(uniqueMap.values());
      if (payload.length === 0) throw new Error("Tidak ada data valid yang terbaca dari Excel!");

      for (let d of importedDates) {
        await supabase.from('database_readiness').delete().eq('tanggal', d).ilike('sumber', '%excel%');
      }

      let { error } = await supabase.from('database_readiness').insert(payload);
      if (error) throw error;

      closeModalWithAnimation(setShowImportModal);
      loadReadinessData();
      showReadinessToast("Berhasil!", `Telah mengunggah ${payload.length} data checklist Raisa dengan utuh!`, "success");
    } catch (err) {
      showReadinessToast("Error Import Excel!", err.message, "error");
    } finally {
      setIsImporting(false);
    }
  };

  // Kalkulasi Pagination untuk Tabel
  const totalPages = Math.ceil(manualTableData.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTableData = manualTableData.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 font-sans animate-[fadeInOut_0.3s_ease-in-out]">
      
      {/* Header & Filter Bar */}
      <div className="bg-gradient-to-tr from-slate-200 via-slate-100 to-slate-300 p-6 rounded-3xl shadow-md border border-slate-300 space-y-4 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold border border-indigo-200 shadow-sm">
              <i className="fa-solid fa-clipboard-check"></i>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Daily Grooming & Readiness</h3>
              <p className="text-xs text-slate-600 font-medium">Monitoring kesiapan layanan harian GraPARI</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button onClick={() => handleProtectedAction('mapping')} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-semibold flex items-center space-x-2 transition shadow-md shadow-slate-800/30 cursor-pointer">
              <i className="fa-solid fa-gears text-xs"></i>
              <span>Pengaturan Excel</span>
            </button>
            <button onClick={loadReadinessData} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer">
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Filter Control Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-4 border-t border-slate-300 relative z-10">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Dari Tanggal</label>
            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:border-indigo-600" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sampai Tanggal</label>
            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:border-indigo-600" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Filter Regional</label>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:border-indigo-600">
              <option value="ALL">Semua Regional</option>
              {availableRegions.map((reg, idx) => (
                <option key={idx} value={reg}>{reg}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sumber Data</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:border-indigo-600">
              <option value="ALL">Semua Sumber</option>
              <option value="Excel">Import Excel (Raisa)</option>
              <option value="Manual">Temuan Manual SQ</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cari Unit / GraPARI</label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-[11px] text-slate-400 text-xs"></i>
              <input type="text" value={searchReadiness} onChange={e => setSearchReadiness(e.target.value)} placeholder="Ketik nama unit..." className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-inner focus:outline-none focus:border-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Scorecards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative bg-gradient-to-br from-amber-500 to-orange-800 p-5 rounded-3xl border border-amber-400 shadow-[0_12px_25px_-5px_rgba(245,158,11,0.4)] flex items-center justify-between text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-100">Total Temuan</p>
            <h4 className="text-3xl font-black mt-1 text-white drop-shadow-md">{cardFindings}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-triangle-exclamation"></i></div>
        </div>

        <div className="relative bg-gradient-to-br from-rose-500 to-red-800 p-5 rounded-3xl border border-rose-400 shadow-[0_12px_25px_-5px_rgba(225,29,72,0.4)] flex items-center justify-between text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-rose-100">Top Pelanggaran</p>
            <h4 className="text-lg font-black mt-1 text-white drop-shadow-md truncate w-36">{cardTopIssue}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-shirt"></i></div>
        </div>

        <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-900 p-5 rounded-3xl border border-indigo-500 shadow-[0_12px_25px_-5px_rgba(79,70,229,0.4)] flex items-center justify-between text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Cheklist Compliance</p>
            <div className="flex items-end space-x-2 mt-1">
              <h4 className="text-3xl font-black text-white drop-shadow-md">{cardCompliance}</h4>
              <span className="text-xs font-medium text-indigo-200 mb-1">{cardComplianceSub}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-chart-line"></i></div>
        </div>

        <div className="relative bg-gradient-to-br from-slate-700 to-slate-950 p-5 rounded-3xl border border-slate-600 shadow-[0_12px_25px_-5px_rgba(15,23,42,0.4)] flex items-center justify-between text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-300">Belum Ceklis Raisa</p>
            <h4 className="text-3xl font-black mt-1 text-rose-400 drop-shadow-md">{cardMissing}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-xl shadow-inner border border-white/20"><i className="fa-solid fa-user-clock"></i></div>
        </div>
      </div>

      {/* Grid 2 Kolom Sejajar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-b from-indigo-50/90 via-indigo-100/40 to-slate-100 p-6 rounded-3xl border border-indigo-200 shadow-md flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-sm font-extrabold text-indigo-950 flex items-center">
              <i className="fa-solid fa-chart-area text-indigo-600 mr-2"></i> Tren Kepatuhan Checklist
            </h4>
            <div className="flex items-center space-x-3 text-[10px] font-bold bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-xs">
              <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"></span><span className="text-slate-700">Ceklis / Aman</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-4 border-t-2 border-amber-500 border-dashed"></div><span className="text-slate-700">Temuan</span></div>
            </div>
          </div>
          <div className="relative h-64"><canvas ref={trendChartRef}></canvas></div>
        </div>

        {/* Chart Kategori Temuan (Grooming, Kehadiran, Fasilitas Layanan) dengan angka tepat di atas batang */}
        <div className="bg-gradient-to-b from-amber-50/90 via-amber-100/40 to-slate-100 p-6 rounded-3xl border border-amber-200 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-extrabold text-amber-950 flex items-center">
              <i className="fa-solid fa-chart-bar text-amber-600 mr-2"></i> Perbandingan Kategori Temuan
            </h4>
          </div>
          <div className="relative h-64"><canvas ref={categoryChartRef}></canvas></div>
        </div>

        <div className="bg-gradient-to-b from-rose-50/90 via-rose-100/40 to-slate-100 p-5 rounded-3xl border border-rose-200 shadow-md flex flex-col h-[332px]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-black text-rose-950 uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-circle-exclamation mr-2 text-rose-600 animate-pulse"></i> Unit Belum Ceklis Daily
            </h4>
            <button onClick={downloadMissingUnitsExcel} className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center text-xs shadow-sm transition cursor-pointer" title="Download Excel Unit Belum Ceklis">
              <i className="fa-solid fa-file-excel"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {unportedUnitsList.length === 0 ? (
              <div className="p-3 bg-white rounded-xl text-center text-[10px] text-slate-500 italic">✅ Semua unit sudah ceklis hari ini!</div>
            ) : (
              unportedUnitsList.map((unitName, idx) => (
                <div key={idx} className="px-3 py-1.5 bg-white border border-rose-100 rounded-lg text-[10px] font-bold text-rose-700 shadow-sm">{unitName}</div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-b from-sky-50/90 via-sky-100/40 to-slate-100 p-6 rounded-3xl border border-sky-200 shadow-md flex flex-col justify-between">
          <h4 className="text-sm font-extrabold text-sky-950 mb-4 flex items-center">
            <i className="fa-solid fa-chart-column text-sky-600 mr-2"></i> Kepatuhan Checklist per Regional Daily
          </h4>
          <div className="relative h-64"><canvas ref={regionalChartRef}></canvas></div>
        </div>

        <div className="bg-gradient-to-b from-amber-50/90 via-amber-100/40 to-slate-100 p-5 rounded-3xl border border-amber-200 shadow-md flex flex-col h-[332px] lg:col-span-2">
          <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wider mb-3 flex items-center">
            <i className="fa-solid fa-ranking-star text-amber-600 mr-2"></i> Unit Temuan Terbanyak
          </h4>
          <div className="relative flex-1"><canvas ref={topUnitChartRef}></canvas></div>
        </div>
      </div>

      {/* Database Histori Temuan */}
      <div className="bg-gradient-to-b from-slate-100 to-slate-200/90 p-6 rounded-3xl border border-slate-300 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-table-list text-emerald-600"></i>
            <h3 className="text-base font-bold text-slate-900">Database Histori Temuan</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={downloadTableFindingsExcel} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md shadow-emerald-600/30 cursor-pointer" title="Download Excel Tabel Ini">
              <i className="fa-solid fa-file-excel"></i>
              <span>Download Excel</span>
            </button>
            <button onClick={() => handleProtectedAction('import')} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center space-x-2 border border-emerald-300 shadow-sm cursor-pointer">
              <i className="fa-solid fa-file-excel"></i>
              <span>Import Excel (Raisa)</span>
            </button>
            <button onClick={() => handleProtectedAction('manual')} className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md cursor-pointer">
              <i className="fa-solid fa-plus"></i>
              <span>Input Temuan (SQ)</span>
            </button>
          </div>
        </div>

        {/* Tabel dengan Kolom Catatan Khusus Paling Lebar dan Kolom Lainnya Lebar Sama Rata */}
        <div className="overflow-x-auto rounded-2xl border border-slate-300 shadow-sm bg-white">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-600 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                <th className="py-4 px-3 w-[10%]">Tanggal</th>
                <th className="py-4 px-3 w-[10%]">Unit Name</th>
                <th className="py-4 px-3 w-[10%] text-center">Status</th>
                <th className="py-4 px-3 w-[10%]">Kategori Temuan</th>
                <th className="py-4 px-4 w-[40%]">Catatan Khusus</th>
                <th className="py-4 px-3 w-[10%] text-center">Link Temuan</th>
                <th className="py-4 px-3 w-[10%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {currentTableData.length === 0 ? (
                <tr><td colSpan="7" className="py-8 text-center text-slate-500 italic">Belum ada histori temuan manual sesuai filter.</td></tr>
              ) : (
                currentTableData.map((record) => {
                  const isExpanded = !!expandedNotes[record.id];
                  const catatanText = record.catatan || '-';
                  const isLongText = catatanText.length > 50;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition border-b border-slate-100 h-[64px] align-middle">
                      <td className="py-2 px-3 text-slate-600 font-semibold truncate">
                        {record.tanggal || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-bold truncate">
                        {record.unit_name || '-'}
                      </td>
                      <td className="py-2 px-3 text-center truncate">
                        <span className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border rounded-xl shadow-sm bg-amber-100 text-amber-800 border-amber-200 inline-block">
                          {record.status || 'Temuan'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-semibold truncate">
                        {record.kategori || '-'}
                      </td>
                      
                      {/* Kolom Catatan Khusus Paling Lebar dengan Tinggi Fixed & Tombol Selengkapnya */}
                      <td className="py-2 px-4 text-slate-600">
                        <div className="flex flex-col justify-center h-full">
                          <p className={`leading-snug ${!isExpanded ? 'truncate' : 'whitespace-pre-wrap'}`}>
                            {catatanText}
                          </p>
                          {isLongText && (
                            <button 
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 text-left mt-0.5 cursor-pointer focus:outline-none"
                            >
                              {isExpanded ? '▲ Sembunyikan' : '▼ Selengkapnya'}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center truncate">
                        {record.link_eviden ? (
                          <a 
                            href={record.link_eviden} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 transition truncate"
                          >
                            <i className="fa-solid fa-link text-[9px]"></i>
                            <span>Buka Link</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Tidak ada link</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center truncate">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button onClick={() => openEditModal(record.id)} className="w-7 h-7 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-xs font-bold border border-amber-200 transition cursor-pointer" title="Edit Data"><i className="fa-solid fa-pen-to-square"></i></button>
                          <button onClick={() => deleteReadiness(record.id)} className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-xs font-bold border border-rose-200 transition cursor-pointer" title="Hapus Data"><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paging Bar (Maksimal 10 List Data per Halaman) */}
        {manualTableData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs font-medium text-slate-500">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, manualTableData.length)}</span> dari <span className="font-bold text-slate-800">{manualTableData.length}</span> data temuan
            </p>
            <div className="flex items-center space-x-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <i className="fa-solid fa-chevron-left text-[10px]"></i>
                <span>Sebelumnya</span>
              </button>
              
              <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold">
                Hal. {currentPage} dari {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>Berikutnya</span>
                <i className="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ================= MODALS (Fade In & Fade Out ala iOS) ================= */}
      
      {/* 1. Modal Input Manual dengan Fitur Lengkap CSR Form */}
      {showManualModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={() => closeModalWithAnimation(setShowManualModal)}>
          <div className={`w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-800">Form Input Sesi Coaching & Counseling / Temuan</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Catat temuan pelanggaran layanan/grooming & pembinaan CSR</p>
              </div>
              <button onClick={() => closeModalWithAnimation(setShowManualModal)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIK CSR (Auto-Fill)</label>
                  <input type="text" value={inputNik} onChange={e => handleAutoFillInput(e.target.value)} placeholder="Masukkan NIK..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama CSR</label>
                  <input type="text" value={inputNama} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Region</label>
                  <input type="text" value={inputRegion} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cluster</label>
                  <input type="text" value={inputCluster} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Name</label>
                  <input type="text" value={inputUnit} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Job Role</label>
                  <input type="text" value={inputJob} readOnly className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Pembinaan</label>
                  <select value={inputTipe} onChange={e => setInputTipe(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                    <option value="Coaching">Coaching</option>
                    <option value="Counseling">Counseling</option>
                    <option value="Surat Peringatan">Surat Peringatan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Temuan / Area</label>
                  <select value={inputArea} onChange={e => setInputArea(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
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
                <textarea rows="2" value={inputRootCause} onChange={e => setInputRootCause(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="Tuliskan akar masalah..."></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Komitmen / Action Plan</label>
                <textarea rows="2" value={inputKomitmen} onChange={e => setInputKomitmen(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="Tuliskan komitmen perbaikan..."></textarea>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lampiran Eviden (File)</label>
                <input type="file" onChange={e => setInputFile(e.target.files[0])} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition cursor-pointer" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-2 bg-slate-50 rounded-b-[2rem]">
              <button type="button" onClick={() => closeModalWithAnimation(setShowManualModal)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition text-xs">Batal</button>
              <button onClick={submitManualData} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">Simpan Data</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Modal View Detail */}
      {showViewModal && selectedRecord && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={() => closeModalWithAnimation(setShowViewModal)}>
          <div className={`w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
              <h3 className="text-base font-black tracking-tight text-slate-800">Detail Temuan (SQ)</h3>
              <button onClick={() => closeModalWithAnimation(setShowViewModal)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Tanggal:</strong> <span className="font-bold text-slate-900">{selectedRecord.tanggal}</span></div>
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Unit GraPARI:</strong> <span className="font-bold text-slate-900">{selectedRecord.unit_name}</span></div>
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Sumber Data:</strong> <span className="font-bold text-slate-900">{selectedRecord.sumber}</span></div>
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Status:</strong> <span className="font-bold text-slate-900">{selectedRecord.status}</span></div>
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Kategori:</strong> <span className="font-bold text-slate-900">{selectedRecord.kategori}</span></div>
              <div><strong className="text-slate-500 uppercase text-[10px] block mb-1">Catatan Detail:</strong> <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 text-slate-800 leading-relaxed">{selectedRecord.catatan || '-'}</p></div>
              <div>
                <strong className="text-slate-500 uppercase text-[10px] block mb-1">Link Eviden:</strong> 
                {selectedRecord.link_eviden ? (
                  <a href={selectedRecord.link_eviden} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline break-all">{selectedRecord.link_eviden}</a>
                ) : (
                  <span className="text-slate-400 italic">-</span>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-[2rem]">
              <button onClick={() => closeModalWithAnimation(setShowViewModal)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer">Tutup</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Modal Edit */}
      {showEditModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={() => closeModalWithAnimation(setShowEditModal)}>
          <div className={`w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
              <h3 className="text-base font-black tracking-tight text-slate-800">Edit Temuan</h3>
              <button onClick={() => closeModalWithAnimation(setShowEditModal)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Tanggal</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Unit GraPARI</label>
                  <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} list="listMasterEdit" className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none" />
                  <datalist id="listMasterEdit">
                    {masterUnitList.map((u, i) => <option key={i} value={u} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Kategori Temuan</label>
                <select value={editKategori} onChange={e => setEditKategori(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none">
                  <option value="-">Pilih Kategori...</option>
                  <option value="Grooming">Grooming</option>
                  <option value="Fasilitas">Fasilitas</option>
                  <option value="Kehadiran">Kehadiran</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Catatan Detail</label>
                <textarea rows="3" value={editCatatan} onChange={e => setEditCatatan(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none resize-none"></textarea>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Link Eviden</label>
                <input type="url" value={editEviden} onChange={e => setEditEviden(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-[2rem]">
              <button onClick={submitEditData} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">Simpan Perubahan</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Modal Import Excel Raisa */}
      {showImportModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={() => closeModalWithAnimation(setShowImportModal)}>
          <div className={`w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50 rounded-t-[2rem]">
              <h3 className="text-base font-black text-emerald-800">Import Checklist (Excel Raisa)</h3>
              <button onClick={() => closeModalWithAnimation(setShowImportModal)} className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer" onClick={() => document.getElementById('importFile').click()}>
                <i className="fa-solid fa-file-excel text-3xl text-emerald-500 mb-2"></i>
                <p className="text-xs font-bold text-slate-700">Pilih / Drag File Excel Anda</p>
                <p className="text-[10px] text-slate-500 mt-1">Format kolom: Date, Unit Name, Petugas</p>
                <input type="file" id="importFile" accept=".xlsx, .xls" className="hidden" onChange={e => setExcelFileName(e.target.files[0]?.name || '')} />
              </div>
              <div className="text-center text-[10px] font-bold text-indigo-600 truncate">{excelFileName}</div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-[2rem]">
              <button onClick={processExcelImport} disabled={isImporting} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">
                {isImporting ? 'Memproses...' : 'Proses Import Data'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. Modal Mapping Kolom */}
      {showMappingModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={() => closeModalWithAnimation(setShowMappingModal)}>
          <div className={`w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-slate-200 my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 rounded-t-[2rem]">
              <div className="flex items-center space-x-2 text-white"><i className="fa-solid fa-gears"></i><h3 className="text-base font-black">Mapping Kolom Excel Raisa</h3></div>
              <button onClick={() => closeModalWithAnimation(setShowMappingModal)} className="text-slate-400 hover:text-white cursor-pointer"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Kolom: Tanggal</label>
                  <input type="text" value={mapTanggal} onChange={e => setMapTanggal(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-indigo-600 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Kolom: Unit Name</label>
                  <input type="text" value={mapUnit} onChange={e => setMapUnit(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-indigo-600 outline-none" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-[2rem]">
              <button onClick={() => { closeModalWithAnimation(setShowMappingModal); showReadinessToast("Tersimpan!", "Mapping header file Excel berhasil disimpan.", "success"); }} className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer">Simpan Mapping</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Custom Confirm Modal */}
      {showConfirmModal && ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`}>
          <div className={`w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-slate-200 my-auto transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`}>
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner"><i className="fa-solid fa-triangle-exclamation"></i></div>
              <div>
                <h3 className="text-lg font-black text-slate-800">{confirmConfig.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">{confirmConfig.msg}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-center gap-3 bg-slate-50 rounded-b-[2rem]">
              <button onClick={() => closeModalWithAnimation(setShowConfirmModal)} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer">Batal</button>
              <button onClick={() => { closeModalWithAnimation(setShowConfirmModal); if (confirmConfig.onConfirm) confirmConfig.onConfirm(); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 7. Toast Notification (Fade In & Out) */}
      {ReactDOM.createPortal(
        <div className={`fixed bottom-6 right-6 z-[999999] flex items-center gap-3 bg-white px-4 py-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-200 min-w-[300px] transition-all duration-300 ease-in-out ${toast.show ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95 pointer-events-none'}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md ${toast.type === 'error' ? 'bg-rose-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
            <i className={`fa-solid ${toast.type === 'error' ? 'fa-xmark' : toast.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-check'}`}></i>
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{toast.title}</h4>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">{toast.msg}</p>
          </div>
        </div>,
        document.body
      )}

      {/* Tailwind Custom Keyframes Injection for Smooth Fade In & Out Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

    </div>
  );
}