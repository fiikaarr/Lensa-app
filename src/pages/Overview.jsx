import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Overview() {
  const [globalCsrDb, setGlobalCsrDb] = useState([]);
  const [globalTappingDb, setGlobalTappingDb] = useState([]);
  const [globalTryoutDb, setGlobalTryoutDb] = useState([]);
  const [globalCoachingDb, setGlobalCoachingDb] = useState([]);
  const [loading, setLoading] = useState(false);

  // Default Periode Bulan Berjalan (Format: YYYY-MM)
  const currentDate = new Date();
  const defaultYear = currentDate.getFullYear();
  const defaultMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const [inputPeriode, setInputPeriode] = useState(`${defaultYear}-${defaultMonth}`);

  const monthsMap = {
    "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
    "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
    "09": "September", "10": "Oktober", "11": "November", "12": "Desember"
  };

  // State Filter Hirarki
  const [regionalVal, setRegionalVal] = useState('ALL');
  const [regionalLabel, setRegionalLabel] = useState('Semua Regional');
  const [clusterVal, setClusterVal] = useState('ALL');
  const [clusterLabel, setClusterLabel] = useState('Semua Cluster');
  const [unitVal, setUnitVal] = useState('ALL');
  const [unitLabel, setUnitLabel] = useState('Semua Unit Name');

  // State Dropdown Menus & Search
  const [isRegMenuOpen, setIsRegMenuOpen] = useState(false);
  const [isClusterMenuOpen, setIsClusterMenuOpen] = useState(false);
  const [isUnitMenuOpen, setIsUnitMenuOpen] = useState(false);
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [clusterSearchQuery, setClusterSearchQuery] = useState('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  // State Metrics Hasil Perhitungan
  const [avgScore, setAvgScore] = useState('--%');
  const [totalAudit, setTotalAudit] = useState('--');
  const [tryoutScore, setTryoutScore] = useState('--');
  const [tryoutPassrate, setTryoutPassrate] = useState('--% Tingkat Kelulusan');
  const [coachingTotal, setCoachingTotal] = useState('--');
  const [coachingTop, setCoachingTop] = useState('Temuan: --');

  // Pillar & Bottom Parameters State
  const [attVal, setAttVal] = useState(0);
  const [sklVal, setSklVal] = useState(0);
  const [knwVal, setKnwVal] = useState(0);
  const [bottomParams, setBottomParams] = useState([]);

  const targetMap = {
    "disiplin kerja": 10, "penampilan": 35, "etika pelayanan": 35, "responsiveness": 20,
    "gali informasi": 30, "analisa kebutuhan": 15, "kejelasan informasi": 15, "holding time": 10,
    "dokumentasi": 30, "fcr atau ketepatan eskalasi": 30, "fcr / eskalasi": 30, 
    "solusi & konfirmasi": 30, "edukasi layanan": 20, "cross selling dan upselling": 20, "cross/upselling": 20
  };

  useEffect(() => {
    loadOverviewData();
  }, []);

  useEffect(() => {
    if (globalCsrDb.length > 0 || globalTappingDb.length > 0) {
      computeAndRenderOverview();
    }
  }, [inputPeriode, regionalVal, clusterVal, unitVal, globalCsrDb, globalTappingDb, globalTryoutDb, globalCoachingDb]);

  // Fungsi helper untuk mengambil SEMUA baris data tanpa batas 1000 baris
  const fetchAllFromTable = async (tableName) => {
    let allData = [];
    let limit = 1000;
    let from = 0;
    let to = limit - 1;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to);

      if (error) {
        console.error(`Gagal mengambil data dari ${tableName}:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < limit) {
          keepFetching = false;
        } else {
          from += limit;
          to += limit;
        }
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [csrData, tapData, tryData, coachData] = await Promise.all([
        fetchAllFromTable('database_csr'),
        fetchAllFromTable('nilai_tapping'),
        fetchAllFromTable('nilai_to'),
        fetchAllFromTable('database_coaching')
      ]);

      setGlobalCsrDb(csrData);
      setGlobalTappingDb(tapData);
      setGlobalTryoutDb(tryData);
      setGlobalCoachingDb(coachData);
    } catch (err) {
      console.error("Gagal load data overview dari Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetOverviewFilters = () => {
    setInputPeriode(`${defaultYear}-${defaultMonth}`);
    setRegionalVal('ALL');
    setRegionalLabel('Semua Regional');
    setClusterVal('ALL');
    setClusterLabel('Semua Cluster');
    setUnitVal('ALL');
    setUnitLabel('Semua Unit Name');
  };

  const formatToPercent = (val) => {
    let num = Number(val) || 0;
    if (num > 0 && num <= 1) {
      num = num * 100;
    }
    return num.toFixed(1) + '%';
  };

  const computeAndRenderOverview = () => {
    const [selYear, selMonthNum] = inputPeriode ? inputPeriode.split('-') : [String(defaultYear), defaultMonth];
    const selMonthName = monthsMap[selMonthNum] || '';

    // 1. Filter NIK berdasarkan Hirarki (Regional -> Cluster -> Unit Name) dari seluruh data
    let filteredNikSet = new Set();
    globalCsrDb.forEach(c => {
      const cReg = c.regional || c.region || '';
      const cCluster = c.cluster || c.cluster_name || '';
      const cUnit = c.unitName || c.unit_name || '';
      const cNik = String(c.nik || c.nik_csr || '').trim();

      const matchReg = (regionalVal === 'ALL' || cReg === regionalVal);
      const matchCluster = (clusterVal === 'ALL' || cCluster === clusterVal);
      const matchUnit = (unitVal === 'ALL' || cUnit === unitVal);

      if (matchReg && matchCluster && matchUnit && cNik) {
        filteredNikSet.add(cNik);
      }
    });

    const isValidNik = (nik) => (regionalVal === 'ALL' && clusterVal === 'ALL' && unitVal === 'ALL') || filteredNikSet.has(String(nik).trim());

    // 2. Filter Tapping dari seluruh data
    let filteredTapping = globalTappingDb.filter(t => {
      let rawTgl = t.tanggal_assessor || t.tanggal || t.date || '';
      const tNik = String(t.nik || t.nik_csr || '').trim();

      let matchPeriod = true;
      if (rawTgl) {
        const tDateStr = String(rawTgl).substring(0, 7);
        matchPeriod = (tDateStr === inputPeriode);
      } else if (t.tahun && t.bulan) {
        matchPeriod = (String(t.tahun) === selYear && (t.bulan === selMonthName || t.bulan === selMonthNum));
      }

      return matchPeriod && isValidNik(tNik);
    });

    let countAudit = filteredTapping.length;
    let sumTotal = 0, sumAtt = 0, sumSkl = 0, sumKnw = 0;
    let subParamSums = {};
    let subParamCounts = {};

    filteredTapping.forEach(t => {
      const tot = Number(t.total_nilai || t.total_score || t.totalScore || t.score || 0);
      const att = Number(t.nilai_attitude || t.attitude || t.attitude_score || 0);
      const skl = Number(t.nilai_skill || t.skill || t.skill_score || 0);
      const knw = Number(t.nilai_knowledge || t.knowledge || t.knowledge_score || 0);

      sumTotal += tot;
      sumAtt += att;
      sumSkl += skl;
      sumKnw += knw;

      Object.keys(t).forEach(k => {
        if (!['id', 'tanggal', 'tanggal_assessor', 'date', 'nik', 'nik_csr', 'nama', 'nama_csr', 'region', 'regional', 'unit', 'unit_name', 'cluster', 'total_nilai', 'total_score', 'totalScore', 'score', 'nilai_attitude', 'nilai_skill', 'nilai_knowledge', 'attitude', 'skill', 'knowledge', 'tahun', 'bulan', 'minggu_ke'].includes(k)) {
          let val = Number(t[k]);
          if (!isNaN(val) && t[k] !== null) {
            subParamSums[k] = (subParamSums[k] || 0) + val;
            subParamCounts[k] = (subParamCounts[k] || 0) + 1;
          }
        }
      });
    });

    const avgT = countAudit > 0 ? (sumTotal / countAudit) : 0;
    const avgA = countAudit > 0 ? (sumAtt / countAudit) : 0;
    const avgS = countAudit > 0 ? (sumSkl / countAudit) : 0;
    const avgK = countAudit > 0 ? (sumKnw / countAudit) : 0;

    // 3. Filter Try Out dari seluruh data
    let filteredTryout = globalTryoutDb.filter(tr => {
      const trNik = String(tr.nik || tr.nik_csr || '').trim();
      const trYear = String(tr.tahun || '');
      const trBulan = tr.bulan;
      const matchPeriod = (trYear === selYear && (trBulan === selMonthName || trBulan === selMonthNum));
      return matchPeriod && isValidNik(trNik);
    });
    let tryoutScores = filteredTryout.map(tr => Number(tr.score || tr.nilai || 0));
    let avgTry = tryoutScores.length > 0 ? (tryoutScores.reduce((a, b) => a + b, 0) / tryoutScores.length) : 0;
    let passTryoutCount = filteredTryout.filter(tr => (Number(tr.score || tr.nilai || 0) >= 75)).length;
    let tryPassRate = filteredTryout.length > 0 ? ((passTryoutCount / filteredTryout.length) * 100).toFixed(1) : '0.0';

    // 4. Filter Coaching dari seluruh data
    let filteredCoaching = globalCoachingDb.filter(ch => {
      const chNik = String(ch.nik || ch.nik_csr || '').trim();
      return isValidNik(chNik);
    });
    let coachTotal = filteredCoaching.length;
    let findingCounts = {};
    filteredCoaching.forEach(ch => {
      let ar = ch.area || ch.area_temuan || 'Lainnya';
      findingCounts[ar] = (findingCounts[ar] || 0) + 1;
    });
    let topFnd = Object.entries(findingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    setAvgScore(formatToPercent(avgT));
    setTotalAudit(countAudit);
    setTryoutScore(avgTry.toFixed(1));
    setTryoutPassrate(tryPassRate + "% Tingkat Kelulusan");
    setCoachingTotal(coachTotal);
    setCoachingTop("Temuan: " + topFnd);

    const aVal = avgA > 0 && avgA <= 1 ? avgA * 100 : avgA;
    const sVal = avgS > 0 && avgS <= 1 ? avgS * 100 : avgS;
    const kVal = avgK > 0 && avgK <= 1 ? avgK * 100 : avgK;

    setAttVal(aVal);
    setSklVal(sVal);
    setKnwVal(kVal);

    let subParamsArray = Object.keys(subParamSums).map(key => {
      let count = subParamCounts[key];
      let avg = count > 0 ? (subParamSums[key] / count) : 0;
      let readableName = key.replace(/_/g, ' ').replace(/\(.*\)/, '').trim().toLowerCase();
      let target = targetMap[readableName] || 20; 
      let percentage = target > 0 ? (avg / target) * 100 : 0;
      let displayName = key.replace(/_/g, ' ').replace(/\(.*\)/, '').trim();
      return { name: displayName || key, score: percentage };
    }).sort((a, b) => a.score - b.score).slice(0, 3);

    setBottomParams(subParamsArray);
  };

  // Dinamis Options untuk Dropdown Hirarki dari seluruh data CSR
  const regionals = [...new Set(globalCsrDb.map(i => i.regional || i.region).filter(Boolean))].sort();
  
  let filteredCsrForCluster = globalCsrDb;
  if (regionalVal && regionalVal !== 'ALL') {
    filteredCsrForCluster = globalCsrDb.filter(i => (i.regional || i.region) === regionalVal);
  }
  const clusters = [...new Set(filteredCsrForCluster.map(i => i.cluster || i.cluster_name).filter(Boolean))].sort();

  let filteredCsrForUnit = filteredCsrForCluster;
  if (clusterVal && clusterVal !== 'ALL') {
    filteredCsrForUnit = filteredCsrForCluster.filter(i => (i.cluster || i.cluster_name) === clusterVal);
  }
  const units = [...new Set(filteredCsrForUnit.map(i => i.unitName || i.unit_name).filter(Boolean))].sort();

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header & Professional Metallic Gray Gradient Filter Bar */}
      <div className="bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-400 p-6 rounded-3xl shadow-[0_15px_35px_-5px_rgba(100,116,139,0.35)] border border-slate-400/80 space-y-5 relative">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Executive Overview</h3>
            <p className="text-xs text-slate-700 font-medium">Ringkasan performa kualitas pelayanan operasional secara menyeluruh.</p>
          </div>
          <div className="flex items-center space-x-2.5">
            <button 
              onClick={resetOverviewFilters} 
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition border border-slate-300 shadow-sm cursor-pointer backdrop-blur-md"
            >
              <i className="fa-solid fa-rotate-left text-xs"></i>
              <span>Reset Filter</span>
            </button>
            <button 
              onClick={loadOverviewData} 
              disabled={loading}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 transition shadow-md shadow-red-600/30 border border-red-400/30 cursor-pointer disabled:opacity-50"
            >
              <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`}></i>
              <span>{loading ? 'Memuat Data...' : 'Update Data'}</span>
            </button>
          </div>
        </div>

        {/* Filter Control Bar: Periode -> Regional -> Cluster -> Unit Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-slate-400/70 relative z-40">
          
          {/* 1. Filter Periode (Tahun - Bulan) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Periode (Tahun - Bulan)</label>
            <div className="relative">
              <input 
                type="month" 
                value={inputPeriode} 
                onChange={(e) => setInputPeriode(e.target.value)} 
                className="w-full pl-9 pr-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 transition cursor-pointer shadow-sm" 
              />
              <i className="fa-regular fa-calendar absolute left-3.5 top-3 text-xs text-slate-400 pointer-events-none"></i>
            </div>
          </div>

          {/* 2. Custom Dropdown Regional */}
          <div className="relative z-50">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Regional</label>
            <button 
              type="button" 
              onClick={() => { setIsRegMenuOpen(!isRegMenuOpen); setIsClusterMenuOpen(false); setIsUnitMenuOpen(false); }} 
              className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-red-600 transition flex items-center justify-between shadow-inner cursor-pointer"
            >
              <span className="truncate">{regionalLabel}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-map-location-dot absolute left-3.5 top-[31px] text-slate-500 text-xs pointer-events-none"></i>

            {isRegMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input 
                    type="text" 
                    placeholder="Cari Regional..." 
                    value={regSearchQuery} 
                    onChange={(e) => setRegSearchQuery(e.target.value)} 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600" 
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  <div 
                    onClick={() => {
                      setRegionalVal('ALL');
                      setRegionalLabel('Semua Regional');
                      setClusterVal('ALL');
                      setClusterLabel('Semua Cluster');
                      setUnitVal('ALL');
                      setUnitLabel('Semua Unit Name');
                      setIsRegMenuOpen(false);
                    }} 
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                  >
                    Semua Regional
                  </div>
                  {regionals
                    .filter(r => r.toLowerCase().includes(regSearchQuery.toLowerCase()))
                    .map(r => (
                      <div 
                        key={r}
                        onClick={() => {
                          setRegionalVal(r);
                          setRegionalLabel(r);
                          setClusterVal('ALL');
                          setClusterLabel('Semua Cluster');
                          setUnitVal('ALL');
                          setUnitLabel('Semua Unit Name');
                          setIsRegMenuOpen(false);
                        }} 
                        className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                      >
                        {r}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Custom Dropdown Cluster */}
          <div className="relative z-50">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cluster</label>
            <button 
              type="button" 
              onClick={() => { setIsClusterMenuOpen(!isClusterMenuOpen); setIsRegMenuOpen(false); setIsUnitMenuOpen(false); }} 
              className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-red-600 transition flex items-center justify-between shadow-inner cursor-pointer"
            >
              <span className="truncate">{clusterLabel}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-network-wired absolute left-3.5 top-[31px] text-slate-500 text-xs pointer-events-none"></i>

            {isClusterMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input 
                    type="text" 
                    placeholder="Cari Cluster..." 
                    value={clusterSearchQuery} 
                    onChange={(e) => setClusterSearchQuery(e.target.value)} 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600" 
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  <div 
                    onClick={() => {
                      setClusterVal('ALL');
                      setClusterLabel('Semua Cluster');
                      setUnitVal('ALL');
                      setUnitLabel('Semua Unit Name');
                      setIsClusterMenuOpen(false);
                    }} 
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                  >
                    Semua Cluster
                  </div>
                  {clusters
                    .filter(c => c.toLowerCase().includes(clusterSearchQuery.toLowerCase()))
                    .map(c => (
                      <div 
                        key={c}
                        onClick={() => {
                          setClusterVal(c);
                          setClusterLabel(c);
                          setUnitVal('ALL');
                          setUnitLabel('Semua Unit Name');
                          setIsClusterMenuOpen(false);
                        }} 
                        className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                      >
                        {c}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Custom Dropdown Unit Name */}
          <div className="relative z-50">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Unit Name</label>
            <button 
              type="button" 
              onClick={() => { setIsUnitMenuOpen(!isUnitMenuOpen); setIsRegMenuOpen(false); setIsClusterMenuOpen(false); }} 
              className="w-full pl-9 pr-8 py-2.5 bg-white hover:bg-slate-50 border border-slate-400/80 rounded-2xl text-xs font-semibold text-slate-800 text-left focus:outline-none focus:border-red-600 transition flex items-center justify-between shadow-inner cursor-pointer"
            >
              <span className="truncate">{unitLabel}</span>
              <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-3"></i>
            </button>
            <i className="fa-solid fa-building absolute left-3.5 top-[31px] text-slate-500 text-xs pointer-events-none"></i>

            {isUnitMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden p-2 space-y-1">
                <div className="p-1 border-b border-slate-100 mb-1">
                  <input 
                    type="text" 
                    placeholder="Cari Unit Name..." 
                    value={unitSearchQuery} 
                    onChange={(e) => setUnitSearchQuery(e.target.value)} 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600" 
                  />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                  <div 
                    onClick={() => {
                      setUnitVal('ALL');
                      setUnitLabel('Semua Unit Name');
                      setIsUnitMenuOpen(false);
                    }} 
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                  >
                    Semua Unit Name
                  </div>
                  {units
                    .filter(u => u.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                    .map(u => (
                      <div 
                        key={u}
                        onClick={() => {
                          setUnitVal(u);
                          setUnitLabel(u);
                          setIsUnitMenuOpen(false);
                        }} 
                        className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:font-bold cursor-pointer transition"
                      >
                        {u}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Scorecards KPI Utama Overview dengan Efek 3D */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Overall Quality Score */}
        <div className="bg-gradient-to-tr from-red-700 via-rose-600 to-red-400 p-5 rounded-3xl shadow-[0_15px_30px_-5px_rgba(225,29,72,0.4)] border border-red-400/40 relative overflow-hidden flex flex-col justify-between text-white transform transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_-5px_rgba(225,29,72,0.6)] cursor-pointer">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-sm">OVERALL QUALITY SCORE</p>
            <div className="w-8 h-8 rounded-xl bg-white/25 text-white flex items-center justify-center text-xs backdrop-blur-md shadow-inner">
              <i className="fa-solid fa-award"></i>
            </div>
          </div>
          <div className="my-2 relative z-10">
            <h4 className="text-3xl font-black tracking-tight drop-shadow-md">{avgScore}</h4>
          </div>
          <p className="text-[11px] font-medium text-white/95 relative z-10">Gabungan Attitude, Skill, Knowledge</p>
        </div>

        {/* Card 2: Total Sampel Tapping */}
        <div className="bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-400 p-5 rounded-3xl shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)] border border-blue-400/40 relative overflow-hidden flex flex-col justify-between text-white transform transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_-5px_rgba(37,99,235,0.6)] cursor-pointer">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-sm">TOTAL SAMPEL TAPPING</p>
            <div className="w-8 h-8 rounded-xl bg-white/25 text-white flex items-center justify-center text-xs backdrop-blur-md shadow-inner">
              <i className="fa-solid fa-folder-open"></i>
            </div>
          </div>
          <div className="my-2 relative z-10">
            <h4 className="text-3xl font-black tracking-tight drop-shadow-md">{totalAudit}</h4>
          </div>
          <p className="text-[11px] font-medium text-white/95 relative z-10">Interaksi Dievaluasi</p>
        </div>

        {/* Card 3: Performa Try Out */}
        <div className="bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-400 p-5 rounded-3xl shadow-[0_15px_30px_-5px_rgba(16,185,129,0.4)] border border-emerald-400/40 relative overflow-hidden flex flex-col justify-between text-white transform transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_-5px_rgba(16,185,129,0.6)] cursor-pointer">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-sm">PERFORMA TRY OUT</p>
            <div className="w-8 h-8 rounded-xl bg-white/25 text-white flex items-center justify-center text-xs backdrop-blur-md shadow-inner">
              <i className="fa-solid fa-clipboard-list"></i>
            </div>
          </div>
          <div className="my-2 relative z-10">
            <h4 className="text-3xl font-black tracking-tight drop-shadow-md">{tryoutScore}</h4>
          </div>
          <p className="text-[11px] font-medium text-white/95 relative z-10">{tryoutPassrate}</p>
        </div>

        {/* Card 4: Progres Coaching */}
        <div className="bg-gradient-to-tr from-amber-700 via-orange-600 to-amber-400 p-5 rounded-3xl shadow-[0_15px_30px_-5px_rgba(245,158,11,0.4)] border border-amber-400/40 relative overflow-hidden flex flex-col justify-between text-white transform transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_-5px_rgba(245,158,11,0.6)] cursor-pointer">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-sm">PROGRESS COACHING</p>
            <div className="w-8 h-8 rounded-xl bg-white/25 text-white flex items-center justify-center text-xs backdrop-blur-md shadow-inner">
              <i className="fa-solid fa-chalkboard-user"></i>
            </div>
          </div>
          <div className="my-2 relative z-10">
            <h4 className="text-3xl font-black tracking-tight drop-shadow-md">{coachingTotal}</h4>
          </div>
          <p className="text-[11px] font-medium text-white/95 relative z-10 truncate" title={coachingTop}>{coachingTop}</p>
        </div>

      </div>

      {/* Highlight Section Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Box 1: Focus Area (Bar h-4) */}
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold border border-red-200 shadow-sm">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Area Fokus Perbaikan (Bottom Parameters)</h4>
              <p className="text-xs text-slate-500">Parameter dengan persentase pencapaian terendah</p>
            </div>
          </div>
          <div className="space-y-4">
            {bottomParams.length > 0 ? (
              bottomParams.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-white/85 hover:bg-white rounded-2xl border border-slate-200/80 shadow-sm transition space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 capitalize">{item.name}</span>
                    <span className="font-black text-red-600">{item.score.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden shadow-inner">
                    <div className="bg-red-600 h-4 rounded-full transition-all duration-500" style={{ width: `${Math.min(item.score, 100)}%` }}></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic">Memuat data area perbaikan...</p>
            )}
          </div>
        </div>

        {/* Box 2: Quick Status Pillar Summary */}
        <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 rounded-3xl border border-slate-300 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.25)]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold border border-blue-200 shadow-sm">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Ringkasan 3 Pilar Kualitas</h4>
              <p className="text-xs text-slate-500">Pencapaian rata-rata per kategori utama</p>
            </div>
          </div>
          
          <div className="space-y-4">
            
            {/* Pillar: Attitude */}
            <div className="p-3.5 bg-white/85 hover:bg-white rounded-2xl border border-slate-200/80 shadow-sm transition space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 capitalize">Attitude</span>
                <span className="font-black text-blue-600">{attVal.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden shadow-inner">
                <div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${Math.min(attVal, 100)}%` }}></div>
              </div>
            </div>

            {/* Pillar: Skill */}
            <div className="p-3.5 bg-white/85 hover:bg-white rounded-2xl border border-slate-200/80 shadow-sm transition space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 capitalize">Skill</span>
                <span className="font-black text-red-600">{sklVal.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden shadow-inner">
                <div className="bg-red-600 h-4 rounded-full transition-all duration-500" style={{ width: `${Math.min(sklVal, 100)}%` }}></div>
              </div>
            </div>

            {/* Pillar: Knowledge */}
            <div className="p-3.5 bg-white/85 hover:bg-white rounded-2xl border border-slate-200/80 shadow-sm transition space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 capitalize">Knowledge</span>
                <span className="font-black text-amber-500">{knwVal.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden shadow-inner">
                <div className="bg-amber-500 h-4 rounded-full transition-all duration-500" style={{ width: `${Math.min(knwVal, 100)}%` }}></div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}