import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Overview from './pages/Overview';
import Readiness from './pages/Readiness';
import Tapping from './pages/Tapping';
import Coaching from './pages/Coaching';
import Tryout from './pages/Tryout';
import ImportData from './pages/ImportData';
import Login from './pages/Login';

function PageTitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    switch (location.pathname) {
      case '/':
        document.title = 'Overview | Lensa Insight';
        break;
      case '/readiness':
        document.title = 'Daily Readiness | Lensa Insight';
        break;
      case '/tapping':
        document.title = 'Data Tapping CSR | Lensa Insight';
        break;
      case '/coaching':
        document.title = 'Data Coaching | Lensa Insight';
        break;
      case '/tryout':
        document.title = 'Tryout | Lensa Insight';
        break;
      case '/import':
        document.title = 'Import Data | Lensa Insight';
        break;
      default:
        document.title = 'Lensa Insight';
    }
  }, [location]);

  return null;
}

function MainLayout({ userRole, onLogout }) {
  const location = useLocation();
  
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 font-sans w-full">
      <Sidebar userRole={userRole} onLogout={onLogout} />
      <main key={location.pathname} className="flex-1 overflow-y-auto page-transition bg-slate-100 text-slate-800 h-screen p-0">
        <PageTitleUpdater />
        <Header />
        <div className="px-8 pb-8 pt-3">
          <Routes location={location}>
            <Route path="/" element={<Overview />} />
            <Route path="/readiness" element={<Readiness />} />
            <Route path="/tapping" element={<Tapping />} />
            <Route path="/coaching" element={<Coaching />} />
            <Route path="/tryout" element={<Tryout />} />
            <Route path="/import" element={<ImportData />} />
            {/* Jika akses rute yang tidak dikenal, lempar kembali ke overview */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('sqIsLoggedIn') === 'true';
  });
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('sqUserName') || 'SERVICE QUALITY';
  });

  const handleLoginSuccess = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
    localStorage.setItem('sqIsLoggedIn', 'true');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('sqIsLoggedIn');
    localStorage.removeItem('sqUserName');
    localStorage.removeItem('sqUserRole');
  };

  return (
    <Router>
      <Routes>
        {/* Jika belum login, arahkan semua rute langsung ke halaman Login */}
        {!isLoggedIn ? (
          <Route path="*" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        ) : (
          /* Jika sudah login, tampilkan MainLayout yang mencakup seluruh rute menu */
          <Route path="/*" element={<MainLayout userRole={userRole} onLogout={handleLogout} />} />
        )}
      </Routes>
    </Router>
  );
}