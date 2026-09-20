import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabase';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

const targetMap = {
  "Disiplin Kerja": 10, "Penampilan": 35, "Etika Pelayanan": 35, "Responsiveness": 20,
  "Gali Informasi": 30, "Analisa Kebutuhan": 15, "Kejelasan Informasi": 15, "Holding Time": 10,
  "Dokumentasi": 30, "FCR / Eskalasi": 30, "Solusi & Konfirmasi": 30, "Edukasi Layanan": 20, "Cross/Upselling": 20
};

export default function Tapping() {
  // Default bulan berjalan (tanggal awal & akhir bulan saat ini)
  const currentDate = new Date();
  const curYear = currentDate.getFullYear();
  const curMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const defaultStart = `${curYear}-${curMonth}-01`;
  const lastDayNum = new Date(curYear, currentDate.getMonth() + 1, 0).getDate();
  const defaultEnd = `${curYear}-${curMonth}-${String(lastDayNum).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedRegional, setSelectedRegional] = useState('ALL');
  const [selectedCluster, setSelectedCluster] = useState('ALL');
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  
  const [globalCsrDb, setGlobalCsrDb] = useState([]);
  const [regionalsList, setRegionalsList] = useState([]);
  const [clustersList, setClustersList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);
  
  const [summaryData, setSummaryData] = useState({
    totalAudit: 0, avgTotal: '0.0', avgAttitude: '0.0', avgSkill: '0.0', avgKnowledge: '0.0',
    underAttitude: 0, underSkill: 0, underKnowledge: 0,
    regionalAnalytics: [], dailyTrend: [], losAnalytics: [], top5CaseKIP: [],
    subParams: {}, top5Sub: [], bottom5Sub: [], coachingList: [], topCSRs: []
  });

  // State Tabel 1 (Daftar Prioritas)
  const [currentTab, setCurrentTab] = useState('Knowledge');
  const [currentSort, setSort] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // State Tabel 2 (Perbandingan 3 Bulan Terakhir)
  const [threeMonthData, setThreeMonthData] = useState([]);
  const [monthLabels, setMonthLabels] = useState(['Bulan 1', 'Bulan 2', 'Bulan 3']);
  const [search3M, setSearch3M] = useState('');
  const [sort3M, setSort3M] = useState('asc');
  const [page3M, setPage3M] = useState(1);
  const rowsPerPage3M = 15;

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  
  const [showRegMenu, setShowRegMenu] = useState(false);
  const [showClusterMenu, setShowClusterMenu] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [clusterSearchQuery, setClusterSearchQuery] = useState('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  const chartQmRegRef = useRef(null);
  const chartAskRegRef = useRef(null);
  const chartTrendRef = useRef(null);
  const chartAskLosRef = useRef(null);
  const chartCaseKipRef = useRef(null);
  const chartTop5SubRef = useRef(null);
  const chartBottom5SubRef = useRef(null);
  const chartSubParamsRef = useRef(null);

  const qmRegInst = useRef(null);
  const askRegInst = useRef(null);
  const trendInst = useRef(null);
  const askLosInst = useRef(null);
  const caseKipInst = useRef(null);
  const top5SubInst = useRef(null);
  const bottom5SubInst = useRef(null);
  const subParamsInst = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Cascading Dropdown: Regional -> Cluster -> Unit
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
      setSelectedUnit('ALL');
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

  // Load Data Utama & 3 Bulan Terakhir setiap filter berubah
  useEffect(() => {
    if (globalCsrDb.length > 0) {
      loadTappingData();
      loadThreeMonthComparison();
    }
  }, [startDate, endDate, selectedRegional, selectedCluster, selectedUnit, globalCsrDb]);

  useEffect(() => { setCurrentPage(1); }, [currentTab, currentSort, searchQuery]);
  useEffect(() => { setPage3M(1); }, [search3M, sort3M]);

  const fetchAllFromTable = async (tableName) => {
    let allData = [];
    let limit = 1000;
    let from = 0;
    let to = limit - 1;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from(tableName).select('*').range(from, to);
      if (error) {
        console.error(`Gagal mengambil data dari ${tableName}:`, error);
        break;
      }
      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < limit) keepFetching = false;
        else { from += limit; to += limit; }
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const loadInitialData = async () => {
    try {
      const csrData = await fetchAllFromTable('database_csr');
      setGlobalCsrDb(csrData || []);
    } catch (err) {
      console.error("Gagal load initial data CSR:", err);
    }
  };

  // --- Penarikan Data Tabel Perbandingan 3 Bulan Terakhir (Tunduk pada Filter Regional, Cluster, Unit) ---
  const loadThreeMonthComparison = async () => {
    try {
      const d = new Date();
      const m3Date = new Date(d.getFullYear(), d.getMonth(), 1); 
      const m2Date = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const m1Date = new Date(d.getFullYear(), d.getMonth() - 2, 1);
      
      const toYMD = (dateObj) => `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const formatMonth = (dateObj) => {
        const m = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        return `${m[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
      };
      
      const m1Str = toYMD(m1Date);
      const m2Str = toYMD(m2Date);
      const m3Str = toYMD(m3Date);
      
      setMonthLabels([formatMonth(m1Date), formatMonth(m2Date), formatMonth(m3Date)]);

      const startQ = `${m1Str}-01`;

      let allData = [];
      let maxRecords = 1500;
      let fetchLimit = 1000;
      let from = 0;
      let keepFetching = true;

      while (keepFetching && allData.length < maxRecords) {
        let to = from + fetchLimit - 1;
        if (to >= maxRecords) to = maxRecords - 1;

        const { data, error } = await supabase
          .from('nilai_tapping')
          .select('*')
          .gte('tanggal_assessor', startQ)
          .range(from, to);

        if (error) {
          console.error("Gagal load data 3 bulan dari Supabase:", error);
          break;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < (to - from + 1)) keepFetching = false;
          else from = to + 1;
        } else {
          keepFetching = false;
        }
      }

      const globalCsrMap = {};
      globalCsrDb.forEach(c => {
        const cNik = String(c.nik || c.nik_csr || '').trim();
        if (cNik) {
          globalCsrMap[cNik] = {
            regional: c.regional || c.region || '',
            cluster: c.cluster || c.cluster_name || '',
            unitName: c.unitName || c.unit_name || ''
          };
        }
      });

      const enriched3M = allData.map(row => {
        const nik = String(row.nik || row.nik_csr || '').trim();
        const info = globalCsrMap[nik] || {};
        return {
          ...row,
          lookup_regional: row.regional || info.regional || 'Unknown',
          lookup_cluster: row.cluster || info.cluster || 'Unknown',
          lookup_unit: row.unit_name || info.unitName || 'Unknown'
        };
      });

      const filtered3MData = enriched3M.filter(d => {
        if (selectedRegional !== 'ALL' && d.lookup_regional !== selectedRegional) return false;
        if (selectedCluster !== 'ALL' && d.lookup_cluster !== selectedCluster) return false;
        if (selectedUnit !== 'ALL' && d.lookup_unit !== selectedUnit) return false;
        return true;
      });

      const csrMapGroup = {};
      filtered3MData.forEach(row => {
        const nik = String(row.nik || row.nik_csr || '').trim();
        if (!nik) return;
        
        let dbUnit = row.lookup_unit;
        let nama = row.nama || row.nama_csr || 'Unknown';

        if (!csrMapGroup[nik]) {
          csrMapGroup[nik] = { nama: nama, unit: dbUnit, [m1Str]: [], [m2Str]: [], [m3Str]: [] };
        }
        
        const tgl = (row.tanggal_assessor || '').substring(0, 7);
        if (csrMapGroup[nik][tgl]) {
          csrMapGroup[nik][tgl].push(Number(row.total_nilai) || 0);
        }
      });

      const getAvg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';

      const comparisonList = [];
      Object.keys(csrMapGroup).forEach(nik => {
        const obj = csrMapGroup[nik];
        comparisonList.push({
          nik,
          nama: obj.nama,
          unit: obj.unit,
          avg1: getAvg(obj[m1Str]),
          avg2: getAvg(obj[m2Str]),
          avg3: getAvg(obj[m3Str])
        });
      });

      setThreeMonthData(comparisonList);
    } catch (err) {
      console.error("Gagal memproses data 3 bulan:", err);
    }
  };

  // --- Penarikan Data Utama Dashboard ---
  const loadTappingData = async () => {
    try {
      let allRawData = [];
      let maxRecords = 1500;
      let fetchLimit = 1000;
      let from = 0;
      let keepFetching = true;

      while (keepFetching && allRawData.length < maxRecords) {
        let to = from + fetchLimit - 1;
        if (to >= maxRecords) to = maxRecords - 1;

        let query = supabase.from('nilai_tapping').select('*').range(from, to);

        if (startDate && endDate) {
          query = query.gte('tanggal_assessor', startDate).lte('tanggal_assessor', endDate);
        } else if (startDate) {
          query = query.gte('tanggal_assessor', startDate);
        } else if (endDate) {
          query = query.lte('tanggal_assessor', endDate);
        }

        let { data: tapData, error: tapErr } = await query;
        if (tapErr) {
          console.error("Gagal load data tapping utama dari Supabase:", tapErr);
          break;
        }

        if (tapData && tapData.length > 0) {
          allRawData = allRawData.concat(tapData);
          if (tapData.length < (to - from + 1)) {
            keepFetching = false;
          } else {
            from = to + 1;
          }
        } else {
          keepFetching = false;
        }
      }

      const rawData = allRawData || [];

      const csrMap = {};
      globalCsrDb.forEach(c => {
        const cNik = String(c.nik || c.nik_csr || '').trim();
        if (cNik) {
          csrMap[cNik] = { regional: c.regional || c.region || '', cluster: c.cluster || c.cluster_name || '', unitName: c.unitName || c.unit_name || '' };
        }
      });

      const enrichedTappingData = rawData.map(d => {
        const dNik = String(d.nik || d.nik_csr || '').trim();
        const csrInfo = csrMap[dNik] || {};
        return {
          ...d,
          lookup_regional: d.regional || csrInfo.regional || 'Unknown',
          lookup_cluster: d.cluster || csrInfo.cluster || 'Unknown',
          lookup_unit: d.unit_name || csrInfo.unitName || 'Unknown'
        };
      });

      let filteredData = enrichedTappingData.filter(d => {
        let match = true;
        let rawTgl = d.tanggal_assessor || '';
        let tgl = typeof rawTgl === 'string' ? rawTgl.substring(0, 10) : '';
        if (startDate && tgl < startDate) match = false;
        if (endDate && tgl > endDate) match = false;
        if (selectedRegional !== 'ALL' && d.lookup_regional !== selectedRegional) match = false;
        if (selectedCluster !== 'ALL' && d.lookup_cluster !== selectedCluster) match = false;
        if (selectedUnit !== 'ALL' && d.lookup_unit !== selectedUnit) match = false;
        return match;
      });

      const summary = buildSummary(filteredData);
      setSummaryData(summary);
    } catch (err) {
      console.error("Gagal load data tapping:", err);
    }
  };

  const handleRefreshData = () => {
    loadTappingData();
    loadThreeMonthComparison();
  };

  const buildSummary = (data) => {
    const totalAudit = data.length;
    let sumTotal = 0, sumAtt = 0, sumSkl = 0, sumKnw = 0;
    let underAttitude = 0, underSkill = 0, underKnowledge = 0;
    
    let regMap = {};
    let dateMap = {};
    let losMap = {};
    let kipMap = {};
    
    const paramKeyMap = {
      "Disiplin Kerja": "disiplin_kerja_(attitude)",
      "Penampilan": "penampilan_(attitude)",
      "Etika Pelayanan": "etika_pelayanan_(attitude)",
      "Responsiveness": "responsiveness_(attitude)",
      "Gali Informasi": "gali_informasi_(skill)",
      "Analisa Kebutuhan": "analisa_kebutuhan_(skill)",
      "Kejelasan Informasi": "kejelasan_informasi_(skill)",
      "Holding Time": "holding_time_(skill)",
      "Dokumentasi": "dokumentasi_(skill)",
      "FCR / Eskalasi": "fcr_atau_ketepatan_eskalasi_(knowledge)",
      "Solusi & Konfirmasi": "solusi_&_konfirmasi_(knowledge)",
      "Edukasi Layanan": "edukasi_layanan_(knowledge)",
      "Cross/Upselling": "cross_selling_dan_upselling_(knowledge)"
    };

    let paramSums = {};
    let paramCounts = {};
    Object.keys(paramKeyMap).forEach(lbl => { paramSums[lbl] = 0; paramCounts[lbl] = 0; });

    let coachingList = [];
    let rowIdCounter = 0;

    data.forEach(d => {
      let tNilai = Number(d.total_nilai) || 0;
      let nAtt = Number(d.nilai_attitude) || 0;
      let nSkl = Number(d.nilai_skill) || 0;
      let nKnw = Number(d.nilai_knowledge) || 0;

      sumTotal += tNilai; sumAtt += nAtt; sumSkl += nSkl; sumKnw += nKnw;
      
      if (nAtt < 85) underAttitude++;
      if (nSkl < 80) underSkill++;
      if (nKnw < 80) underKnowledge++;

      let reg = d.lookup_regional || 'Unknown';
      if (!regMap[reg]) regMap[reg] = { regional: reg, sampel: 0, qmSum:0, attSum:0, sklSum:0, knwSum:0 };
      regMap[reg].sampel++; regMap[reg].qmSum += tNilai; regMap[reg].attSum += nAtt; regMap[reg].sklSum += nSkl; regMap[reg].knwSum += nKnw;

      let rawTgl = d.tanggal_assessor || '';
      let tgl = typeof rawTgl === 'string' ? rawTgl.substring(0, 10) : '';
      if (tgl) dateMap[tgl] = (dateMap[tgl] || 0) + 1;

      let los = d.los_csr || 'Unknown';
      if (!losMap[los]) losMap[los] = { los: los, count: 0, attSum:0, sklSum:0, knwSum:0 };
      losMap[los].count++; losMap[los].attSum += nAtt; losMap[los].sklSum += nSkl; losMap[los].knwSum += nKnw;

      let kip = (d.kip_interaction || 'Lainnya').trim();
      if (kip) kipMap[kip] = (kipMap[kip] || 0) + 1;

      Object.keys(paramKeyMap).forEach(label => {
        let colName = paramKeyMap[label];
        let val = Number(d[colName]);
        if (!isNaN(val) && d[colName] !== null && d[colName] !== undefined) {
          paramSums[label] += val;
          paramCounts[label]++;
        }
      });

      coachingList.push({
        id: rowIdCounter++,
        tanggal: tgl,
        nik: d.nik || d.nik_csr || '-',
        nama: d.nama || d.nama_csr || '-',
        unit: d.lookup_unit || '-',
        attitude: nAtt,
        skill: nSkl,
        knowledge: nKnw,
        totalNilai: tNilai,
        isUnderKnowledge: nKnw < 80,
        isUnderAttitude: nAtt < 85,
        isUnderSkill: nSkl < 80,
        linkRekaman: d.link_rekaman || '#',
        rawData: d
      });
    });

    let avgTotal = totalAudit ? (sumTotal/totalAudit) : 0;
    let avgAttitude = totalAudit ? (sumAtt/totalAudit) : 0;
    let avgSkill = totalAudit ? (sumSkl/totalAudit) : 0;
    let avgKnowledge = totalAudit ? (sumKnw/totalAudit) : 0;

    let regionalAnalytics = Object.values(regMap).map(r => ({
      regional: r.regional, sampel: r.sampel, qmScore: r.qmSum/r.sampel, attitude: r.attSum/r.sampel, skill: r.sklSum/r.sampel, knowledge: r.knwSum/r.sampel
    }));

    let dailyTrend = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b)).map(k => ({ date: k, count: dateMap[k] }));

    const losOrder = ["0-6 Bulan", "6-12 Bulan", "12-24 Bulan", "24-36 Bulan", ">36 Bulan"];
    let losAnalytics = Object.values(losMap).map(l => ({
      los: l.los, attitude: l.attSum/l.count, skill: l.sklSum/l.count, knowledge: l.knwSum/l.count
    })).sort((a, b) => {
      let idxA = losOrder.indexOf(a.los);
      let idxB = losOrder.indexOf(b.los);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    let top5CaseKIP = Object.keys(kipMap).map(k => ({ name: k, count: kipMap[k] })).sort((a,b) => b.count - a.count).slice(0,5);

    let subParams = {};
    let subParamsArr = [];
    Object.keys(paramKeyMap).forEach(label => {
      let avg = paramCounts[label] > 0 ? (paramSums[label] / paramCounts[label]) : 0;
      subParams[label] = avg;
      let target = targetMap[label] || 1;
      let percentage = target > 0 ? (avg / target) * 100 : 0;
      subParamsArr.push({ name: label, score: avg, percentage: percentage });
    });

    let top5Sub = [...subParamsArr].sort((a,b) => b.percentage - a.percentage).slice(0,5);
    let bottom5Sub = [...subParamsArr].sort((a,b) => a.percentage - b.percentage).slice(0,5);
    let topCSRs = [...coachingList].sort((a,b) => b.totalNilai - a.totalNilai).slice(0,5);

    return {
      totalAudit, avgTotal: avgTotal.toFixed(1), avgAttitude: avgAttitude.toFixed(1),
      avgSkill: avgSkill.toFixed(1), avgKnowledge: avgKnowledge.toFixed(1),
      underAttitude, underSkill, underKnowledge, regionalAnalytics, dailyTrend,
      losAnalytics, top5CaseKIP, subParams, top5Sub, bottom5Sub, coachingList, topCSRs
    };
  };

  useEffect(() => {
    if (!summaryData.totalAudit && summaryData.coachingList.length === 0) return;

    if (chartQmRegRef.current) {
      if (qmRegInst.current) qmRegInst.current.destroy();
      qmRegInst.current = new Chart(chartQmRegRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.regionalAnalytics.map(d => d.regional),
          datasets: [
            { label: 'Sampel', data: summaryData.regionalAnalytics.map(d => d.sampel), backgroundColor: '#DC2626', borderRadius: 6, barPercentage: 0.85 },
            { label: 'QM Score', data: summaryData.regionalAnalytics.map(d => d.qmScore), backgroundColor: '#4318FF', borderRadius: 6, barPercentage: 0.85 }
          ]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11, weight: '600' } } }, datalabels: { anchor: 'end', align: 'right', font: { size: 10, weight: 'bold' }, formatter: (v, c) => c.datasetIndex === 0 ? v : v.toFixed(1) } },
          scales: { x: { display: false, grace: '30%' }, y: { grid: { display: false } } }
        }
      });
    }

    if (chartAskRegRef.current) {
      if (askRegInst.current) askRegInst.current.destroy();
      askRegInst.current = new Chart(chartAskRegRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.regionalAnalytics.map(d => d.regional),
          datasets: [
            { label: 'Attitude', data: summaryData.regionalAnalytics.map(d => d.attitude), backgroundColor: '#10B981', borderRadius: 6, barPercentage: 0.6 },
            { label: 'Skill', data: summaryData.regionalAnalytics.map(d => d.skill), backgroundColor: '#FFB800', borderRadius: 6, barPercentage: 0.6 },
            { label: 'Knowledge', data: summaryData.regionalAnalytics.map(d => d.knowledge), backgroundColor: '#4318FF', borderRadius: 6, barPercentage: 0.6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11, weight: '600' } } }, datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: v => v.toFixed(1) + '%' } },
          scales: { x: { grid: { display: false } }, y: { display: false, grace: '30%' } }
        }
      });
    }

    if (chartTrendRef.current) {
      if (trendInst.current) trendInst.current.destroy();
      trendInst.current = new Chart(chartTrendRef.current, {
        type: 'line',
        data: {
          labels: summaryData.dailyTrend.map(d => d.date),
          datasets: [{ label: 'Sample Harian', data: summaryData.dailyTrend.map(d => d.count), borderColor: '#DC2626', backgroundColor: 'rgba(220, 38, 38, 0.12)', fill: true, tension: 0.35, pointRadius: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' } } },
          scales: { x: { grid: { display: false }, ticks: { maxRotation: 45 } }, y: { display: false, grace: '30%' } }
        }
      });
    }

    if (chartAskLosRef.current) {
      if (askLosInst.current) askLosInst.current.destroy();
      askLosInst.current = new Chart(chartAskLosRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.losAnalytics.map(d => d.los),
          datasets: [
            { label: 'Attitude', data: summaryData.losAnalytics.map(d => d.attitude), backgroundColor: '#00BAE1', borderRadius: 6 },
            { label: 'Skill', data: summaryData.losAnalytics.map(d => d.skill), backgroundColor: '#10B981', borderRadius: 6 },
            { label: 'Knowledge', data: summaryData.losAnalytics.map(d => d.knowledge), backgroundColor: '#6366F1', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11, weight: '600' } } }, datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: v => v.toFixed(1) + '%' } },
          scales: { x: { grid: { display: false } }, y: { display: false, grace: '30%' } }
        }
      });
    }

    if (chartCaseKipRef.current) {
      if (caseKipInst.current) caseKipInst.current.destroy();
      caseKipInst.current = new Chart(chartCaseKipRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.top5CaseKIP.map(d => d.name),
          datasets: [{ data: summaryData.top5CaseKIP.map(d => d.count), backgroundColor: ['#00875A', '#00A86B', '#00C875', '#22C55E', '#4ADE80'], borderRadius: 6 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', font: { size: 10, weight: 'bold' } } },
          scales: { x: { display: false, grace: '30%' }, y: { grid: { display: false } } }
        }
      });
    }

    if (chartTop5SubRef.current) {
      if (top5SubInst.current) top5SubInst.current.destroy();
      top5SubInst.current = new Chart(chartTop5SubRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.top5Sub.map(d => d.name),
          datasets: [{ data: summaryData.top5Sub.map(d => d.percentage), backgroundColor: ['#DC2626', '#EA580C', '#F97316', '#FB923C', '#FBBF24'], borderRadius: 6 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', font: { size: 10, weight: 'bold' }, formatter: v => v.toFixed(1) + '%' } },
          scales: { x: { display: false, grace: '30%' }, y: { grid: { display: false } } }
        }
      });
    }

    if (chartBottom5SubRef.current) {
      if (bottom5SubInst.current) bottom5SubInst.current.destroy();
      bottom5SubInst.current = new Chart(chartBottom5SubRef.current, {
        type: 'bar',
        data: {
          labels: summaryData.bottom5Sub.map(d => d.name),
          datasets: [{ data: summaryData.bottom5Sub.map(d => d.percentage), backgroundColor: ['#312E81', '#3730A3', '#4318FF', '#6366F1', '#818CF8'], borderRadius: 6 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', font: { size: 10, weight: 'bold' }, formatter: v => v.toFixed(1) + '%' } },
          scales: { x: { display: false, grace: '30%' }, y: { grid: { display: false } } }
        }
      });
    }

    if (chartSubParamsRef.current) {
      const orderedLabels = [
        "Disiplin Kerja", "Penampilan", "Etika Pelayanan", "Responsiveness",
        "Gali Informasi", "Analisa Kebutuhan", "Kejelasan Informasi", "Holding Time", "Dokumentasi",
        "FCR / Eskalasi", "Solusi & Konfirmasi", "Edukasi Layanan", "Cross/Upselling"
      ];
      if (subParamsInst.current) subParamsInst.current.destroy();
      subParamsInst.current = new Chart(chartSubParamsRef.current, {
        type: 'bar',
        data: {
          labels: orderedLabels,
          datasets: [
            { label: 'Pencapaian', data: orderedLabels.map(l => Number(summaryData.subParams[l]) || 0), backgroundColor: '#10B981', borderRadius: 6, barPercentage: 0.85 },
            { label: 'Target Bobot', data: orderedLabels.map(l => targetMap[l] || 20), backgroundColor: '#E01E2E', borderRadius: 6, barPercentage: 0.85 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', align: 'end', labels: { font: { size: 11, weight: '600' }, usePointStyle: true } },
            datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, color: (c) => c.datasetIndex === 0 ? '#047857' : '#B91C1C', formatter: v => v.toFixed(1) }
          },
          scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } }, y: { display: false, grace: '30%' } }
        }
      });
    }
  }, [summaryData]);

  const handleOpenDetail = (record) => {
    setSelectedDetailRecord(record);
    setShowDetailModal(true);
    setIsClosingModal(false);
  };

  const handleCloseDetail = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowDetailModal(false);
      setIsClosingModal(false);
      setSelectedDetailRecord(null);
    }, 200);
  };

  // --- Filtering, Sorting, dan Paging untuk Tabel 1 ---
  let filteredCoaching = summaryData.coachingList.filter(row => {
    if (currentTab === 'Knowledge') return row.isUnderKnowledge;
    if (currentTab === 'Attitude') return row.isUnderAttitude;
    if (currentTab === 'Skill') return row.isUnderSkill;
    return true;
  });

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredCoaching = filteredCoaching.filter(row => String(row.nik).toLowerCase().includes(q) || String(row.nama).toLowerCase().includes(q));
  }

  const sortedCoaching = [...filteredCoaching].sort((a, b) => {
    let valA = currentTab === 'All' ? a.totalNilai : a[currentTab.toLowerCase()];
    let valB = currentTab === 'All' ? b.totalNilai : b[currentTab.toLowerCase()];
    return currentSort === 'asc' ? valA - valB : valB - valA;
  });

  const totalPages = Math.ceil(sortedCoaching.length / rowsPerPage) || 1;
  const paginatedCoaching = sortedCoaching.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // --- Filtering, Sorting, dan Paging untuk Tabel 2 (3 Bulan Terakhir) ---
  let filtered3M = threeMonthData.filter(item => {
    const term = search3M.toLowerCase();
    return String(item.nik).toLowerCase().includes(term) ||
           String(item.nama).toLowerCase().includes(term) ||
           String(item.unit || '').toLowerCase().includes(term);
  });

  filtered3M.sort((a, b) => {
    let valA = a.avg3 === '-' ? -1 : Number(a.avg3);
    let valB = b.avg3 === '-' ? -1 : Number(b.avg3);
    return sort3M === 'asc' ? valA - valB : valB - valA;
  });

  const totalPages3M = Math.ceil(filtered3M.length / rowsPerPage3M) || 1;
  const paginated3M = filtered3M.slice((page3M - 1) * rowsPerPage3M, page3M * rowsPerPage3M);

  const renderDetailParameters = (rawData) => {
    if (!rawData) return null;
    
    const detailPillars = {
      "Attitude": [
        { name: "Disiplin Kerja", col: "detail_disiplin_kerja_(attitude)" },
        { name: "Penampilan", col: "detail_penampilan_(attitude)" },
        { name: "Etika Pelayanan", col: "detail_etika_pelayanan_(attitude)" },
        { name: "Responsiveness", col: "detail_responsiveness_(attitude)" }
      ],
      "Skill": [
        { name: "Gali Informasi", col: "detail_gali_informasi_(skill)" },
        { name: "Analisa Kebutuhan", col: "detail_analisa_kebutuhan_(skill)" },
        { name: "Kejelasan Informasi", col: "detail_kejelasan_informasi_(skill)" },
        { name: "Holding Time", col: "detail_holding_time_(skill)" },
        { name: "Dokumentasi", col: "detail_dokumentasi_(skill)" }
      ],
      "Knowledge": [
        { name: "FCR / Eskalasi", col: "detail_fcr_atau_ketepatan_eskalasi_(knowledge)" },
        { name: "Solusi & Konfirmasi", col: "detail_solusi_&_konfirmasi_(knowledge)" },
        { name: "Edukasi Layanan", col: "detail_edukasi_layanan_(knowledge)" },
        { name: "Cross/Upselling", col: "detail_cross_selling_dan_upselling_(knowledge)" }
      ]
    };

    let pillarElements = [];

    Object.keys(detailPillars).forEach(pillar => {
      let subElements = [];
      const titleColorClass = pillar === 'Attitude' ? 'text-blue-600' : (pillar === 'Skill' ? 'text-rose-600' : 'text-amber-600');
      const badgeBgClass = pillar === 'Attitude' ? 'bg-blue-50 border-blue-200 text-blue-800' : (pillar === 'Skill' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800');
      
      detailPillars[pillar].forEach(sub => {
        let catatan = rawData[sub.col];
        
        if (catatan && typeof catatan === 'string' && catatan.trim() !== '' && catatan.trim() !== '-' && catatan.toLowerCase() !== 'null') {
          let splitCatatan = catatan
            .replace(/;\s*/g, '|||')  
            .replace(/\s-\s/g, '|||')  
            .replace(/([a-zA-Z0-9,.)])\s+(Tidak\s|Ceklis\s|Gagal\s|CSR\s|Kurang\s|Belum\s|Identifikasi\s|Sikap\s|Cara\s|Nada\s|Edukasi\s|Cross\s|Menginformasikan\s|Tanya\s|Proaktif\s|Menyampaikan\s)/g, '$1|||$2')
            .split('|||')
            .filter(c => c.trim() !== '' && c.trim() !== '-');

          subElements.push(
            <li key={sub.name} className="mb-4">
              <div className={`flex items-center space-x-1.5 mb-1.5 p-2 rounded-xl border inline-flex shadow-xs ${badgeBgClass}`}>
                <span className="text-xs ml-0.5"><i className="fa-solid fa-angle-right"></i></span>
                <span className="font-extrabold text-xs pr-2 tracking-tight">Sub Parameter : {sub.name}</span>
              </div>
              <div className="ml-2.5 pl-3 border-l-2 border-slate-200 mt-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">CATATAN TEMUAN :</span>
                <ul className="text-slate-700 text-xs space-y-1.5 leading-relaxed font-semibold">
                  {splitCatatan.map((item, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="font-black text-slate-500 text-xs min-w-[18px]">{idx + 1}.</span>
                      <span className="flex-1">{item.trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        }
      });

      if (subElements.length > 0) {
        pillarElements.push(
          <div key={pillar} className="mb-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h4 className={`font-black border-b border-slate-100 pb-3 text-xs uppercase tracking-wider ${titleColorClass}`}>
              Parameter Utama : {pillar}
            </h4>
            <ul className="space-y-3">{subElements}</ul>
          </div>
        );
      }
    });

    if (pillarElements.length === 0) {
      return (
        <div className="p-6 text-center flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mb-3 shadow-sm">
            <i className="fa-solid fa-check"></i>
          </div>
          <p className="text-slate-800 text-sm font-bold">Tapping Aman!</p>
          <p className="text-slate-500 text-xs mt-1 font-medium">Tidak ada catatan temuan yang perlu ditindaklanjuti pada sampel ini.</p>
        </div>
      );
    }

    return <div className="space-y-4">{pillarElements}</div>;
  };

  return (
    <div className="space-y-6 font-sans relative animate-[fadeInOut_0.3s_ease-in-out]">
      
      {/* Header & Filter Bar */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-md border border-slate-400 space-y-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold border border-red-200 shadow-sm">
              <i className="fa-solid fa-headset"></i>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Sample Tapping Quality CSR</h3>
              <p className="text-xs text-slate-700 font-medium">Evaluasi performa pelayanan CSR berdasarkan indikator Attitude, Skill, dan Knowledge.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); setSelectedRegional('ALL'); setSelectedCluster('ALL'); setSelectedUnit('ALL'); setSearchQuery(''); }} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 border border-slate-300 shadow-sm cursor-pointer">
              <i className="fa-solid fa-rotate-left text-xs"></i>
              <span>Reset Filter</span>
            </button>
            <button onClick={handleRefreshData} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 border border-slate-300 shadow-sm cursor-pointer">
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Cascading Regional -> Cluster -> Unit Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-4 border-t border-slate-400/70 relative z-40">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mulai Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-red-600" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 shadow-inner outline-none focus:border-red-600" />
          </div>

          {/* Regional Dropdown */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Regional</label>
            <button type="button" onClick={() => { setShowRegMenu(!showRegMenu); setShowClusterMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{selectedRegional === 'ALL' ? 'Semua Regional' : selectedRegional}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
            </button>
            <i className="fa-solid fa-map-location-dot absolute left-3.5 top-[31px] text-slate-500 text-xs"></i>

            {showRegMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Regional..." value={regSearchQuery} onChange={e => setRegSearchQuery(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-600" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <div onClick={() => { setSelectedRegional('ALL'); setSelectedCluster('ALL'); setSelectedUnit('ALL'); setShowRegMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">Semua Regional</div>
                  {regionalsList.filter(r => r.toLowerCase().includes(regSearchQuery.toLowerCase())).map((r, i) => (
                    <div key={i} onClick={() => { setSelectedRegional(r); setSelectedCluster('ALL'); setSelectedUnit('ALL'); setShowRegMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">{r}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cluster Dropdown (Cascaded by Regional) */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cluster</label>
            <button type="button" onClick={() => { setShowClusterMenu(!showClusterMenu); setShowRegMenu(false); setShowUnitMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{selectedCluster === 'ALL' ? 'Semua Cluster' : selectedCluster}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
            </button>
            <i className="fa-solid fa-network-wired absolute left-3.5 top-[31px] text-slate-500 text-xs"></i>

            {showClusterMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Cluster..." value={clusterSearchQuery} onChange={e => setClusterSearchQuery(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-600" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <div onClick={() => { setSelectedCluster('ALL'); setSelectedUnit('ALL'); setShowClusterMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">Semua Cluster</div>
                  {clustersList.filter(c => c.toLowerCase().includes(clusterSearchQuery.toLowerCase())).map((c, i) => (
                    <div key={i} onClick={() => { setSelectedCluster(c); setSelectedUnit('ALL'); setShowClusterMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">{c}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Unit Name Dropdown (Cascaded by Regional & Cluster) */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Unit Name</label>
            <button type="button" onClick={() => { setShowUnitMenu(!showUnitMenu); setShowRegMenu(false); setShowClusterMenu(false); }} className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left flex items-center justify-between shadow-inner cursor-pointer">
              <span className="truncate">{selectedUnit === 'ALL' ? 'Semua Unit Name' : selectedUnit}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
            </button>
            <i className="fa-solid fa-building absolute left-3.5 top-[31px] text-slate-500 text-xs"></i>

            {showUnitMenu && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input type="text" placeholder="Cari Unit..." value={unitSearchQuery} onChange={e => setUnitSearchQuery(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-600" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <div onClick={() => { setSelectedUnit('ALL'); setShowUnitMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">Semua Unit Name</div>
                  {unitsList.filter(u => u.toLowerCase().includes(unitSearchQuery.toLowerCase())).map((u, i) => (
                    <div key={i} onClick={() => { setSelectedUnit(u); setShowUnitMenu(false); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">{u}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-slate-300/40 via-slate-200/50 to-slate-50/80 p-4 rounded-3xl border-2 border-slate-400 shadow-md flex items-center justify-between">
          <div><p className="text-[10px] font-black text-slate-700 uppercase">Total Sample</p><h4 className="text-2xl font-black text-slate-950 mt-0.5">{summaryData.totalAudit}</h4><span className="text-[10px] text-slate-700 font-bold">Sample Interaksi</span></div>
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-base"><i className="fa-solid fa-folder-open"></i></div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 via-red-200/40 to-red-50/80 p-4 rounded-3xl border-2 border-red-300 shadow-md flex items-center justify-between">
          <div><p className="text-[10px] font-black text-red-700 uppercase">Avg QM Score</p><h4 className="text-2xl font-black text-red-950 mt-0.5">{summaryData.avgTotal}%</h4><span className="text-[9px] text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded font-black">Target: ≥ 85.0%</span></div>
          <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center text-base"><i className="fa-solid fa-award"></i></div>
        </div>
        <div className="bg-gradient-to-br from-blue-400/25 via-blue-200/40 to-blue-50/80 p-4 rounded-3xl border-2 border-blue-300 shadow-md flex items-center justify-between">
          <div><p className="text-[10px] font-black text-blue-800 uppercase">Avg Attitude</p><h4 className="text-2xl font-black text-blue-950 mt-0.5">{summaryData.avgAttitude}%</h4><span className="text-[10px] text-blue-800 font-bold">Attitude Pillar</span></div>
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-base"><i className="fa-solid fa-heart-pulse"></i></div>
        </div>
        <div className="bg-gradient-to-br from-rose-400/25 via-rose-200/40 to-rose-50/80 p-4 rounded-3xl border-2 border-rose-300 shadow-md flex items-center justify-between">
          <div><p className="text-[10px] font-black text-rose-800 uppercase">Avg Skill</p><h4 className="text-2xl font-black text-rose-950 mt-0.5">{summaryData.avgSkill}%</h4><span className="text-[10px] text-rose-800 font-bold">Skill Pillar</span></div>
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-base"><i className="fa-solid fa-bolt"></i></div>
        </div>
        <div className="bg-gradient-to-br from-amber-400/25 via-amber-200/40 to-amber-50/80 p-4 rounded-3xl border-2 border-amber-300 shadow-md flex items-center justify-between">
          <div><p className="text-[10px] font-black text-amber-900 uppercase">Avg Knowledge</p><h4 className="text-2xl font-black text-amber-950 mt-0.5">{summaryData.avgKnowledge}%</h4><span className="text-[10px] text-amber-800 font-bold">Knowledge Pillar</span></div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-base"><i className="fa-solid fa-brain"></i></div>
        </div>
      </div>

      {/* Charts Grid 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-bold border border-indigo-100 shadow-sm">
              <i className="fa-solid fa-chart-bar"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">QM Score Per Regional</h4>
              <p className="text-xs text-slate-500">Perbandingan Jumlah Sampel vs Skor QM per Regional</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartQmRegRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base font-bold border border-emerald-100 shadow-sm">
              <i className="fa-solid fa-chart-column"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Achievement ASK by People</h4>
              <p className="text-xs text-slate-500">Pencapaian pilar Attitude, Skill, dan Knowledge per Regional</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartAskRegRef}></canvas></div>
        </div>
      </div>

      {/* Charts Grid 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-base font-bold border border-red-100 shadow-sm">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Trend Sample Harian</h4>
              <p className="text-xs text-slate-500">Pergerakan volume sampel interaksi harian</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartTrendRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-base font-bold border border-cyan-100 shadow-sm">
              <i className="fa-solid fa-user-clock"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Achievement ASK by LOS (Masa Kerja)</h4>
              <p className="text-xs text-slate-500">Pencapaian pilar berdasarkan pengalaman masa kerja CSR</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartAskLosRef}></canvas></div>
        </div>
      </div>

      {/* Charts Grid 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base font-bold border border-emerald-100 shadow-sm">
              📋
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Top 5 Case KIP Interaction</h4>
              <p className="text-xs text-slate-500">Kasus interaksi terbanyak</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartCaseKipRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-base font-bold border border-orange-100 shadow-sm">
              🔥
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Top 5 Sub Parameter</h4>
              <p className="text-xs text-slate-500">Parameter dengan pencapaian tertinggi (%)</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartTop5SubRef}></canvas></div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-bold border border-indigo-100 shadow-sm">
              ❄️
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Bottom 5 Sub Parameter</h4>
              <p className="text-xs text-slate-500">Parameter dengan pencapaian terendah (%)</p>
            </div>
          </div>
          <div className="relative h-80"><canvas ref={chartBottom5SubRef}></canvas></div>
        </div>
      </div>

      {/* Main Bar vs Target & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-base font-bold border border-red-100 shadow-sm">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Perbandingan Pencapaian vs Target Bobot Parameter (%)</h4>
              <p className="text-xs text-slate-500">Evaluasi langsung hasil sampling terhadap standar 13 parameter</p>
            </div>
          </div>
          <div className="relative h-[480px]"><canvas ref={chartSubParamsRef}></canvas></div>
        </div>
        <div className="flex flex-col justify-between space-y-5 h-full">
          <div className="bg-gradient-to-br from-amber-500/20 via-amber-200/40 to-amber-50/80 p-5 rounded-3xl border-2 border-amber-400 shadow-md space-y-3.5">
            <div className="flex items-center space-x-2.5 border-b border-amber-200 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                <i className="fa-solid fa-user-xmark"></i>
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950">Sample Under Performance</h4>
                <p className="text-[10px] font-bold text-amber-900">Di bawah standar kelulusan parameter</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-white rounded-2xl border border-blue-300 text-center"><span className="text-[10px] font-black text-blue-800 uppercase">Attitude</span><h5 className="text-xl font-black text-blue-950 my-1">{summaryData.underAttitude}</h5></div>
              <div className="p-3 bg-white rounded-2xl border border-rose-300 text-center"><span className="text-[10px] font-black text-rose-800 uppercase">Skill</span><h5 className="text-xl font-black text-rose-950 my-1">{summaryData.underSkill}</h5></div>
              <div className="p-3 bg-white rounded-2xl border border-amber-300 text-center"><span className="text-[10px] font-black text-amber-900 uppercase">Knowledge</span><h5 className="text-xl font-black text-amber-950 my-1">{summaryData.underKnowledge}</h5></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 via-emerald-200/40 to-emerald-50/80 p-5 rounded-3xl border-2 border-emerald-400 shadow-md space-y-3 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                  <i className="fa-solid fa-trophy"></i>
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950">Top 5 Performance</h4>
                  <p className="text-[10px] font-bold text-emerald-900">Total skor tertinggi</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {summaryData.topCSRs.map((csr, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="overflow-hidden"><p className="text-xs font-bold text-slate-900 truncate">{csr.nama}</p><p className="text-[10px] text-slate-600 truncate">{csr.nik} • {csr.unit}</p></div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">{csr.totalNilai.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabel 1: Daftar Prioritas Coaching */}
      <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base">⚠️</span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Daftar Prioritas Coaching CSR</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Menampilkan maksimal {rowsPerPage} SDM per slide halaman (Total under target {currentTab}: {filteredCoaching.length} data).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </span>
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Cari SIAD / Nama CSR..." 
                className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-red-600 shadow-sm w-52 transition" 
              />
            </div>
            <div className="flex items-center bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 shadow-inner gap-1">
              <button onClick={() => setCurrentTab('Knowledge')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${currentTab === 'Knowledge' ? 'bg-red-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}><span>🎯</span><span>Knowledge Kritis</span></button>
              <button onClick={() => setCurrentTab('Attitude')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${currentTab === 'Attitude' ? 'bg-red-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}><span>❤️</span><span>Attitude Kritis</span></button>
              <button onClick={() => setCurrentTab('Skill')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${currentTab === 'Skill' ? 'bg-red-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}><span>🧠</span><span>Skill Kritis</span></button>
              <div className="w-px h-4 bg-slate-300 mx-0.5"></div>
              <button onClick={() => setCurrentTab('All')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${currentTab === 'All' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}><span>🌟</span><span>All Data</span></button>
            </div>
            <div className="flex items-center space-x-1 bg-slate-200/80 px-3 py-1.5 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-700 shadow-inner">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Urutkan:</span>
              <button onClick={() => setSort('asc')} className={`px-2.5 py-1 rounded-xl text-xs transition ${currentSort === 'asc' ? 'bg-red-600 text-white font-bold shadow-sm' : 'hover:text-slate-900'}`}>Terendah dulu</button>
              <button onClick={() => setSort('desc')} className={`px-2.5 py-1 rounded-xl text-xs transition ${currentSort === 'desc' ? 'bg-red-600 text-white font-bold shadow-sm' : 'hover:text-slate-900'}`}>Tertinggi dulu</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-blue-900 to-blue-600 text-[11px] font-black text-white uppercase tracking-wider shadow-md">
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Unit / GraPARI</th>
                <th className="py-3.5 px-4">{currentTab === 'All' ? 'Target QM' : currentTab}</th>
                <th className="py-3.5 px-4">Total Nilai</th>
                <th className="py-3.5 px-4 text-center">Aksi / Tinjauan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800 bg-white">
              {paginatedCoaching.length === 0 ? (
                <tr><td colSpan="7" className="py-8 text-center text-slate-500 italic">Tidak ada data CSR yang cocok dengan kriteria pencarian.</td></tr>
              ) : (
                paginatedCoaching.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">{row.tanggal}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nik}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nama}</td>
                    <td className="py-3.5 px-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200">{row.unit}</span></td>
                    <td className={`py-3.5 px-4 font-black ${currentTab === 'All' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {currentTab === 'All' ? '85%' : row[currentTab.toLowerCase()].toFixed(1) + '%'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.totalNilai.toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => handleOpenDetail(row)} className="w-7 h-7 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 flex items-center justify-center transition shadow-sm cursor-pointer" title="Lihat Detail Temuan">
                          <i className="fa-solid fa-eye text-xs"></i>
                        </button>
                        <a href={row.linkRekaman} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold border border-red-200 flex items-center space-x-1 transition shadow-sm">
                          <i className="fa-solid fa-headphones text-xs"></i>
                          <span>Rekaman</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
          <p className="text-xs text-slate-600 font-medium">Menampilkan halaman {currentPage} dari {totalPages} (Total {sortedCoaching.length} data)</p>
          <div className="flex items-center space-x-2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition">Sebelumnya</button>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition">Berikutnya</button>
          </div>
        </div>
      </div>

      {/* --- TABEL 2: PERBANDINGAN TREND TOTAL NILAI 3 BULAN TERAKHIR (Dipengaruhi Filter Regional, Cluster, Unit) --- */}
      <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold shadow-sm">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Perbandingan Performa CSR (3 Bulan Terakhir)</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Memantau trend pergerakan rata-rata total nilai QM seluruh CSR per bulan.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </span>
              <input 
                type="text" 
                value={search3M} 
                onChange={e => setSearch3M(e.target.value)} 
                placeholder="Cari SIAD, Nama, Unit..." 
                className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-600 shadow-sm w-52 transition" 
              />
            </div>
            
            <div className="flex items-center space-x-1 bg-slate-200/80 px-3 py-1.5 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-700 shadow-inner">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Urutkan (Bulan Terbaru):</span>
              <button onClick={() => setSort3M('asc')} className={`px-2.5 py-1 rounded-xl text-xs transition ${sort3M === 'asc' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-slate-900'}`}>Terendah</button>
              <button onClick={() => setSort3M('desc')} className={`px-2.5 py-1 rounded-xl text-xs transition ${sort3M === 'desc' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-slate-900'}`}>Tertinggi</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-indigo-900 to-indigo-600 text-[11px] font-black text-white uppercase tracking-wider shadow-md">
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama CSR</th>
                <th className="py-3.5 px-4">Unit / GraPARI</th>
                <th className="py-3.5 px-4">{monthLabels[0]}</th>
                <th className="py-3.5 px-4">{monthLabels[1]}</th>
                <th className="py-3.5 px-4">{monthLabels[2]} (Terbaru)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800 bg-white">
              {paginated3M.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500 italic">
                    Data tidak ditemukan berdasarkan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginated3M.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nik}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.nama}</td>
                    <td className="py-3.5 px-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 shadow-xs">{row.unit}</span></td>
                    <td className={`py-3.5 px-4 font-black ${row.avg1 === '-' ? 'text-slate-400' : Number(row.avg1) < 85 ? 'text-red-600' : 'text-emerald-600'}`}>{row.avg1 === '-' ? '-' : `${row.avg1}%`}</td>
                    <td className={`py-3.5 px-4 font-black ${row.avg2 === '-' ? 'text-slate-400' : Number(row.avg2) < 85 ? 'text-red-600' : 'text-emerald-600'}`}>{row.avg2 === '-' ? '-' : `${row.avg2}%`}</td>
                    <td className={`py-3.5 px-4 font-black ${row.avg3 === '-' ? 'text-slate-400' : Number(row.avg3) < 85 ? 'text-red-600' : 'text-emerald-600'}`}>{row.avg3 === '-' ? '-' : `${row.avg3}%`}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
          <p className="text-xs text-slate-600 font-medium">Menampilkan halaman {page3M} dari {totalPages3M} (Total {filtered3M.length} data CSR)</p>
          <div className="flex items-center space-x-2">
            <button disabled={page3M <= 1} onClick={() => setPage3M(p => p - 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition">Sebelumnya</button>
            <button disabled={page3M >= totalPages3M} onClick={() => setPage3M(p => p + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition">Berikutnya</button>
          </div>
        </div>
      </div>

      {/* Modal Resume Detail Temuan */}
      {showDetailModal && selectedDetailRecord && ReactDOM.createPortal(
        <div className={`fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity duration-200 flex items-center justify-center z-[99999] p-4 ${isClosingModal ? 'opacity-0' : 'animate-[fadeIn_0.2s_ease-out_forwards]'}`} onClick={handleCloseDetail}>
          <div className={`bg-slate-100 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-300 transition-all duration-200 ${isClosingModal ? 'scale-95 opacity-0' : 'animate-[scaleUp_0.2s_ease-out_forwards]'}`} onClick={e => e.stopPropagation()}>
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between relative shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold shadow-sm">
                  <i className="fa-solid fa-file-lines"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Resume Detail Temuan</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-[11px] font-semibold text-slate-500">
                      {selectedDetailRecord.nama} ({selectedDetailRecord.nik}) - {selectedDetailRecord.tanggal}
                    </p>
                    {selectedDetailRecord.rawData?.kip_interaction && selectedDetailRecord.rawData.kip_interaction.trim() !== '' && selectedDetailRecord.rawData.kip_interaction.trim() !== '-' && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[9px] font-black tracking-wide uppercase shadow-sm">
                        KIP: {selectedDetailRecord.rawData.kip_interaction}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleCloseDetail} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 flex items-center justify-center transition cursor-pointer">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {renderDetailParameters(selectedDetailRecord.rawData)}
            </div>
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-end shadow-inner">
              <button onClick={handleCloseDetail} className="px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}