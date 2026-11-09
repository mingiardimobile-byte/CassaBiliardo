import { useState } from 'react';
import { useStore } from '@/store';
import type { Subscription } from '@/types';
import { fmtEuro, fmtDate, todayStr } from '@/lib/utils';
import Modal from '@/components/Modal';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { Plus, Trash2, CreditCard, CheckCircle, XCircle } from 'lucide-react';

const PRESETS = [0, 50, 150];

export default function Abbonamenti() {
  const { subscriptions, athletes, addSubscription, deleteSubscription, paySubscription, updateSubscription } = useStore();
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const [athleteId, setAthleteId] = useState('');
  const [fee, setFee] = useState(50);
  const [customFee, setCustomFee] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');

  const activeCount = subscriptions.filter((s) => s.status === 'attivo' || s.status === 'pagato').length;

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Abbonamenti</h1>
          <p className="text-sm text-gray-500">{activeCount} attivi · {subscriptions.length} totali</p>
        </div>
        <button className="btn-accent" onClick={() => setOpen(true)}>
          <Plus size={16} /> Nuovo Abbonamento
        </button>
      </header>

      {subscriptions.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="mx-auto text-gray-700 mb-3" size={48} />
          <p className="text-gray-500">Nessun abbonamento registrato.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {subscriptions.map((s) => (
            <div key={s.id} className={`card p-4 ${s.status === 'pagato' ? 'border-success/40' : s.status === 'scaduto' ? 'border-danger/40' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-100">{s.athleteName}</p>
                  <p className="text-accent font-semibold mt-1">{fmtEuro(s.fee)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  s.status === 'pagato' ? 'bg-success/20 text-success' :
                  s.status === 'attivo' ? 'bg-accent/20 text-accent' :
                  'bg-danger/20 text-danger'
                }`}>
                  {s.status === 'pagato' ? 'PAGATO' : s.status === 'attivo' ? 'ATTIVO' : 'SCADUTO'}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                <p>Dal: {fmtDate(new Date(s.startDate).getTime())}</p>
                <p>Al: {fmtDate(new Date(s.endDate).getTime())}</p>
                {s.paymentDate && <p>Pagato: {fmtDate(new Date(s.paymentDate).getTime())}</p>}
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-border">
                {s.status !== 'pagato' && (
                  <button className="btn-success text-xs flex-1" onClick={() => paySubscription(s.id)}>
                    <CheckCircle size={14} /> Segna Pagato
                  </button>
                )}
                {s.status === 'attivo' && (
                  <button className="btn-ghost text-xs" onClick={() => updateSubscription(s.id, { status: 'scaduto' })}>
                    <XCircle size={14} /> Scaduto
                  </button>
                )}
                <button
                  className="text-gray-600 hover:text-danger p-2"
                  onClick={async () => { if (await confirm('Eliminare abbonamento?')) deleteSubscription(s.id); }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Nuovo Abbonamento"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setOpen(false)}>Annulla</button>
              <button
                className="btn-accent"
                disabled={!athleteId || !endDate}
                onClick={() => {
                  const a = athletes.find((x) => x.id === athleteId)!;
                  addSubscription({
                    athleteId,
                    athleteName: a.name,
                    fee: customFee ? +customFee : fee,
                    startDate,
                    endDate,
                    status: 'attivo',
                    paymentDate: null,
                  });
                  setOpen(false);
                  setAthleteId(''); setCustomFee(''); setEndDate('');
                }}
              >
                Crea
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Atleta</label>
              <select className="input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
                <option value="">Seleziona...</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quota</label>
              <div className="flex gap-2 mb-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`btn-ghost text-sm flex-1 ${fee === p && !customFee ? 'border-accent text-accent' : ''}`}
                    onClick={() => { setFee(p); setCustomFee(''); }}
                  >
                    €{p}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.10"
                min="0"
                className="input"
                placeholder="Oppure importo custom"
                value={customFee}
                onChange={(e) => setCustomFee(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Inizio</label>
                <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Fine</label>
                <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {dialog}
    </div>
  );
}
