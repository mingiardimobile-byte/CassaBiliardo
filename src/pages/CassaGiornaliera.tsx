import { useState } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime, downloadJSON } from '@/lib/utils';
import Modal from '@/components/Modal';
import PasswordInput from '@/components/PasswordInput';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Printer, Mail, Download,
  Ban, AlertTriangle, Send,
} from 'lucide-react';

const EXPENSE_CATEGORIES = ['Manutenzione', 'Fornitori', 'Utenze', 'Personale', 'Altro'];

export default function CassaGiornaliera() {
  const {
    fund, setFund, expenses, addExpense, deleteExpense,
    revenueLines, voidRevenueLine, settings, closeReconciliation, tables, cumulativeTotalizer,
  } = useStore();
  const [expOpen, setExpOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const { confirm, dialog } = useConfirm();

  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState(EXPENSE_CATEGORIES[0]);
  const [expAmt, setExpAmt] = useState(0);

  const activeRevenue = revenueLines.filter((r) => !r.voided);
  const totalRevenue = activeRevenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const net = totalRevenue - totalExpenses;

  // CUMULATIVE totalizer: permanent historical counter (started 28/02/2025).
  // Grows only when tables close. Owner override takes precedence when set for today.
  const generalOverride =
    settings.generalTotalizerOverrideDate === new Date().toISOString().slice(0, 10)
      ? settings.generalTotalizerOverride ?? 0
      : 0;
  const totalizzatoreStorico = generalOverride || cumulativeTotalizer;

  // Today's theoretical (feeds daily reconciliation)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const closedToday = tables.filter(
    (t) => t.closedAt && t.closedAt >= startOfDayMs && !t.deleted
  );

  const tavoliTheoretical = closedToday.reduce((s, t) => s + (t.theoreticalCost ?? 0), 0);

  // Separated revenue categories
  const incassoTavoli = activeRevenue
    .filter((r) => r.source === 'tavolo')
    .reduce((s, r) => s + r.amount, 0);
  const incassoBar = activeRevenue
    .filter((r) => r.source === 'bar' || r.source === 'sospeso')
    .reduce((s, r) => s + r.amount, 0);
  const incassoAbbonamenti = activeRevenue
    .filter((r) => r.source === 'abbonamento')
    .reduce((s, r) => s + r.amount, 0);

  // SECTION A breakdown
  const scontiTavoli = closedToday.reduce((s, t) => s + t.discountAmount, 0);
  const arrotondamentiTavoli = closedToday.reduce((s, t) => s + t.roundingAmount, 0);
  const storni = revenueLines.filter((r) => r.voided).reduce((s, r) => s + r.amount, 0);
  const diffTavoli = tavoliTheoretical - incassoTavoli;

  // SECTION B breakdown
  const scontiBar = closedToday.reduce((s, t) => s + t.barDiscount, 0);
  const arrotondamentiBar = closedToday.reduce((s, t) => s + t.barRounding, 0);

  // Reconciliation formula: Incasso Teorico - Sconti + Arrotondamenti = Incasso Reale
  const incassoTeoricoTotale = tavoliTheoretical;
  const scontiTotali = scontiTavoli + scontiBar;
  const arrotondamentiTotali = arrotondamentiTavoli + arrotondamentiBar;

  const doVoid = () => {
    if (!voidId) return;
    if (pw !== settings.ownerPassword) {
      setErr(true);
      return;
    }
    voidRevenueLine(voidId);
    setVoidId(null);
    setPw('');
    setErr(false);
  };

  const handleClose = async () => {
    const ok = await confirm('Confermi la chiusura della cassa di oggi?', {
      title: 'Invia e Chiudi Cassa',
      confirmLabel: 'Chiudi',
    });
    if (!ok) return;
    const rec = closeReconciliation();
    downloadJSON(`backup_cassa_${rec.date}.json`, {
      reconciliation: rec,
      fullState: useStore.getState(),
    });
    setCloseOpen(true);
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Cassa Giornaliera</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        <button className="btn-accent" onClick={handleClose}>
          <Send size={16} /> Invia e Chiudi Cassa
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Fondo Cassa Iniziale"
          value={fmtEuro(fund)}
          icon={<Wallet size={18} />}
          editable
          onEdit={() => {
            const v = prompt('Nuovo fondo cassa (€):', String(fund));
            if (v !== null) setFund(+v || 0);
          }}
        />
        <StatCard label="Totalizzatore Nominale (Storico)" value={fmtEuro(totalizzatoreStorico)} icon={<TrendingUp size={18} />} accent />
        <StatCard label="Incasso Reale Totale" value={fmtEuro(totalRevenue)} icon={<TrendingUp size={18} />} success />
        <StatCard label="Utile Netto" value={fmtEuro(net)} icon={<TrendingDown size={18} />} danger={net < 0} success={net >= 0} />
      </div>

      <section className="card p-4 mb-6">
        <h2 className="font-semibold text-gray-100 mb-3">Incasso Reale — per categoria</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RevenueCat label="Incasso Tavoli" value={incassoTavoli} accent />
          <RevenueCat label="Incasso Bar" value={incassoBar} />
          <RevenueCat label="Incasso Abbonamenti" value={incassoAbbonamenti} />
        </div>
        <div className="border-t border-border mt-3 pt-3 flex justify-between font-semibold">
          <span className="text-gray-300">Incasso Reale Totale</span>
          <span className="text-success text-lg">{fmtEuro(totalRevenue)}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Incassi</h2>
            <span className="text-xs text-gray-500">{activeRevenue.length} movimenti</span>
          </div>
          {revenueLines.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Nessun incasso oggi.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {revenueLines.map((r) => (
                <div key={r.id} className={`flex items-center justify-between p-2 rounded ${r.voided ? 'bg-danger/10 opacity-60' : 'bg-black/40'}`}>
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${r.voided ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                      {r.description}
                    </p>
                    <p className="text-xs text-gray-600">
                      {fmtDateTime(r.at)} · {sourceLabel(r.source)} {r.operator && `· ${r.operator}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${r.voided ? 'text-gray-600 line-through' : 'text-accent'}`}>
                      {fmtEuro(r.amount)}
                    </span>
                    {!r.voided && (
                      <button
                        className="text-danger hover:text-red-400"
                        title="Annulla (richiede password)"
                        onClick={() => { setVoidId(r.id); setPw(''); setErr(false); }}
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Spese</h2>
            <button className="btn-ghost text-sm" onClick={() => setExpOpen(true)}>
              <Plus size={14} /> Aggiungi
            </button>
          </div>
          {expenses.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Nessuna spesa oggi.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded bg-black/40">
                  <div>
                    <p className="text-sm text-gray-200">{e.description}</p>
                    <p className="text-xs text-gray-600">{e.category} · {fmtDateTime(e.at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-danger font-semibold">-{fmtEuro(e.amount)}</span>
                    <button className="text-gray-600 hover:text-danger" onClick={() => deleteExpense(e.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3 flex justify-between text-sm">
            <span className="text-gray-400">Totale spese</span>
            <span className="text-danger font-semibold">{fmtEuro(totalExpenses)}</span>
          </div>
        </section>
      </div>

      {/* SECTION A — TAVOLI */}
      <section className="card p-4 mt-6 border-accent/20">
        <h2 className="font-semibold text-accent mb-3">SEZIONE A — TAVOLI</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Totalizzatore Nominale Tavoli (storico)</p>
            <p className="text-accent font-semibold">{fmtEuro(totalizzatoreStorico)}</p>
          </div>
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Incasso Teorico Tavoli (oggi)</p>
            <p className="text-gray-200 font-semibold">{fmtEuro(tavoliTheoretical)}</p>
          </div>
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Incasso Reale Tavoli (oggi)</p>
            <p className="text-success font-semibold">{fmtEuro(incassoTavoli)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 uppercase mb-2">Differenza — breakdown</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <DiffLine label="Sconti Tavoli" value={scontiTavoli} />
          <DiffLine label="Arrotondamenti Tavoli" value={arrotondamentiTavoli} />
          <DiffLine label="Storni" value={storni} />
        </div>
        <div className="border-t border-border mt-3 pt-2 flex justify-between text-sm">
          <span className="text-gray-400">Differenza Tavoli</span>
          <span className={`font-semibold ${diffTavoli > 0 ? 'text-danger' : 'text-gray-300'}`}>{fmtEuro(diffTavoli)}</span>
        </div>
      </section>

      {/* SECTION B — BAR */}
      <section className="card p-4 mt-4 border-blue-500/20">
        <h2 className="font-semibold text-blue-400 mb-3">SEZIONE B — BAR</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Incasso Bar (oggi)</p>
            <p className="text-success font-semibold">{fmtEuro(incassoBar)}</p>
          </div>
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Sconti Bar</p>
            <p className="text-danger font-semibold">{fmtEuro(scontiBar)}</p>
          </div>
          <div className="bg-black/40 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Arrotondamenti Bar</p>
            <p className="text-gray-200 font-semibold">{fmtEuro(arrotondamentiBar)}</p>
          </div>
        </div>
      </section>

      {/* SECTION C — ABBONAMENTI */}
      <section className="card p-4 mt-4 border-success/20">
        <h2 className="font-semibold text-success mb-3">SEZIONE C — ABBONAMENTI</h2>
        <div className="bg-black/40 rounded p-3">
          <p className="text-xs text-gray-500 uppercase">Incasso Abbonamenti (oggi)</p>
          <p className="text-success font-semibold text-lg">{fmtEuro(incassoAbbonamenti)}</p>
        </div>
      </section>

      {/* TOTALE + Riconciliazione formula */}
      <section className="card p-4 mt-4">
        <h2 className="font-semibold text-gray-100 mb-3">Totale & Riconciliazione</h2>
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-200 font-semibold">Incasso Reale Totale Oggi</span>
            <span className="text-success font-bold">{fmtEuro(totalRevenue)}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-400">- Spese</span>
            <span className="text-danger">{fmtEuro(totalExpenses)}</span>
          </div>
          <div className="flex justify-between text-lg mt-2 border-t border-border pt-2">
            <span className="text-gray-100 font-bold">Utile Netto</span>
            <span className={`font-bold ${net >= 0 ? 'text-success' : 'text-danger'}`}>{fmtEuro(net)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <DiffLine label="Incasso Teorico" value={incassoTeoricoTotale} />
          <DiffLine label="Sconti Totali" value={scontiTotali} />
          <DiffLine label="Arrotondamenti Totali" value={arrotondamentiTotali} />
          <DiffLine label="Incasso Reale" value={incassoTavoli + incassoBar} />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Formula: Incasso Teorico − Sconti + Arrotondamenti = Incasso Reale
        </p>
      </section>

      {expOpen && (
        <Modal
          open
          onClose={() => setExpOpen(false)}
          title="Nuova spesa"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setExpOpen(false)}>Annulla</button>
              <button
                className="btn-accent"
                disabled={!expDesc.trim()}
                onClick={() => {
                  addExpense({ description: expDesc.trim(), category: expCat, amount: expAmt, at: Date.now() });
                  setExpDesc(''); setExpAmt(0); setExpOpen(false);
                }}
              >
                Salva
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Descrizione</label>
              <input className="input" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={expCat} onChange={(e) => setExpCat(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Importo (€)</label>
                <input type="number" step="0.10" min="0" className="input" value={expAmt} onChange={(e) => setExpAmt(+e.target.value)} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {voidId && (
        <Modal
          open
          onClose={() => setVoidId(null)}
          title="Annulla incasso"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setVoidId(null)}>Annulla</button>
              <button className="btn-danger" onClick={doVoid}>
                <Ban size={14} /> Conferma Storno
              </button>
            </>
          }
        >
          <div className="flex gap-3 items-start mb-3">
            <AlertTriangle className="text-danger" size={22} />
            <p className="text-gray-300">Questa operazione storna l'incasso. Richiede password admin.</p>
          </div>
          <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(false); }} onSubmit={doVoid} />
          {err && <p className="text-danger text-sm mt-2">Password errata</p>}
        </Modal>
      )}

      {closeOpen && (
        <Modal
          open
          onClose={() => setCloseOpen(false)}
          title="Cassa chiusa"
          footer={<button className="btn-accent" onClick={() => setCloseOpen(false)}>Fatto</button>}
        >
          <p className="text-gray-300 mb-4">Backup automatico scaricato. Scegli un'azione:</p>
          <div className="grid grid-cols-1 gap-2">
            <button className="btn-ghost" onClick={() => window.print()}>
              <Printer size={16} /> Stampa
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                const rec = useStore.getState().reconciliations.slice(-1)[0];
                if (rec) downloadJSON(`cassa_${rec.date}.json`, rec);
              }}
            >
              <Download size={16} /> Scarica PDF / JSON
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                const rec = useStore.getState().reconciliations.slice(-1)[0];
                if (!rec) return;
                const body = encodeURIComponent(
                  `Cassa del ${rec.date}\nFondo: ${fmtEuro(rec.fund)}\nIncasso: ${fmtEuro(rec.revenue)}\nSpese: ${fmtEuro(rec.expenses)}\nUtile: ${fmtEuro(rec.net)}`
                );
                window.location.href = `mailto:${settings.email}?subject=Cassa ${rec.date}&body=${body}`;
              }}
            >
              <Mail size={16} /> Invia Email
            </button>
          </div>
        </Modal>
      )}

      {dialog}
    </div>
  );
}

function sourceLabel(s: string) {
  if (s === 'tavolo') return 'Tavolo';
  if (s === 'bar') return 'Bar';
  if (s === 'sospeso') return 'Sospeso';
  if (s === 'abbonamento') return 'Abbonamento';
  return s;
}

function RevenueCat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-black/40 rounded-lg p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${accent ? 'text-accent' : 'text-gray-100'}`}>{fmtEuro(value)}</p>
    </div>
  );
}

function DiffLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/40 rounded p-2">
      <p className="text-gray-500">{label}</p>
      <p className="text-gray-300 font-medium">{fmtEuro(value)}</p>
    </div>
  );
}

function StatCard({
  label, value, icon, accent, success, danger, editable, onEdit,
}: {
  label: string; value: string; icon: React.ReactNode;
  accent?: boolean; success?: boolean; danger?: boolean;
  editable?: boolean; onEdit?: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
        <span className={accent ? 'text-accent' : success ? 'text-success' : danger ? 'text-danger' : 'text-gray-600'}>
          {icon}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-xl font-bold ${accent ? 'text-accent' : success ? 'text-success' : danger ? 'text-danger' : 'text-gray-100'}`}>
          {value}
        </p>
        {editable && (
          <button className="text-xs text-gray-600 hover:text-accent" onClick={onEdit}>modifica</button>
        )}
      </div>
    </div>
  );
}
