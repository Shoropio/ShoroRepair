import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate
} from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  Wrench,
  Search,
  Moon,
  Sun,
  FileText,
  LogOut,
  CreditCard,
  Activity,
  Shield,
  Bell,
  Sparkles,
  Plus
} from 'lucide-react';

import Dashboard from '../features/Dashboard';
import Orders from '../features/Orders';
import Clients from '../features/Clients';
import Inventory from '../features/Inventory';
import Reports from '../features/Reports';
import UsersPage from '../features/Users';
import Invoices from '../features/Invoices';
import SettingsPage from '../features/Settings';
import Expenses from '../features/Expenses';
import ActivityPage from '../features/Activity';
import RolesPage from '../features/Roles';
import AIDiagnostic from '../features/AIDiagnostic';
import Login from '../features/Login';
import SetupPage from '../features/Setup';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { SyncStatusIndicator } from '../components';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { db } from '../offline/db';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      console.log("Dark mode active");
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      console.log("Light mode active");
    }
  }, [darkMode]);

  useEffect(() => {
    const accent = localStorage.getItem('system_accent');
    if (accent) {
      document.documentElement.style.setProperty('--color-brand-600', accent);
      document.documentElement.style.setProperty('--color-brand-500', accent);
    }

    // Load saved language
    const loadLang = async () => {
      const settings = await db.settings.toArray();
      if (settings[0]?.language) {
        i18n.changeLanguage(settings[0].language);
      }
    };
    loadLang();
  }, []);

  // Check for initial setup
  useEffect(() => {
    const checkSetup = async () => {
      const userCount = await db.users.count();
      if (userCount === 0) {
        if (location.pathname !== '/setup') {
          console.log("Redirecting to Setup (No users found)");
          navigate('/setup');
        }
      } else {
        if (location.pathname === '/setup') {
          console.log("Setup blocked (Users exist)");
          navigate('/login');
        }
      }
    };
    checkSetup();
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1a1c1e] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1a73e8] border-t-transparent rounded-none animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupPage />} />
        {/* If we are at /setup, don't redirect to login immediately, let the useEffect handle it */}
        <Route path="*" element={location.pathname === '/setup' ? null : <Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user && location.pathname === '/login') return <Navigate to="/" replace />;

  const NavItem: React.FC<{ to: string, icon: any, label: string, roles?: string[] }> = ({ to, icon: Icon, label, roles }) => {
    const { user } = useAuth();
    const location = useLocation();
    const isActive = location.pathname === to;

    if (roles && user && !roles.includes(user.role)) return null;

    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`
          flex items-center gap-4 px-4 py-2.5 rounded-full transition-all duration-200 group
          ${isActive
            ? 'bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] font-bold shadow-sm'
            : 'text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2f31] font-medium'
          }
        `}
      >
        <Icon size={20} />
        <span className="text-sm">{label}</span>
      </Link>
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#1a1c1e] overflow-hidden">

      {/* Google Style Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#1a1c1e] border-r border-[#f1f3f4] dark:border-[#3c4043]
        transform transition-transform duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)]
        lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="h-20 flex items-center px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a73e8] to-[#1557b0] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Wrench size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#202124] dark:text-white tracking-tight leading-none">Shoro<span className="text-[#1a73e8]">Repair</span></h1>
                <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-medium tracking-widest uppercase mt-0.5">Management System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto scrollbar-hide">
            <NavItem to="/" label={t('nav.dashboard')} icon={LayoutDashboard} />
            <NavItem to="/orders" label={t('nav.orders')} icon={ClipboardList} />
            <NavItem to="/invoices" label={t('nav.invoices')} icon={FileText} roles={['Admin', 'Receptionist']} />
            <div className="my-4 h-px bg-[#f1f3f4] dark:bg-[#3c4043] mx-2" />
            <p className="px-4 text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Operaciones</p>
            <NavItem to="/clients" label={t('nav.clients')} icon={Users} />
            <NavItem to="/inventory" label={t('nav.inventory')} icon={Package} />
            <NavItem to="/expenses" label={t('nav.expenses')} icon={CreditCard} roles={['Admin']} />
            <div className="my-4 h-px bg-[#f1f3f4] dark:bg-[#3c4043] mx-2" />
            <p className="px-4 text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Administración</p>
            <NavItem to="/reports" label={t('nav.reports')} icon={BarChart3} roles={['Admin']} />
            <NavItem to="/activity" label={t('nav.activity')} icon={Activity} roles={['Admin']} />
            <NavItem to="/ai-diagnostic" label="AI Diagnostic" icon={Sparkles} roles={['Admin', 'Technician']} />
            <NavItem to="/users" label={t('nav.users')} icon={Users} roles={['Admin']} />
            <NavItem to="/roles" label={t('nav.roles')} icon={Shield} roles={['Admin']} />
            <NavItem to="/settings" label={t('nav.settings')} icon={SettingsIcon} roles={['Admin']} />
          </nav>

          {/* Footer Navigation (User) */}
          <div className="p-4 mx-4 mb-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#2d2f31]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center text-white font-semibold text-xs shadow-md">
                {user?.fullName.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-[#202124] dark:text-white truncate">{user?.fullName}</p>
                <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] uppercase font-bold tracking-wide">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-[#5f6368] hover:bg-white dark:hover:bg-white/10 hover:text-red-500 rounded-full transition-all shadow-sm hover:shadow">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#f1f3f4] dark:border-[#3c4043]">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-none">
              <Menu size={20} />
            </button>
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6]" size={16} />
              <input
                type="text"
                placeholder={t('common.global_search')}
                className="pl-10 pr-4 py-2 bg-[#f1f3f4] dark:bg-[#2d2f31] border-none rounded-none text-sm w-96 focus:bg-white dark:focus:bg-[#1a1c1e] transition-all outline-none focus:ring-2 focus:ring-[#1a73e8]/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none p-1 mr-2">
              <button
                onClick={() => {
                  i18n.changeLanguage('es');
                  db.settings.toArray().then(s => s[0] && db.settings.update(s[0].id!, { language: 'es' }));
                }}
                className={`w-8 h-8 rounded-none flex items-center justify-center text-lg transition-all ${i18n.language.startsWith('es') ? 'bg-white dark:bg-[#1a1c1e] shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                title="Español (CR)"
              >
                🇨🇷
              </button>
              <button
                onClick={() => {
                  i18n.changeLanguage('en');
                  db.settings.toArray().then(s => s[0] && db.settings.update(s[0].id!, { language: 'en' }));
                }}
                className={`w-8 h-8 rounded-none flex items-center justify-center text-lg transition-all ${i18n.language.startsWith('en') ? 'bg-white dark:bg-[#1a1c1e] shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                title="English (US)"
              >
                🇺🇸
              </button>
            </div>
            <SyncStatusIndicator />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2f31] rounded-none"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={async () => {
                if (Notification.permission === 'default') {
                  const permission = await Notification.requestPermission();
                  if (permission === 'granted') {
                    toast.success(t('messages.notifications_enabled'));
                  }
                } else if (Notification.permission === 'denied') {
                  toast.error(t('messages.notifications_blocked'));
                } else {
                  toast.info(t('messages.notifications_active'));
                }
              }}
              className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2f31] rounded-none relative"
            >
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-[#ea4335] rounded-none border-2 border-white dark:border-[#1a1c1e]" />
            </button>
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1c1e] p-6 lg:p-8">
          <div className="max-w-7xl mx-auto page-transition">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/ai-diagnostic" element={<AIDiagnostic />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
