import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  Activity, 
  DollarSign, 
  Plus, 
  Search, 
  LogOut, 
  LayoutDashboard, 
  FileText, 
  Ticket as TicketIcon,
  Settings,
  CheckCircle2,
  XCircle,
  Download,
  Menu,
  X,
  ChevronRight,
  Bell,
  Package as PackageIcon,
  Trash2,
  Flame,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Invoice, Ticket, Stats, Package } from './types';
import { 
  auth, 
  signInWithGoogle, 
  seedInitialFirestoreData,
  subscribeToPackages,
  subscribeToUsers,
  subscribeToInvoices,
  subscribeToTickets,
  subscribeToSettings,
  createFirestorePackage,
  updateFirestorePackage,
  deleteFirestorePackage,
  createFirestoreUser,
  updateFirestoreUser,
  saveFirestoreSettings,
  updateFirestoreInvoice
} from './firebase';
import { signOut as fbSignOut } from 'firebase/auth';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
    {(title || Icon) && (
      <div className="px-6 py-4 border-bottom border-slate-100 flex items-center justify-between">
        {title && <h3 className="font-semibold text-slate-800">{title}</h3>}
        {Icon && <Icon className="w-5 h-5 text-slate-400" />}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: { title: string, value: string | number, icon: any, trend?: string, color: string }) => (
  <Card className="relative overflow-hidden group">
    <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110", color)} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {trend && <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
          <ChevronRight className="w-3 h-3 rotate-[-90deg]" /> {trend}
        </p>}
      </div>
      <div className={cn("p-3 rounded-xl", color.replace('bg-', 'bg-opacity-10 text-').replace('-500', '-600'))}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </Card>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  icon: Icon, 
  disabled,
  type = 'button',
  title
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost', 
  className?: string, 
  icon?: any, 
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset',
  title?: string
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100'
  };

  return (
    <button 
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick} 
      className={cn(
        "px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none", 
        variants[variant], 
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const Badge = ({ children, variant = 'success' }: { children: React.ReactNode, variant?: 'success' | 'warning' | 'danger' | 'info' }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-sky-50 text-sky-700 border-sky-100'
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", variants[variant])}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('netpulse_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'dashboard' | 'users' | 'billing' | 'tickets' | 'customer-portal' | 'settings' | 'packages'>(() => {
    const saved = localStorage.getItem('netpulse_user');
    if (saved) {
      const u = JSON.parse(saved);
      return u.role === 'admin' ? 'dashboard' : 'customer-portal';
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('netpulse_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('netpulse_user');
    }
  }, [user]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  // Admin Data
  const [users, setUsers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, dueBills: 0, monthlyRevenue: 0 });
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Forms
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState<{show: boolean, to: string, name: string}>({show: false, to: '', name: ''});
  const [smsMessage, setSmsMessage] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    address: '',
    phone: '',
    package_name: '',
    price: 0,
    expiry_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  });
  const [newPackage, setNewPackage] = useState({
    name: '',
    price: 500,
    local_address: '10.0.0.1',
    remote_address: 'pppoe-pool',
    rate_limit: '10M/10M'
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Seed initial packages in Firestore if empty
    seedInitialFirestoreData();

    // 1. Subscribe to packages (Firestore real-time)
    const unsubPackages = subscribeToPackages((pkgs) => {
      if (pkgs.length > 0) {
        setPackages(pkgs);
        if (!newUser.package_name) {
          setNewUser(prev => ({ ...prev, package_name: pkgs[0].name, price: pkgs[0].price }));
        }
      }
    });

    // 2. Subscribe to users (Admin view)
    let unsubUsers = () => {};
    if (user.role === 'admin') {
      unsubUsers = subscribeToUsers((usersList) => {
        if (usersList.length > 0) {
          setUsers(usersList);
          setStats(prev => ({
            ...prev,
            totalUsers: usersList.length,
            activeUsers: usersList.filter(u => u.status === 'active').length
          }));
        }
      });
    }

    // 3. Subscribe to invoices (Admin or customer specific)
    const unsubInvoices = subscribeToInvoices(
      user.role === 'admin' ? null : String(user.id),
      user.role === 'admin',
      (invs) => {
        if (invs.length > 0) {
          setInvoices(invs);
          const due = invs.filter(i => i.status === 'unpaid').reduce((acc, curr) => acc + curr.amount, 0);
          const revenue = invs.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
          setStats(prev => ({
            ...prev,
            dueBills: due,
            monthlyRevenue: revenue
          }));
        }
      }
    );

    // 4. Subscribe to tickets
    const unsubTickets = subscribeToTickets(
      user.role === 'admin' ? null : String(user.id),
      user.role === 'admin',
      (tkts) => {
        if (tkts.length > 0) {
          setTickets(tkts);
        }
      }
    );

    // 5. Subscribe to settings
    let unsubSettings = () => {};
    if (user.role === 'admin') {
      unsubSettings = subscribeToSettings((stgs) => {
        if (Object.keys(stgs).length > 0) {
          setSettings(prev => ({ ...prev, ...stgs }));
        }
      });
    }

    // Also fetch initial data from backend API
    fetchData();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BKASH_PAYMENT_SUCCESS') {
        fetchData();
        alert(`Payment Successful for Invoice #${event.data.invoiceId}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      unsubPackages();
      unsubUsers();
      unsubInvoices();
      unsubTickets();
      unsubSettings();
      window.removeEventListener('message', handleMessage);
    };
  }, [user]);

  const handleBKashPayment = async (invoiceId: string | number, amount: number) => {
    try {
      const res = await fetch('/api/bkash/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amount })
      });
      const data = await res.json();
      if (data.bkashURL) {
        window.open(data.bkashURL, 'bkash_payment', 'width=500,height=700');
      } else {
        alert("Failed to initiate bKash payment: " + (data.statusMessage || "Unknown error"));
      }
    } catch (e) {
      console.error("bKash Payment Error:", e);
      alert("An error occurred while initiating payment.");
    }
  };

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (user?.role === 'admin') {
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) setUsers(await usersRes.json());
        const invoicesRes = await fetch('/api/invoices');
        if (invoicesRes.ok) setInvoices(await invoicesRes.json());
        const ticketsRes = await fetch('/api/tickets');
        if (ticketsRes.ok) setTickets(await ticketsRes.json());
        const packagesRes = await fetch('/api/packages');
        if (packagesRes.ok) {
          const pkgs = await packagesRes.json();
          setPackages(pkgs);
          if (pkgs.length > 0 && !newUser.package_name) {
            setNewUser(prev => ({ ...prev, package_name: pkgs[0].name, price: pkgs[0].price }));
          }
        }
        
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) setSettings(await settingsRes.json());
      } else if (user) {
        const invoicesRes = await fetch(`/api/invoices/user/${user.id}`);
        if (invoicesRes.ok) setInvoices(await invoicesRes.json());
      }
    } catch (e) {
      console.warn("Backend API sync warning, using Firestore data:", e);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoggingIn(true);
    try {
      const profile = await signInWithGoogle();
      setUser(profile);
      setView(profile.role === 'admin' ? 'dashboard' : 'customer-portal');
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError("Google Login failed or was closed. You can also use Quick Admin Login below.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleQuickAdminLogin = () => {
    const adminUser: User = {
      id: 'admin-main',
      username: 'admin',
      full_name: 'System Administrator (MD Shobuj)',
      role: 'admin',
      address: 'Central NOC',
      phone: '+8801700000000',
      package_name: 'Core Network',
      price: 0,
      status: 'active',
      expiry_date: '2099-12-31',
      created_at: new Date().toISOString()
    };
    setUser(adminUser);
    setView('dashboard');
  };

  const handleQuickCustomerLogin = () => {
    const custUser: User = {
      id: 'cust-demo-1',
      username: 'customer1',
      full_name: 'Kalam Ahmed',
      role: 'customer',
      address: 'House 42, Road 7, Dhanmondi',
      phone: '01811223344',
      package_name: 'Standard 10Mbps',
      price: 500,
      status: 'active',
      expiry_date: format(new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      created_at: new Date().toISOString()
    };
    setUser(custUser);
    setView('customer-portal');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Direct check for admin/admin123 to guarantee immediate access
    if (authForm.username === 'admin' && authForm.password === 'admin123') {
      handleQuickAdminLogin();
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          setView(data.user.role === 'admin' ? 'dashboard' : 'customer-portal');
          return;
        }
      }
      const errorData = await res.json().catch(() => ({ message: 'Invalid username or password' }));
      setError(errorData.message || 'Invalid credentials');
    } catch (err) {
      console.warn("Server login offline, falling back:", err);
      // If customer demo
      if (authForm.username.toLowerCase().includes('user') || authForm.username.toLowerCase().includes('cust')) {
        handleQuickCustomerLogin();
        return;
      }
      setError("Login failed. Please use Google Login or Quick Admin Login.");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Sync with backend (MikroTik and SQLite)
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      // 2. Persist in Firestore
      await createFirestoreUser({
        username: newUser.username,
        full_name: newUser.full_name,
        address: newUser.address,
        phone: newUser.phone,
        package_name: newUser.package_name,
        price: newUser.price,
        status: 'active',
        expiry_date: newUser.expiry_date,
        role: 'customer'
      });

      setShowUserModal(false);
      fetchData();
      setNewUser({
        username: '',
        password: '',
        full_name: '',
        address: '',
        phone: '',
        package_name: packages[0]?.name || '',
        price: packages[0]?.price || 0,
        expiry_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      });
    } catch (e) {
      console.error("Failed to add user:", e);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      await updateFirestoreUser(editingUser.id, editingUser);
      setEditingUser(null);
      fetchData();
    } catch (e) {
      console.error("Failed to update user:", e);
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPackage)
      });
      await createFirestorePackage(newPackage);
      setShowPackageModal(false);
      fetchData();
      setNewPackage({
        name: '',
        price: 500,
        local_address: '10.0.0.1',
        remote_address: 'pppoe-pool',
        rate_limit: '10M/10M'
      });
    } catch (e) {
      console.error("Failed to add package:", e);
    }
  };

  const handleUpdatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    try {
      await fetch(`/api/packages/${editingPackage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPackage)
      });
      await updateFirestorePackage(editingPackage.id, editingPackage);
      setEditingPackage(null);
      fetchData();
    } catch (e) {
      console.error("Failed to update package:", e);
    }
  };

  const [testingMikrotik, setTestingMikrotik] = useState(false);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      await saveFirestoreSettings(settings);
      alert("Settings updated & synchronized with Firebase!");
      fetchData();
    } catch (e) {
      console.error("Settings error:", e);
    }
  };

  const handleTestMikroTik = async () => {
    setTestingMikrotik(true);
    try {
      const res = await fetch('/api/mikrotik/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.MIKROTIK_HOST,
          user: settings.MIKROTIK_USER,
          pass: settings.MIKROTIK_PASS,
          port: settings.MIKROTIK_PORT
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("MikroTik Connected Successfully!");
      } else {
        alert("Connection Failed: " + data.message);
      }
    } catch (e) {
      alert("Error testing connection");
    } finally {
      setTestingMikrotik(false);
    }
  };

  const handleSendManualSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: showSMSModal.to, message: smsMessage })
    });
    if (res.ok) {
      alert("SMS sent successfully!");
      setShowSMSModal({show: false, to: '', name: ''});
      setSmsMessage('');
    }
  };

  const handleDeletePackage = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this package? It will also be removed from MikroTik.")) return;
    try {
      await fetch(`/api/packages/${id}`, { method: 'DELETE' });
      await deleteFirestorePackage(id);
      fetchData();
    } catch (e) {
      console.error("Failed to delete package:", e);
    }
  };

  const downloadInvoice = (invoice: Invoice) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("NETPULSE ISP INVOICE", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Invoice ID: #INV-${invoice.id}`, 20, 40);
    doc.text(`Date: ${format(new Date(invoice.created_at), 'PPP')}`, 20, 45);
    doc.text(`Customer: ${invoice.user_name || user?.full_name}`, 20, 50);
    doc.text(`Month: ${invoice.month}`, 20, 55);

    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Amount']],
      body: [
        ['Internet Service Subscription', `${invoice.amount} BDT`],
        ['Total', `${invoice.amount} BDT`]
      ],
    });

    doc.text("Thank you for your business!", 105, doc.internal.pageSize.height - 20, { align: 'center' });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/20 mb-4 border border-indigo-400/30">
              <Activity className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">NetPulse ISP</h1>
            <p className="text-indigo-200/80 mt-1.5 text-sm">Automated Billing, MikroTik & Firebase Realtime Cloud</p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Firebase Database & Auth Connected
            </div>
          </div>

          <Card className="p-8 shadow-2xl border-slate-700/50 bg-white">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Login Notice:</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* 1. Google Firebase Login */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loggingIn}
                className="w-full py-3.5 px-4 rounded-xl border border-slate-300 hover:border-indigo-500 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {loggingIn ? "Connecting with Firebase..." : "Continue with Google (Firebase)"}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Fast One-Click Access</span>
                </div>
              </div>

              {/* 2. Quick Demo Access Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 font-medium text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-sm">Admin Access</span>
                  <span className="text-[10px] text-indigo-500">Full Router & Billing</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickCustomerLogin}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <Users className="w-5 h-5 text-slate-600" />
                  <span className="font-bold text-sm">Customer Portal</span>
                  <span className="text-[10px] text-slate-500">Pay Bill & Tickets</span>
                </button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Or Use Username & Password</span>
                </div>
              </div>

              {/* 3. Traditional Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Username</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                    placeholder="e.g. admin"
                    value={authForm.username}
                    onChange={e => setAuthForm({...authForm, username: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
                  <input 
                    type="password" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  />
                </div>
                <Button className="w-full py-2.5 text-sm" type="submit">Sign In</Button>
              </form>
            </div>
          </Card>
          
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-indigo-300/80">
              💡 কোনো পাসওয়ার্ড মনে না থাকলে সরাসরি উপরের <b>"Admin Access"</b> বা <b>"Continue with Google"</b> বাটনে চাপুন।
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Admin Credential: admin / admin123
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Sign out exception:", e);
    }
    setUser(null);
    localStorage.removeItem('netpulse_user');
    setView('dashboard');
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof view, label: string, icon: any }) => (
    <button
      onClick={() => setView(id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1",
        view === id 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 transform lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">NetPulse</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-4 mt-4">
          {user.role === 'admin' ? (
            <>
              <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
              <SidebarItem id="users" label="User Management" icon={Users} />
              <SidebarItem id="packages" label="ISP Packages" icon={PackageIcon} />
              <SidebarItem id="billing" label="Billing & Invoices" icon={FileText} />
              <SidebarItem id="tickets" label="Support Tickets" icon={TicketIcon} />
              <SidebarItem id="settings" label="Settings" icon={Settings} />
            </>
          ) : (
            <>
              <SidebarItem id="customer-portal" label="My Account" icon={LayoutDashboard} />
              <SidebarItem id="billing" label="My Bills" icon={FileText} />
              <SidebarItem id="tickets" label="Support Tickets" icon={TicketIcon} />
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {user.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" icon={LogOut} onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarOpen ? "lg:ml-72" : "ml-0"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className={cn("p-2 text-slate-500 lg:hidden", isSidebarOpen && "hidden")}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 capitalize">{view.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Firebase Live Cloud
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.username}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {view === 'dashboard' && user.role === 'admin' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Users" value={stats.totalUsers} icon={Users} trend="+12% from last month" color="bg-indigo-500" />
                <StatCard title="Active Users" value={stats.activeUsers} icon={Activity} trend="+5% from last month" color="bg-emerald-500" />
                <StatCard title="Due Bills" value={`${stats.dueBills} BDT`} icon={CreditCard} trend="-2% from last month" color="bg-amber-500" />
                <StatCard title="Monthly Revenue" value={`${stats.monthlyRevenue} BDT`} icon={DollarSign} trend="+18% from last month" color="bg-sky-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Revenue Overview" icon={DollarSign}>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'Jan', revenue: 45000 },
                        { name: 'Feb', revenue: 52000 },
                        { name: 'Mar', revenue: 48000 },
                        { name: 'Apr', revenue: 61000 },
                        { name: 'May', revenue: 55000 },
                        { name: 'Jun', revenue: 67000 },
                      ]}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Recent Activity" icon={Bell}>
                  <div className="space-y-6">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">New user registered: <span className="text-indigo-600">John Doe</span></p>
                          <p className="text-xs text-slate-500 mt-1">2 hours ago • Package: Premium 20Mbps</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {view === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search users by name, phone or username..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <Button icon={Plus} onClick={() => setShowUserModal(true)}>Add New User</Button>
              </div>

              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Package</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                {u.full_name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{u.full_name}</p>
                                <p className="text-xs text-slate-500">{u.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-900">{u.package_name}</p>
                            <p className="text-xs text-slate-500">{u.price} BDT/mo</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {format(new Date(u.expiry_date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button variant="ghost" className="p-2 h-auto text-indigo-600" title="Send SMS" onClick={() => setShowSMSModal({show: true, to: u.phone, name: u.full_name})}><Bell className="w-4 h-4" /></Button>
                              <Button variant="ghost" className="p-2 h-auto" onClick={() => setEditingUser(u)}><Settings className="w-4 h-4" /></Button>
                              <Button variant="ghost" className="p-2 h-auto text-rose-600"><XCircle className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {view === 'packages' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search packages..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <Button icon={Plus} onClick={() => setShowPackageModal(true)}>Add New Package</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map(pkg => (
                  <div key={pkg.id}>
                    <Card className="relative group h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <PackageIcon className="w-6 h-6" />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" className="p-2 h-auto" onClick={() => setEditingPackage(pkg)}><Settings className="w-4 h-4" /></Button>
                        <Button variant="ghost" className="p-2 h-auto text-rose-600" onClick={() => handleDeletePackage(pkg.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">{pkg.name}</h4>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{pkg.price} BDT<span className="text-xs text-slate-400 font-normal">/mo</span></p>
                    
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Rate Limit</span>
                        <span className="font-medium text-slate-900">{pkg.rate_limit}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Local Address</span>
                        <span className="font-medium text-slate-900">{pkg.local_address}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Remote Address</span>
                        <span className="font-medium text-slate-900">{pkg.remote_address}</span>
                      </div>
                    </div>
                  </Card>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'billing' && (
            <div className="space-y-6">
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice ID</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">#INV-{inv.id}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{inv.user_name || user.full_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{inv.month}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{inv.amount} BDT</td>
                          <td className="px-6 py-4">
                            <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button variant="ghost" className="p-2 h-auto" onClick={() => downloadInvoice(inv)}><Download className="w-4 h-4" /></Button>
                              {inv.status === 'unpaid' && user.role === 'customer' && (
                                <Button variant="primary" className="py-1 px-3 text-xs">Pay Now</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No invoices found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {view === 'tickets' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Support Tickets</h3>
                {user.role === 'customer' && <Button icon={Plus}>Open New Ticket</Button>}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {tickets.map(t => (
                  <div key={t.id}>
                    <Card className="hover:border-indigo-200 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className={cn("p-3 rounded-xl", t.status === 'open' ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600")}>
                            <TicketIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{t.subject}</h4>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{t.message}</p>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" /> {t.user_name || user.full_name}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-400">{format(new Date(t.created_at), 'PPP')}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={t.status === 'open' ? 'warning' : 'success'}>{t.status}</Badge>
                      </div>
                    </Card>
                  </div>
                ))}
                {tickets.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <TicketIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No support tickets found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="space-y-6">
              <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <Card title="MikroTik Integration" icon={Activity}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-500">Configure your RouterOS API credentials.</p>
                        <Button 
                          type="button" 
                          variant="secondary" 
                          className="text-xs py-1.5" 
                          onClick={handleTestMikroTik}
                          disabled={testingMikrotik}
                        >
                          {testingMikrotik ? "Testing..." : "Test Connection"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Router IP Address</label>
                          <input 
                            type="text" 
                            value={settings.MIKROTIK_HOST || ''} 
                            onChange={e => setSettings({...settings, MIKROTIK_HOST: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Port</label>
                          <input 
                            type="number" 
                            value={settings.MIKROTIK_PORT || ''} 
                            onChange={e => setSettings({...settings, MIKROTIK_PORT: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Username</label>
                          <input 
                            type="text" 
                            value={settings.MIKROTIK_USER || ''} 
                            onChange={e => setSettings({...settings, MIKROTIK_USER: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Password</label>
                          <input 
                            type="password" 
                            value={settings.MIKROTIK_PASS || ''} 
                            onChange={e => setSettings({...settings, MIKROTIK_PASS: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="bKash API Configuration" icon={CreditCard}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">Base URL</label>
                          <input 
                            type="text" 
                            value={settings.BKASH_BASE_URL || ''} 
                            onChange={e => setSettings({...settings, BKASH_BASE_URL: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">App Key</label>
                          <input 
                            type="text" 
                            value={settings.BKASH_APP_KEY || ''} 
                            onChange={e => setSettings({...settings, BKASH_APP_KEY: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">App Secret</label>
                          <input 
                            type="password" 
                            value={settings.BKASH_APP_SECRET || ''} 
                            onChange={e => setSettings({...settings, BKASH_APP_SECRET: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Username</label>
                          <input 
                            type="text" 
                            value={settings.BKASH_USERNAME || ''} 
                            onChange={e => setSettings({...settings, BKASH_USERNAME: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Password</label>
                          <input 
                            type="password" 
                            value={settings.BKASH_PASSWORD || ''} 
                            onChange={e => setSettings({...settings, BKASH_PASSWORD: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="SMS API Configuration" icon={Bell}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Enable Automatic SMS</p>
                          <p className="text-xs text-slate-500">Send SMS for welcome, bills, and payments</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setSettings({...settings, SMS_ENABLED: settings.SMS_ENABLED === 'true' ? 'false' : 'true'})}
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            settings.SMS_ENABLED === 'true' ? "bg-indigo-600" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                            settings.SMS_ENABLED === 'true' ? "translate-x-7" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">API URL (GET Endpoint)</label>
                          <input 
                            type="text" 
                            placeholder="https://api.bulksmsbd.com/api/sendsms"
                            value={settings.SMS_API_URL || ''} 
                            onChange={e => setSettings({...settings, SMS_API_URL: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
                          <input 
                            type="text" 
                            value={settings.SMS_API_KEY || ''} 
                            onChange={e => setSettings({...settings, SMS_API_KEY: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Sender ID / Masking</label>
                          <input 
                            type="text" 
                            value={settings.SMS_SENDER_ID || ''} 
                            onChange={e => setSettings({...settings, SMS_SENDER_ID: e.target.value})}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Note: The system uses a standard GET request with parameters: api_key, senderid, number, and message.
                      </p>
                    </div>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card title="Save Settings" icon={Bell}>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">
                        Updating these settings will immediately affect MikroTik synchronization and bKash payments.
                      </p>
                      <Button className="w-full">Save All Settings</Button>
                    </div>
                  </Card>

                  <Card title="System Info" icon={Bell}>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Version</span>
                        <span className="font-medium">2.4.0-stable</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Database</span>
                        <span className="font-medium text-emerald-600">Healthy</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </form>
            </div>
          )}

          {view === 'customer-portal' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2" title="Account Status" icon={Activity}>
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 * 0.2} className="text-indigo-600" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-900">24</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Days Left</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">{user.package_name}</h4>
                        <p className="text-slate-500">Subscription expires on {format(new Date(user.expiry_date), 'PPP')}</p>
                      </div>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                        <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] text-emerald-600 uppercase font-bold">Status</p>
                          <p className="text-sm font-bold text-emerald-700">Connected</p>
                        </div>
                        <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                          <p className="text-[10px] text-indigo-600 uppercase font-bold">Speed</p>
                          <p className="text-sm font-bold text-indigo-700">10 Mbps</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Quick Pay" icon={CreditCard}>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Current Due Amount</p>
                    <h3 className="text-3xl font-bold text-slate-900">{user.price} BDT</h3>
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <button 
                        onClick={() => {
                          const unpaidInvoice = invoices.find(inv => inv.status === 'unpaid');
                          if (unpaidInvoice) {
                            handleBKashPayment(unpaidInvoice.id, unpaidInvoice.amount);
                          } else {
                            alert("No unpaid invoices found.");
                          }
                        }}
                        className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 transition-colors"
                      >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/BKash_Logo.svg/1200px-BKash_Logo.svg.png" alt="bKash" className="h-6 object-contain mx-auto" referrerPolicy="no-referrer" />
                      </button>
                      <button className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 transition-colors">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_Logo.svg/1200px-Nagad_Logo.svg.png" alt="Nagad" className="h-6 object-contain mx-auto" referrerPolicy="no-referrer" />
                      </button>
                      <button className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 transition-colors">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Rocket_Logo.svg/1200px-Rocket_Logo.svg.png" alt="Rocket" className="h-6 object-contain mx-auto" referrerPolicy="no-referrer" />
                      </button>
                    </div>
                    <Button className="w-full mt-2">Pay Now</Button>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Usage Statistics" icon={Activity}>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { day: 'Mon', usage: 12 },
                        { day: 'Tue', usage: 18 },
                        { day: 'Wed', usage: 15 },
                        { day: 'Thu', usage: 22 },
                        { day: 'Fri', usage: 30 },
                        { day: 'Sat', usage: 25 },
                        { day: 'Sun', usage: 20 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Line type="monotone" dataKey="usage" stroke="#4f46e5" strokeWidth={3} dot={{fill: '#4f46e5', strokeWidth: 2, r: 4}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Recent Invoices" icon={FileText}>
                  <div className="space-y-4">
                    {invoices.slice(0, 3).map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{inv.month}</p>
                            <p className="text-xs text-slate-500">Paid on {format(new Date(inv.created_at), 'PPP')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{inv.amount} BDT</p>
                          <button onClick={() => downloadInvoice(inv)} className="text-xs text-indigo-600 font-medium hover:underline">Download PDF</button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" className="w-full text-xs" onClick={() => setView('billing')}>View All Invoices</Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Add New Customer" icon={Users}>
            <form onSubmit={handleAddUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.full_name}
                    onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.phone}
                    onChange={e => setNewUser({...newUser, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Username (PPPoE)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <input 
                    type="password" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Package</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.package_name}
                    onChange={e => {
                      const pkg = packages.find(p => p.name === e.target.value);
                      setNewUser({...newUser, package_name: e.target.value, price: pkg?.price || 0});
                    }}
                  >
                    {packages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Price (BDT)</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newUser.price}
                    onChange={e => setNewUser({...newUser, price: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={3}
                  value={newUser.address}
                  onChange={e => setNewUser({...newUser, address: e.target.value})}
                ></textarea>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setShowUserModal(false)}>Cancel</Button>
                <Button>Create User & Sync MikroTik</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Edit Customer" icon={Users}>
            <form onSubmit={handleUpdateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.full_name}
                    onChange={e => setEditingUser({...editingUser, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.phone}
                    onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.status}
                    onChange={e => setEditingUser({...editingUser, status: e.target.value as any})}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
                  <input 
                    type="date" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.expiry_date ? editingUser.expiry_date.split('T')[0] : ''}
                    onChange={e => setEditingUser({...editingUser, expiry_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Package</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.package_name}
                    onChange={e => {
                      const pkg = packages.find(p => p.name === e.target.value);
                      setEditingUser({...editingUser, package_name: e.target.value, price: pkg?.price || 0});
                    }}
                  >
                    {packages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Price (BDT)</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingUser.price}
                    onChange={e => setEditingUser({...editingUser, price: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={3}
                  value={editingUser.address}
                  onChange={e => setEditingUser({...editingUser, address: e.target.value})}
                ></textarea>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button>Update User Info</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Add Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl" title="Add New ISP Package" icon={PackageIcon}>
            <form onSubmit={handleAddPackage} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Package Name (Profile)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPackage.name}
                    onChange={e => setNewPackage({...newPackage, name: e.target.value})}
                    placeholder="e.g. 10Mbps_Standard"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Price (BDT)</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPackage.price}
                    onChange={e => setNewPackage({...newPackage, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Local Address</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPackage.local_address}
                    onChange={e => setNewPackage({...newPackage, local_address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Remote Address (Pool)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPackage.remote_address}
                    onChange={e => setNewPackage({...newPackage, remote_address: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Rate Limit (Rx/Tx)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPackage.rate_limit}
                    onChange={e => setNewPackage({...newPackage, rate_limit: e.target.value})}
                    placeholder="e.g. 10M/10M"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setShowPackageModal(false)}>Cancel</Button>
                <Button>Create Package & Sync MikroTik</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Package Modal */}
      {editingPackage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl" title="Edit ISP Package" icon={PackageIcon}>
            <form onSubmit={handleUpdatePackage} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Package Name (Profile)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingPackage.name}
                    onChange={e => setEditingPackage({...editingPackage, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Price (BDT)</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingPackage.price}
                    onChange={e => setEditingPackage({...editingPackage, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Local Address</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingPackage.local_address}
                    onChange={e => setEditingPackage({...editingPackage, local_address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Remote Address (Pool)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingPackage.remote_address}
                    onChange={e => setEditingPackage({...editingPackage, remote_address: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Rate Limit (Rx/Tx)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingPackage.rate_limit}
                    onChange={e => setEditingPackage({...editingPackage, rate_limit: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setEditingPackage(null)}>Cancel</Button>
                <Button>Update Package & Sync MikroTik</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* SMS Modal */}
      {showSMSModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Send SMS to {showSMSModal.name}</h3>
              <button onClick={() => setShowSMSModal({show: false, to: '', name: ''})} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSendManualSMS} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input type="text" value={showSMSModal.to} disabled className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                <textarea 
                  required
                  value={smsMessage}
                  onChange={e => setSmsMessage(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                  rows={4}
                  placeholder="Type your message here..."
                ></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowSMSModal({show: false, to: '', name: ''})}>Cancel</Button>
                <Button type="submit" className="flex-1">Send Message</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
