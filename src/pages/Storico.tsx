import { useState } from 'react';
import { useStore } from '@/store';
import type { Reconciliation } from '@/types';
import { fmtEuro, fmtDate, downloadText } from '@/lib/utils';
import Modal from '@/components/Modal';
import PasswordInput from '@/components/PasswordInput';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { Calendar, Trash2, Printer, ChevronRight, X } from 'lucide-react';

export default function Storico() {
  const { reconciliations, deleteReconciliation, deleteAllReconciliations, settings } = useStore();
  const [selected, setSelected] = useState<Reconciliation | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [delAll, setDelAll] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const { confirm, dialog } = useConfirm();

  const tryDelete = () => {
    if (pw !== settings.ownerPassword) { setErr(true); return; }
    if (delId) deleteReconciliation(delId);
    if (delAll) deleteAllReconciliations();
    setDelId(null); setDelAll(false); setPw(''); setErr(false);
  };

  const weeklySummary = () => {
    const lines = ['Storico Settimanale\n', ...reconciliations.slice(-7).map((r) =>
      `${r.date} | Incasso: ${fmtEuro(r.revenue)} | Spese: ${fmtEuro(r.expenses)} | Utile: ${fmtEuro(r.net)}`
    )];
    downloadText('storico_settimanale.txt', lines.join('\n'));
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Storico</h1>
          <p className="text-sm text-gray-500">{reconciliations.length} chiusure registrate</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={weeklySummary}>
            <Printer size={14} /> Stampa Settimanale
          </button>
          <button
            className="btn-danger text-sm"
            disabled={reconciliations.length === 0}
            onClick={async () => {
              if (await confirm('Eliminare TUTTI gli storici?')) { setDelAll(true); setPw(''); setErr(false); }
            }}
          >
            <Trash2 size={14} /> Elimina Tutti
          </button>
        </div>
      </header>

      {reconciliations.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="mx-auto text-gray-700 mb-3" size={48} />
          <p className="text-gray-500">Nessuno storico. Le chiusure appariranno qui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...reconciliations].reverse().map((r) => (
            <div key={r.id} className="card p-3 flex items-center justify-between hover:border-accent/40">
              <button className="flex-1 text-left flex items-center justify-between" onClick={() => setSelected(r)}>
                <div>
                  <p className="font-medium text-gray-200">{fmtDate(new Date(r.date).getTime())}</p>
                  <p className="text-xs text-gray-500">
                    Incasso {fmtEuro(r.revenue)} · Spese {fmtEuro(r.expenses)} · Utile {fmtEuro(r.net)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-accent font-semibold">{fmtEuro(r.net)}</span>
                  <ChevronRight className="text-gray-600" size={16} />
                </div>
              </button>
              <button
                className="text-gray-600 hover:text-danger ml-2"
                onClick={() => { setDelId(r.id); setPw(''); setErr(false); }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={fmtDate(new Date(selected.date).getTime())}
          maxWidth="max-w-2xl"
          footer={
            <>
              <button className="btn-ghost" onClick={() => window.print()}><Printer size={14} /> Stampa</button>
              <button className="btn-accent" onClick={() => setSelected(null)}>Chiudi</button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Fondo" value={fmtEuro(selected.fund)} />
              <Stat label="Incasso" value={fmtEuro(selected.revenue)} />
              <Stat label="Spese" value={fmtEuro(selected.expenses)} />
              <Stat label="Utile" value={fmtEuro(selected.net)} />
              <Stat label="Totalizzatore" value={fmtEuro(selected.nominalTotalizer)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Incassi</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selected.revenueLines.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm bg-black/40 rounded px-2 py-1">
                    <span className="text-gray-300">{r.description}</span>
                    <span className="text-accent">{fmtEuro(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Spese</h3>
              <div className="space-y-1">
                {selected.expensesList.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm bg-black/40 rounded px-2 py-1">
                    <span className="text-gray-300">{e.description} <span className="text-gray-600">({e.category})</span></span>
                    <span className="text-danger">{fmtEuro(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {(delId || delAll) && (
        <Modal
          open
          onClose={() => { setDelId(null); setDelAll(false); }}
          title={delAll ? 'Elimina tutti gli storici' : 'Elimina storico'}
          footer={
            <>
              <button className="btn-ghost" onClick={() => { setDelId(null); setDelAll(false); }}>Annulla</button>
              <button className="btn-danger" onClick={tryDelete}>Elimina</button>
            </>
          }
        >
          <p className="text-gray-300 mb-3">Richiede password admin.</p>
          <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(false); }} onSubmit={tryDelete} />
          {err && <p className="text-danger text-sm mt-2">Password errata</p>}
        </Modal>
      )}

      {dialog}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/40 rounded-lg p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-lg text-gray-100 font-semibold">{value}</p>
    </div>
  );
}
