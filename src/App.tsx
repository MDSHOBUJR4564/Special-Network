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
  Trash2
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

  useEffect(() => {
    if (user) {
      fetchData();
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BKASH_PAYMENT_SUCCESS') {
        fetchData();
        alert(`Payment Successful for Invoice #${event.data.invoiceId}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleBKashPayment = async (invoiceId: number, amount: number) => {
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
      setStats(await statsRes.json());

      if (user?.role === 'admin') {
        const usersRes = await fetch('/api/users');
        setUsers(await usersRes.json());
        const invoicesRes = await fetch('/api/invoices');
        setInvoices(await invoicesRes.json());
        const ticketsRes = await fetch('/api/tickets');
        setTickets(await ticketsRes.json());
        const packagesRes = await fetch('/api/packages');
        const pkgs = await packagesRes.json();
        setPackages(pkgs);
        
        const settingsRes = await fetch('/api/settings');
        setSettings(await settingsRes.json());

        if (pkgs.length > 0 && !newUser.package_name) {
          setNewUser(prev => ({ ...prev, package_name: pkgs[0].name, price: pkgs[0].price }));
        }
      } else {
        const invoicesRes = await fetch(`/api/invoices/user/${user?.id}`);
        setInvoices(await invoicesRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Login failed' }));
        setError(errorData.message || 'Invalid credentials');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setView(data.user.role === 'admin' ? 'dashboard' : 'customer-portal');
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Could not connect to server. Please try again.");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
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
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingUser)
    });
    if (res.ok) {
      setEditingUser(null);
      fetchData();
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPackage)
    });
    if (res.ok) {
      setShowPackageModal(false);
      fetchData();
      setNewPackage({
        name: '',
        price: 500,
        local_address: '10.0.0.1',
        remote_address: 'pppoe-pool',
        rate_limit: '10M/10M'
      });
    }
  };

  const handleUpdatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    const res = await fetch(`/api/packages/${editingPackage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPackage)
    });
    if (res.ok) {
      setEditingPackage(null);
      fetchData();
    }
  };

  const [testingMikrotik, setTestingMikrotik] = useState(false);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      alert("Settings updated successfully!");
      fetchData();
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

  const handleDeletePackage = async (id: number) => {
    if (!confirm("Are you sure you want to delete this package? It will also be removed from MikroTik.")) return;
    const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">NetPulse</h1>
            <p className="text-slate-500 mt-2">Professional ISP Management System</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Enter your username"
                  value={authForm.username}
                  onChange={e => setAuthForm({...authForm, username: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                />
              </div>
              {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
              <Button className="w-full py-3">Sign In</Button>
            </form>
          </Card>
          
          <div className="mt-8 text-center space-y-4">
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-sm text-indigo-700">
              <p className="font-semibold mb-1">Demo Credentials:</p>
              <div className="flex justify-center gap-4 font-mono">
                <span>User: admin</span>
                <span>Pass: admin123</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              If you are a customer, please use the credentials provided by your ISP.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
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
