import { useMemo } from 'react';
import { useStore } from '@/store';
import { fmtEuro } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function Statistiche() {
  const reconciliations = useStore((s) => s.reconciliations);
  const revenueLines = useStore((s) => s.revenueLines);
  const expenses = useStore((s) => s.expenses);

  const weekly = useMemo(() => {
    const days: { label: string; revenue: number; date: string }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayIdx = (d.getDay() + 6) % 7;
      const rec = reconciliations.find((r) => r.date === ds);
      let rev = rec?.revenue ?? 0;
      if (!rec && i === 0) {
        rev = revenueLines.filter((r) => !r.voided && r.at >= new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()).reduce((s, r) => s + r.amount, 0);
      }
      days.push({ label: DAY_LABELS[dayIdx], revenue: rev, date: ds });
    }
    return days;
  }, [reconciliations, revenueLines]);

  const maxWeekly = Math.max(...weekly.map((d) => d.revenue), 1);

  const monthly = useMemo(() => {
    const now = new Date();
    const thisMonth = reconciliations.filter((r) => r.year === now.getFullYear() && r.month === now.getMonth() + 1);
    const thisTotal = thisMonth.reduce((s, r) => s + r.revenue, 0);

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = reconciliations.filter((r) => r.year === prevMonthDate.getFullYear() && r.month === prevMonthDate.getMonth() + 1);
    const prevTotal = prevMonth.reduce((s, r) => s + r.revenue, 0);
    const momChange = prevTotal ? ((thisTotal - prevTotal) / prevTotal) * 100 : 0;

    const lastYear = reconciliations.filter((r) => r.year === now.getFullYear() - 1 && r.month === now.getMonth() + 1);
    const lastYearTotal = lastYear.reduce((s, r) => s + r.revenue, 0);
    const yoyChange = lastYearTotal ? ((thisTotal - lastYearTotal) / lastYearTotal) * 100 : 0;

    return { thisTotal, prevTotal, momChange, lastYearTotal, yoyChange };
  }, [reconciliations]);

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Statistiche</h1>
        <p className="text-sm text-gray-500">Settimanale e mensile</p>
      </header>

      <section className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-accent" /> Incassi settimanali
        </h2>
        <div className="space-y-2">
          {weekly.map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-10">{d.label}</span>
              <div className="flex-1 h-7 bg-black/40 rounded relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent-dark transition-all"
                  style={{ width: `${(d.revenue / maxWeekly) * 100}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">
                  {fmtEuro(d.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-accent" /> Confronto mensile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/40 rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">Questo mese</p>
            <p className="text-2xl text-accent font-bold">{fmtEuro(monthly.thisTotal)}</p>
          </div>
          <div className="bg-black/40 rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">Mese scorso</p>
            <p className="text-xl text-gray-200 font-semibold">{fmtEuro(monthly.prevTotal)}</p>
            <p className={`text-sm flex items-center gap-1 mt-1 ${monthly.momChange >= 0 ? 'text-success' : 'text-danger'}`}>
              {monthly.momChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {monthly.momChange >= 0 ? '+' : ''}{monthly.momChange.toFixed(1)}% MoM
            </p>
          </div>
          <div className="bg-black/40 rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">Anno scorso</p>
            <p className="text-xl text-gray-200 font-semibold">{fmtEuro(monthly.lastYearTotal)}</p>
            <p className={`text-sm flex items-center gap-1 mt-1 ${monthly.yoyChange >= 0 ? 'text-success' : 'text-danger'}`}>
              {monthly.yoyChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {monthly.yoyChange >= 0 ? '+' : ''}{monthly.yoyChange.toFixed(1)}% YoY
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-600 mt-4">Spese di oggi (non chiuse): {fmtEuro(totalExp)}</p>
    </div>
  );
}
