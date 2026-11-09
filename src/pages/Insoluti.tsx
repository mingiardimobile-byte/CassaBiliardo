import { useState } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime } from '@/lib/utils';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import PasswordInput from '@/components/PasswordInput';
import { Trash2, AlertTriangle, CheckCircle, Filter } from 'lucide-react';

export default function Insoluti() {
  const { athletes, suspendedOrders, voidInsoluto, unlockAdmin } = useStore();
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const { confirm, dialog } = useConfirm();

  const insolutoOrders = suspendedOrders.filter((o) => o.status === 'insoluto');
  const debtAthletes = athletes.filter((a) => a.debt > 0);

  const tryDelete = async () => {
    if (!deleteId) return;
    if (!unlockAdmin(pw)) {
      setErr(true);
      return;
    }
    voidInsoluto(deleteId);
    setDeleteId(null);
    setPw('');
    setErr(false);
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Insoluti</h1>
          <p className="text-sm text-gray-500">{debtAthletes.length} atleti con debito</p>
        </div>
        <div className="flex gap-1">
          {(['all', 'open', 'paid'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn-ghost text-sm ${filter === f ? 'border-accent text-accent' : ''}`}
            >
              {f === 'all' ? 'Tutti' : f === 'open' ? 'Aperti' : 'Saldati'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Debiti per atleta</h2>
          {debtAthletes.length === 0 ? (
            <div className="card p-8 text-center">
              <CheckCircle className="mx-auto text-success mb-2" size={32} />
              <p className="text-gray-500 text-sm">Nessun debito aperto.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {debtAthletes.map((a) => (
                <div key={a.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-gray-200 font-medium">{a.name}</p>
                    <p className="text-xs text-gray-500">Debito totale</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-danger font-semibold">{fmtEuro(a.debt)}</span>
                    <button
                      className="btn-success text-xs"
                      onClick={async () => {
                        if (await confirm(`Salpare il debito di ${a.name}?`)) {
                          const revenue = {
                            id: Math.random().toString(36).slice(2),
                            source: 'sospeso' as const,
                            description: `Debito saldato - ${a.name}`,
                            amount: a.debt,
                            at: Date.now(),
                            operator: useStore.getState().currentOperator || 'Operatore',
                          };
                          useStore.setState({
                            revenueLines: [...useStore.getState().revenueLines, revenue],
                            athletes: useStore.getState().athletes.map((x) =>
                              x.id === a.id ? { ...x, debt: 0 } : x
                            ),
                          });
                          useStore.getState().logAudit('Debito saldato', `${a.name} €${a.debt.toFixed(2)}`);
                        }
                      }}
                    >
                      Salda
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Storico insoluti</h2>
          {insolutoOrders.length === 0 ? (
            <div className="card p-8 text-center">
              <AlertTriangle className="mx-auto text-gray-700 mb-2" size={32} />
              <p className="text-gray-500 text-sm">Nessun insoluto registrato.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {insolutoOrders.map((o) => (
                <div key={o.id} className="card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-200 font-medium">{o.athleteName}</p>
                      <p className="text-xs text-gray-500">{fmtDateTime(o.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-danger font-semibold">{fmtEuro(o.total)}</span>
                      <button
                        className="text-gray-600 hover:text-danger"
                        onClick={() => { setDeleteId(o.id); setErr(false); setPw(''); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {o.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {deleteId && (
        <Modal
          open
          onClose={() => setDeleteId(null)}
          title="Elimina insoluto"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDeleteId(null)}>Annulla</button>
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
