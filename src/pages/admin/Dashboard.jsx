import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { formatRupiah } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Settings, X, ArrowUp, Eye, Monitor, Tablet, Smartphone, Globe } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: bookings } = useFirestoreCollection('bookings');
  const { data: transactions } = useFirestoreCollection('transactions');
  const { data: visitors } = useFirestoreCollection('visitors');
  const { settings } = useSiteSettings();

  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showKpiModal, setShowKpiModal] = useState(false);
  const [kpiForm, setKpiForm] = useState(null);
  const [savingKpi, setSavingKpi] = useState(false);
  const [currentKpiTargets, setCurrentKpiTargets] = useState(null);

  const [simulationMetric, setSimulationMetric] = useState(null);

  const activeKpiTargets = currentKpiTargets || settings?.kpiTargets || {
    netSales: '40% - 70%',
    netProfit: '40% - 70%',
    grossProfit: '60% - 80%',
    cogs: '20% - 40%',
    opex: '10% - 25%',
    expProfit: '<50%',
    collectRatio: '70% - 90%',
    arRatio: '<30%'
  };

  const handleOpenKpiModal = () => {
    setKpiForm(activeKpiTargets);
    setShowKpiModal(true);
  };



  useEffect(() => {
    document.title = `Dashboard — ${settings?.brandName || ''}`;
  }, [settings]);

  const financialData = useMemo(() => {
    const isDateInRange = (dateInput) => {
      if (filterType === 'all') return true;
      if (!dateInput) return false;
      const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);

      if (filterType === 'month') {
        return date.getMonth() + 1 === parseInt(filterMonth) && date.getFullYear() === parseInt(filterYear);
      }

      if (filterType === 'custom') {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (start && end) return date >= start && date <= end;
        if (start) return date >= start;
        if (end) return date <= end;
        return true;
      }
      return true;
    };

    const getTransactionDate = (t) => {
      if (t.category === 'PAYMENT') return t.date || t.createdAt || t.eventDate;
      return t.eventDate || t.date || t.createdAt;
    };

    const filteredBookings = bookings.filter(b => b.eventDate ? isDateInRange(b.eventDate) : filterType === 'all');
    const filteredTransactions = transactions.filter(t => {
      const targetDate = getTransactionDate(t);
      return targetDate ? isDateInRange(targetDate) : filterType === 'all';
    });

    const isDaily = filterType === 'month' || (filterType === 'custom' && startDate && endDate && (new Date(endDate) - new Date(startDate)) <= 31 * 24 * 60 * 60 * 1000);

    let netSales = 0;
    let totalPaymentsReceived = 0;
    let piutang = 0;
    let totalPph = 0;
    let pphPaid = 0;
    let totalPackagePrice = 0;

    // Process Bookings
    filteredBookings.forEach(b => {
      if (['approved', 'in process', 'finished'].includes(b.status)) {
        totalPackagePrice += (b.packagePrice || 0);
        netSales += (b.packagePrice || 0) - (b.pphAmount || 0);
        const paid = b.payments
          ? b.payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0)
          : (b.paymentAmount || 0);
        piutang += Math.max(0, (b.packagePrice || 0) - paid);

        totalPph += (b.pphAmount || 0);
        if (b.pphPaid === true) {
          pphPaid += (b.pphAmount || 0);
        }
      }
    });

    const pphUnpaid = totalPph - pphPaid;
    const rawPiutang = piutang;
    piutang = Math.max(0, piutang - totalPph);

    let otherIncome = 0;
    let fixedCost = 0;
    let variableCost = 0;
    let taxExpense = 0;

    // Process Transactions
    filteredTransactions.forEach(t => {
      if (t.category === 'OTHER') otherIncome += t.amount;
      if (t.category === 'FIXED COST') fixedCost += t.amount;
      if (t.category === 'VARIABLE COST') variableCost += t.amount;
      if (t.category === 'PAJAK PPH' && t.type === 'EXPENSE') taxExpense += t.amount;
      if (t.category === 'PAYMENT' && t.type === 'INCOME') totalPaymentsReceived += t.amount;
    });

    const grossProfit = netSales - fixedCost;
    const netProfit = (netSales + otherIncome) - fixedCost - variableCost;

    const monthlyData = {};
    filteredBookings.forEach(b => {
      if (['approved', 'in process', 'finished'].includes(b.status) && b.eventDate) {
        const date = b.eventDate.toDate ? b.eventDate.toDate() : new Date(b.eventDate);
        const key = isDaily
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { name: key, Revenue: 0, Cost: 0, Profit: 0 };
        monthlyData[key].Revenue += (b.packagePrice || 0) - (b.pphAmount || 0);
      }
    });

    filteredTransactions.forEach(t => {
      const tDate = getTransactionDate(t);
      if (tDate) {
        const date = tDate.toDate ? tDate.toDate() : new Date(tDate);
        const key = isDaily
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { name: key, Revenue: 0, Cost: 0, Profit: 0 };

        if (t.category === 'OTHER') monthlyData[key].Revenue += t.amount;
        if (t.category === 'FIXED COST' || t.category === 'VARIABLE COST') monthlyData[key].Cost += t.amount;
      }
    });

    // Calculate profit per month
    Object.values(monthlyData).forEach(m => {
      m.Profit = m.Revenue - m.Cost;
    });

    const chartData = Object.values(monthlyData).sort((a, b) => a.name.localeCompare(b.name));

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthlyEstimates = Array(12).fill(0).map((_, i) => ({ month: monthNames[i], revenue: 0, cost: 0, netProfit: 0 }));

    filteredBookings.forEach(b => {
      if (['approved', 'in process', 'finished'].includes(b.status) && b.eventDate) {
        const date = b.eventDate.toDate ? b.eventDate.toDate() : new Date(b.eventDate);
        monthlyEstimates[date.getMonth()].revenue += (b.packagePrice || 0) - (b.pphAmount || 0);
      }
    });

    filteredTransactions.forEach(t => {
      const tDate = getTransactionDate(t);
      if (tDate) {
        const date = tDate.toDate ? tDate.toDate() : new Date(tDate);
        const mIndex = date.getMonth();
        if (t.category === 'OTHER') monthlyEstimates[mIndex].revenue += t.amount;
        if (t.category === 'FIXED COST' || t.category === 'VARIABLE COST') monthlyEstimates[mIndex].cost += t.amount;
      }
    });

    monthlyEstimates.forEach(m => {
      m.netProfit = m.revenue - m.cost;
    });

    return {
      totalBookings: filteredBookings.length,
      netSales,
      totalPaymentsReceived,
      piutang,
      rawPiutang,
      totalPackagePrice,
      totalPph,
      otherIncome,
      fixedCost,
      variableCost,
      taxExpense,
      pphUnpaid,
      pphPaid,
      grossProfit,
      netProfit,
      chartData,
      monthlyEstimates
    };
  }, [bookings, transactions, filterType, filterMonth, filterYear, startDate, endDate]);

  const kpiData = useMemo(() => {
    const totalRev = financialData.netSales;
    const netProf = financialData.netProfit;
    const grossProf = financialData.grossProfit;
    const cogs = financialData.variableCost;
    const opex = financialData.fixedCost;
    const collect = financialData.totalPaymentsReceived;
    const ar = financialData.piutang;

    const netSalesActual = 100.0;
    const netProfitActual = totalRev > 0 ? (netProf / totalRev) * 100 : 0;
    const grossProfitActual = totalRev > 0 ? (grossProf / totalRev) * 100 : 0;
    const cogsActual = totalRev > 0 ? (cogs / totalRev) * 100 : 0;
    const opexActual = totalRev > 0 ? (opex / totalRev) * 100 : 0;
    const expProfitActual = netProf > 0 ? ((cogs + opex) / netProf) * 100 : 0;
    const collectActual = totalRev > 0 ? (collect / totalRev) * 100 : 0;
    const arActual = totalRev > 0 ? (ar / totalRev) * 100 : 0;

    return [
      { id: 'netSales', label: 'Net Sales', target: activeKpiTargets.netSales, actual: netSalesActual, up: true, color: 'var(--color-success)' },
      { id: 'netProfit', label: 'Net Profit', target: activeKpiTargets.netProfit, actual: netProfitActual, up: true, color: 'var(--color-success)' },
      { id: 'grossProfit', label: 'Gross Profit', target: activeKpiTargets.grossProfit, actual: grossProfitActual, up: true, color: 'var(--color-success)' },
      { id: 'cogs', label: 'COGS', target: activeKpiTargets.cogs, actual: cogsActual, up: true, color: 'var(--color-success)' },
      { id: 'opex', label: 'OPEX', target: activeKpiTargets.opex, actual: opexActual, up: true, color: 'var(--color-success)' },
      { id: 'expProfit', label: 'EXP Profit', target: activeKpiTargets.expProfit, actual: expProfitActual, up: false, color: '#3B82F6' },
      { id: 'collectRatio', label: 'Collect. Ratio', target: activeKpiTargets.collectRatio, actual: collectActual, up: true, color: 'var(--color-success)' },
      { id: 'arRatio', label: 'AR Ratio', target: activeKpiTargets.arRatio, actual: arActual, up: false, color: '#3B82F6' }
    ];
  }, [financialData, activeKpiTargets]);

  const handleSaveKpi = async (e) => {
    e.preventDefault();
    try {
      setSavingKpi(true);
      const adminId = user?.uid || import.meta.env.VITE_DEFAULT_ADMIN_ID || 'DEFAULT_ADMIN_UID';
      await updateDoc(doc(db, 'siteSettings', adminId), {
        kpiTargets: kpiForm
      });
      setCurrentKpiTargets(kpiForm);
      setShowKpiModal(false);
    } catch (error) {
      console.error('Error saving KPI targets:', error);
      alert('Failed to save KPI targets.');
    } finally {
      setSavingKpi(false);
    }
  };

  // Visitor Analytics Data
  const visitorData = useMemo(() => {
    if (!visitors || visitors.length === 0) return { total: 0, today: 0, topPages: [], deviceBreakdown: { mobile: 0, tablet: 0, desktop: 0 }, filtered: 0 };

    // Apply same filter as financial data
    let filtered = visitors;
    if (filterType === 'month') {
      filtered = visitors.filter(v => {
        if (!v.timestamp) return false;
        const d = v.timestamp.toDate ? v.timestamp.toDate() : new Date(v.timestamp);
        return d.getMonth() + 1 === parseInt(filterMonth) && d.getFullYear() === parseInt(filterYear);
      });
    } else if (filterType === 'custom' && startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filtered = visitors.filter(v => {
        if (!v.timestamp) return false;
        const d = v.timestamp.toDate ? v.timestamp.toDate() : new Date(v.timestamp);
        return d >= s && d <= e;
      });
    }

    // Today's count
    const todayStr = new Date().toDateString();
    const todayCount = filtered.filter(v => {
      if (!v.timestamp) return false;
      const d = v.timestamp.toDate ? v.timestamp.toDate() : new Date(v.timestamp);
      return d.toDateString() === todayStr;
    }).length;

    // Top pages
    const pageCounts = {};
    filtered.forEach(v => {
      const p = v.page || '/';
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, count]) => ({ page, count }));

    // Device breakdown
    const devices = { mobile: 0, tablet: 0, desktop: 0 };
    filtered.forEach(v => {
      const s = v.screenSize || 'desktop';
      if (devices[s] !== undefined) devices[s]++;
    });

    return { total: filtered.length, today: todayCount, topPages, deviceBreakdown: devices, filtered: filtered.length };
  }, [visitors, filterType, filterMonth, filterYear, startDate, endDate]);

  const maxNetProfit = Math.max(1, ...financialData.monthlyEstimates.map(m => Math.abs(m.netProfit)));
  const maxCost = Math.max(1, ...financialData.monthlyEstimates.map(m => m.cost));

  return (
    <div id="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Financial Dashboard</h1>
          <p className="admin-header__subtitle">
            Welcome back, {user?.displayName || 'Admin'}
          </p>
        </div>

        <div className="dashboard-filters">
          <select
            className="form-input admin-search-input"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="month">By Month</option>
            <option value="custom">Date Range</option>
          </select>

          {filterType === 'month' && (
            <>
              <select
                className="form-input admin-search-input"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
                ))}
              </select>
              <select
                className="form-input admin-search-input"
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
              >
                {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() + 5 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}

          {filterType === 'custom' && (
            <>
              <input
                type="date"
                className="form-input admin-search-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span style={{ color: '#888' }}>to</span>
              <input
                type="date"
                className="form-input admin-search-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Net Sales')}>
          <p className="admin-stat__label">Net Sales</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-accent)' }}>{formatRupiah(financialData.netSales)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Payments')}>
          <p className="admin-stat__label">Payments</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-success)' }}>{formatRupiah(financialData.totalPaymentsReceived)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Other Income')}>
          <p className="admin-stat__label">Other Income</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-success)' }}>{formatRupiah(financialData.otherIncome)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Gross Profit')}>
          <p className="admin-stat__label">Gross Profit</p>
          <p className="admin-stat__value" style={{ color: '#fff' }}>{formatRupiah(financialData.grossProfit)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Net Profit')}>
          <p className="admin-stat__label">Net Profit</p>
          <p className="admin-stat__value" style={{ color: '#fff' }}>{formatRupiah(financialData.netProfit)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Unpaid')}>
          <p className="admin-stat__label">Unpaid</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-danger)' }}>{formatRupiah(financialData.piutang)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Fixed Costs')}>
          <p className="admin-stat__label">Fixed Costs</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-danger)' }}>{formatRupiah(financialData.fixedCost)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('Variable Costs')}>
          <p className="admin-stat__label">Variable Costs</p>
          <p className="admin-stat__value" style={{ color: 'var(--color-danger)' }}>{formatRupiah(financialData.variableCost)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('PPh Unpaid')}>
          <p className="admin-stat__label">PPh Unpaid</p>
          <p className="admin-stat__value" style={{ color: '#fff' }}>{formatRupiah(financialData.pphUnpaid)}</p>
        </div>
        <div className="admin-stat" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--color-border)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'transparent' }} onClick={() => setSimulationMetric('PPh Paid (Tax)')}>
          <p className="admin-stat__label">PPh Paid (Tax)</p>
          <p className="admin-stat__value" style={{ color: '#fff' }}>{formatRupiah(financialData.taxExpense)}</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <h2 className="admin-card__title" style={{ marginBottom: '1.5rem' }}>Financial Trend (Revenue vs Cost)</h2>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <AreaChart data={financialData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666' }} tickMargin={15} axisLine={{ stroke: '#333' }} />
              <YAxis width={85} padding={{ bottom: 30 }} stroke="#666" tick={{ fill: '#666' }} tickMargin={10} axisLine={{ stroke: '#333' }} tickFormatter={(value) => value >= 1000000 ? `Rp ${(value / 1000000).toString().replace('.', ',')} Jt` : value >= 1000 ? `Rp ${(value / 1000).toString().replace('.', ',')} Rb` : `Rp ${value}`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(10px)', borderColor: '#333', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value) => `Rp ${formatRupiah(value)}`}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Area type="monotone" dataKey="Revenue" name="Revenue" stroke="var(--color-accent)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Cost" name="Cost" stroke="var(--color-danger)" fillOpacity={1} fill="url(#colorCost)" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Profit" name="Profit" stroke="var(--color-success)" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Analytics */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="admin-card__title" style={{ margin: 0 }}>KPI Analytics</h2>
          <button className="admin-glass-btn" onClick={handleOpenKpiModal}>
            <Settings size={16} /> KPI
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {kpiData.slice(0, 4).map((kpi, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <p style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem', textTransform: 'uppercase' }}>{kpi.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: kpi.color, lineHeight: 1 }}>
                  {kpi.actual.toFixed(1)}%
                </h3>
                {kpi.up && <ArrowUp size={20} strokeWidth={3} color={kpi.color} style={{ transform: 'translateY(-2px)' }} />}
              </div>
              <p style={{ color: '#555', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>Target: {kpi.target}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {kpiData.slice(4, 8).map((kpi, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <p style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem', textTransform: 'uppercase' }}>{kpi.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: kpi.color, lineHeight: 1 }}>
                  {kpi.actual.toFixed(1)}%
                </h3>
                {kpi.up && <ArrowUp size={20} strokeWidth={3} color={kpi.color} style={{ transform: 'translateY(-2px)' }} />}
              </div>
              <p style={{ color: '#555', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>Target: {kpi.target}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="admin-card__title" style={{ margin: 0 }}>Estimasi Bulanan</h2>
          {filterType === 'month' && <span style={{ color: '#888', fontSize: '0.9rem', padding: '0.2rem 0.6rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>Tahun: {filterYear}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <TrendingUp size={20} /> Net Profit
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {financialData.monthlyEstimates.map((m, i) => {
                const widthPercent = maxNetProfit > 0 ? (Math.abs(m.netProfit) / maxNetProfit) * 100 : 0;
                const isEmpty = m.netProfit === 0;
                const isNegative = m.netProfit < 0;
                return (
                  <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem', overflow: 'hidden' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: isEmpty ? '#555' : '#ccc', fontWeight: 500, position: 'relative', zIndex: 1 }}>{m.month}</span>
                    <span style={{ color: isEmpty ? '#555' : isNegative ? 'var(--color-danger)' : '#fff', fontWeight: 600, position: 'relative', zIndex: 1 }}>
                      {isEmpty ? '-' : `${isNegative ? '-' : ''}Rp ${formatRupiah(Math.abs(m.netProfit))}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <TrendingDown size={20} /> Estimasi Cost
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {financialData.monthlyEstimates.map((m, i) => {
                const widthPercent = maxCost > 0 ? (m.cost / maxCost) * 100 : 0;
                const isEmpty = m.cost === 0;
                return (
                  <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem', overflow: 'hidden' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: isEmpty ? '#555' : '#ccc', fontWeight: 500, position: 'relative', zIndex: 1 }}>{m.month}</span>
                    <span style={{ color: isEmpty ? '#555' : 'var(--color-danger)', fontWeight: 600, position: 'relative', zIndex: 1 }}>
                      {isEmpty ? '-' : `Rp ${formatRupiah(m.cost)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Visitor Analytics Section */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <h2 className="admin-card__title" style={{ marginBottom: '1.5rem' }}>Visitor Analytics</h2>

        {/* Visitor Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <Eye size={20} style={{ color: 'var(--color-accent)', marginBottom: '0.5rem' }} />
            <p style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Visitors</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>{visitorData.total}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <Globe size={20} style={{ color: 'var(--color-accent)', marginBottom: '0.5rem' }} />
            <p style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Hari Ini</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>{visitorData.today}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <Monitor size={18} style={{ color: '#888', marginBottom: '0.5rem' }} />
            <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Desktop</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>{visitorData.deviceBreakdown.desktop}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <Tablet size={18} style={{ color: '#888', marginBottom: '0.5rem' }} />
            <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Tablet</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>{visitorData.deviceBreakdown.tablet}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <Smartphone size={18} style={{ color: '#888', marginBottom: '0.5rem' }} />
            <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Mobile</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>{visitorData.deviceBreakdown.mobile}</p>
          </div>
        </div>

        {/* Top Pages */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1.25rem', fontWeight: 600 }}>Top Pages</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visitorData.topPages.length > 0 ? visitorData.topPages.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '6px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: '#ccc', fontWeight: 500, fontSize: '0.9rem' }}>{p.page === '/' ? 'Home' : p.page}</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.9rem' }}>{p.count} visits</span>
              </div>
            )) : (
              <p style={{ color: '#555', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>Belum ada data pengunjung</p>
            )}
          </div>
        </div>
      </div>

      {showKpiModal && kpiForm && (
        <div className="admin-modal-overlay" onClick={() => setShowKpiModal(false)} style={{ zIndex: 12000 }}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Standar KPI (%)</h3>
              <button className="admin-modal__close" onClick={() => setShowKpiModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleSaveKpi} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>Net Sales</label>
                    <input type="text" className="form-input" value={kpiForm.netSales} onChange={e => setKpiForm({ ...kpiForm, netSales: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>Net Profit</label>
                    <input type="text" className="form-input" value={kpiForm.netProfit} onChange={e => setKpiForm({ ...kpiForm, netProfit: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>Gross Profit</label>
                    <input type="text" className="form-input" value={kpiForm.grossProfit} onChange={e => setKpiForm({ ...kpiForm, grossProfit: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>COGS</label>
                    <input type="text" className="form-input" value={kpiForm.cogs} onChange={e => setKpiForm({ ...kpiForm, cogs: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>OPEX</label>
                    <input type="text" className="form-input" value={kpiForm.opex} onChange={e => setKpiForm({ ...kpiForm, opex: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>Exp to Profit</label>
                    <input type="text" className="form-input" value={kpiForm.expProfit} onChange={e => setKpiForm({ ...kpiForm, expProfit: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>Collection Ratio</label>
                    <input type="text" className="form-input" value={kpiForm.collectRatio} onChange={e => setKpiForm({ ...kpiForm, collectRatio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#888', fontWeight: 600 }}>AR Ratio</label>
                    <input type="text" className="form-input" value={kpiForm.arRatio} onChange={e => setKpiForm({ ...kpiForm, arRatio: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="admin-btn admin-btn--primary" style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', fontSize: '1rem' }} disabled={savingKpi}>
                  {savingKpi ? 'Menyimpan...' : 'Simpan Standar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {simulationMetric && (
        <div className="admin-modal-overlay" onClick={() => setSimulationMetric(null)} style={{ zIndex: 12000 }}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '600px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Simulasi {simulationMetric}</h3>
              <button className="admin-modal__close" onClick={() => setSimulationMetric(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem 1rem' }}>
              {simulationMetric === 'Net Sales' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Total penjualan murni dari layanan. Uang pajak (PPh) tidak dimasukkan karena bukan pendapatan bisnis.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: '#ccc', fontSize: '1rem' }}><span>Total Tagihan Klien</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.totalPackagePrice)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '1rem' }}><span>Total PPh (Pajak)</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.totalPph)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #333', color: 'var(--color-accent)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>= Net Sales</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.netSales)}</span></div>
                  </div>
                </>
              )}
              {simulationMetric === 'Gross Profit' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Laba kotor bisnis sebelum dikurangi biaya variabel.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-accent)', fontSize: '1rem' }}><span>Net Sales</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.netSales)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '1rem' }}><span>Fixed Costs</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.fixedCost)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #333', color: '#fff', fontWeight: 'bold', fontSize: '1.15rem' }}><span>= Gross Profit</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.grossProfit)}</span></div>
                  </div>
                </>
              )}
              {simulationMetric === 'Net Profit' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Keuntungan bersih setelah dikurangi seluruh biaya operasional.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-accent)', fontSize: '1rem' }}><span>Net Sales</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.netSales)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-success)', fontSize: '1rem' }}><span>Other Income</span> <span style={{ whiteSpace: 'nowrap' }}>+ Rp {formatRupiah(financialData.otherIncome)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-danger)', fontSize: '1rem' }}><span>Fixed Costs</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.fixedCost)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '1rem' }}><span>Variable Costs</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.variableCost)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #333', color: '#fff', fontWeight: 'bold', fontSize: '1.15rem' }}><span>= Net Profit</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.netProfit)}</span></div>
                  </div>
                </>
              )}
              {simulationMetric === 'Unpaid' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Sisa tagihan klien yang belum terbayar.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-accent)', fontSize: '1rem' }}><span>Net Sales</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.netSales)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-success)', fontSize: '1rem' }}><span>Payments</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.totalPaymentsReceived)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #333', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>= Unpaid</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.piutang)}</span></div>
                  </div>
                </>
              )}
              {simulationMetric === 'PPh Unpaid' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Total Pajak PPh yang belum disetor melalui halaman Pajak PPh.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', color: '#ccc', fontSize: '1rem' }}><span>Total Tanggungan PPh</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.totalPph)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-success)', fontSize: '1rem' }}><span>PPh Sudah Disetor</span> <span style={{ whiteSpace: 'nowrap' }}>- Rp {formatRupiah(financialData.pphPaid)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #333', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>= PPh Belum Disetor</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.pphUnpaid)}</span></div>
                  </div>
                </>
              )}
              {simulationMetric === 'Payments' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Total pembayaran yang diterima dari klien (status: approved).</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>Total Payments</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.totalPaymentsReceived)}</span></div>
                  </div>
                  <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Sumber: Transaksi Cashflow kategori PAYMENT (Income)</p>
                </>
              )}
              {simulationMetric === 'Other Income' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Pendapatan lain-lain di luar layanan utama.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>Total Other Income</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.otherIncome)}</span></div>
                  </div>
                  <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Sumber: Transaksi Cashflow kategori OTHER</p>
                </>
              )}
              {simulationMetric === 'Fixed Costs' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Biaya tetap operasional bisnis.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>Total Fixed Costs</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.fixedCost)}</span></div>
                  </div>
                  <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Sumber: Transaksi Cashflow kategori FIXED COST</p>
                </>
              )}
              {simulationMetric === 'Variable Costs' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Biaya variabel yang berubah sesuai volume pekerjaan.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>Total Variable Costs</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.variableCost)}</span></div>
                  </div>
                  <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Sumber: Transaksi Cashflow kategori VARIABLE COST</p>
                </>
              )}
              {simulationMetric === 'PPh Paid (Tax)' && (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Total pajak PPh yang sudah disetor melalui halaman Pajak PPh dan masuk ke Cashflow.</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.15rem' }}><span>Total PPh Paid</span> <span style={{ whiteSpace: 'nowrap' }}>Rp {formatRupiah(financialData.taxExpense)}</span></div>
                  </div>
                  <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Sumber: Transaksi Cashflow kategori PAJAK PPH (Expense)</p>
                </>
              )}
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #1e1e1e', textAlign: 'right' }}>
              <button className="admin-btn admin-btn--primary" onClick={() => setSimulationMetric(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
