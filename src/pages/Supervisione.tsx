import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime } from '@/lib/utils';
import Modal from '@/components/Modal';
import PasswordInput from '@/components/PasswordInput';
import { Shield, AlertTriangle, Trash2, ChevronRight, CheckSquare, Square } from 'lucide-react';

type FilterKey = 'tutti' | 'sconti' | 'storni' | 'operatori';

type DeleteTarget =
  | { kind: 'single'; tableId?: number; auditAt?: number }
  | { kind: 'bulk'; tableIds: number[]; auditAts: number[] }
  | { kind: 'all' };

export default function Supervisione() {
  const {
    tables, auditLog, settings,
    deleteTableRecord, deleteTableRecords, deleteAuditEntry, deleteAuditEntries, deleteAllAudit,
  } = useStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<FilterKey>('tutti');
  const [showDeleted, setShowDeleted] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [selectedAudits, setSelectedAudits] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const dayStart = new Date(date + 'T00:00:00').getTime();
  const dayEnd = dayStart + 86400000;

  const closedToday = useMemo(
    () => tables.filter((t) => t.closedAt && t.closedAt >= dayStart && t.closedAt < dayEnd),
    [tables, dayStart, dayEnd]
  );

  const dayAudit = useMemo(
    () => auditLog.filter((a) => a.at >= dayStart && a.at < dayEnd),
    [auditLog, dayStart, dayEnd]
  );

  const matches = (t: typeof closedToday[number]) => {
    if (filter === 'sconti') return t.discountsApplied > 0;
    if (filter === 'storni') return dayAudit.some((a) => a.action.includes('STORNO') && !a.deleted);
    if (filter === 'operatori') return true;
    return true;
  };

  const filtered = closedToday.filter(matches);
  const visibleTables = filtered.filter((t) => showDeleted || !t.deleted);
  const visibleAudits = dayAudit.filter((a) => showDeleted || !a.deleted);

  const voids = dayAudit.filter((a) => a.action.includes('STORNO') && !a.deleted);
  const bigDiscounts = closedToday.filter((t) => !t.deleted && t.discountsApplied / (t.finalCost || 1) > 0.2);

  const toggleTable = (id: number) => {
    setSelectedTables((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAudit = (at: number) => {
    setSelectedAudits((s) => {
      const n = new Set(s);
      if (n.has(at)) n.delete(at); else n.add(at);
      return n;
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (pw !== settings.ownerPassword) { setErr(true); return; }
    if (deleteTarget.kind === 'single') {
      if (deleteTarget.tableId !== undefined) deleteTableRecord(deleteTarget.tableId);
      if (deleteTarget.auditAt !== undefined) deleteAuditEntry(deleteTarget.auditAt);
    } else if (deleteTarget.kind === 'bulk') {
      if (deleteTarget.tableIds.length) deleteTableRecords(deleteTarget.tableIds);
      if (deleteTarget.auditAts.length) deleteAuditEntries(deleteTarget.auditAts);
    } else if (deleteTarget.kind === 'all') {
      deleteAllAudit();
    }
    setDeleteTarget(null);
    setPw('');
    setErr(false);
    setSelectedTables(new Set());
    setSelectedAudits(new Set());
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Supervisione</h1>
          <p className="text-sm text-gray-500">Controllo giornaliero operazioni</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            className="btn-danger text-sm"
            onClick={() => { setDeleteTarget({ kind: 'all' }); setPw(''); setErr(false); }}
          >
            <Trash2 size={14} /> Elimina Tutto
          </button>
        </div>
      </header>

      {(voids.length > 0 || bigDiscounts.length > 0) && (
        <div className="card p-4 mb-4 border-danger/40">
          <h2 className="text-sm font-semibold text-danger flex items-center gap-2 mb-2">
            <AlertTriangle size={16} /> Avvisi
          </h2>
          <div className="space-y-1 text-sm">
            {voids.map((a, i) => (
              <p key={i} className="text-danger"> STORNO: {a.action} - {a.value} ({a.operator})</p>
            ))}
            {bigDiscounts.map((t) => {
              const pct = (t.discountsApplied / (t.finalCost || 1)) * 100;
              const op = t.operator ?? 'N/D';
              const flagged = pct > 10;
              return (
                <p key={t.id} className={flagged ? 'text-danger' : 'text-accent'}>
                   Sconto {pct.toFixed(0)}% su {t.name} - operatore {op}
                </p>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 overflow-x-auto flex-wrap">
        {(['tutti', 'sconti', 'storni', 'operatori'] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-ghost text-sm whitespace-nowrap ${filter === f ? 'border-accent text-accent' : ''}`}
          >
            {f === 'tutti' ? 'Tutti' : f === 'sconti' ? 'Con Sconti' : f === 'storni' ? 'Con Storni' : 'Solo Operatori'}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-gray-500 ml-2 cursor-pointer">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Mostra eliminati
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Tavoli chiusi ({visibleTables.length})</h2>
            {selectedTables.size > 0 && (
              <button
                className="btn-danger text-xs"
                onClick={() => { setDeleteTarget({ kind: 'bulk', tableIds: [...selectedTables], auditAts: [] }); setPw(''); setErr(false); }}
              >
                <Trash2 size={12} /> Elimina Selezionati ({selectedTables.size})
              </button>
            )}
          </div>
          {visibleTables.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nessun tavolo chiuso in questa data.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {visibleTables.map((t) => {
                const discPct = t.finalCost ? (t.discountsApplied / (t.finalCost + t.discountsApplied)) * 100 : 0;
                const flagged = discPct > 10;
                const sel = selectedTables.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`card p-3 w-full text-left hover:border-accent/40 ${t.deleted ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        className="text-gray-500 hover:text-accent shrink-0"
                        onClick={() => toggleTable(t.id)}
                        disabled={t.deleted}
                      >
                        {sel ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
                      </button>
                      <button className="flex-1 text-left" onClick={() => setDetail(t.id)}>
                        <div className="flex items-center justify-between">
                          <div className={t.deleted ? 'line-through text-gray-600' : ''}>
                            <p className="font-medium text-gray-200">{t.name}</p>
                            <p className="text-xs text-gray-500">
                              {t.lastMatchPlayers.join(', ')} · {t.closedAt && fmtDateTime(t.closedAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-accent font-semibold">{fmtEuro(t.finalCost ?? 0)}</p>
                            {discPct > 0 && (
                              <p className={`text-xs ${flagged ? 'text-danger' : 'text-accent'}`}>sconto {discPct.toFixed(0)}%</p>
                            )}
                            <p className="text-xs text-gray-600">op: {t.operator ?? 'N/D'}</p>
                          </div>
                        </div>
                      </button>
                      {!t.deleted && (
                        <button
                          className="text-danger hover:text-red-400 shrink-0"
                          title="Elimina"
                          onClick={() => { setDeleteTarget({ kind: 'single', tableId: t.id }); setPw(''); setErr(false); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100 flex items-center gap-2">
              <Shield size={16} className="text-accent" /> Audit Log ({visibleAudits.length})
            </h2>
            {selectedAudits.size > 0 && (
              <button
                className="btn-danger text-xs"
                onClick={() => { setDeleteTarget({ kind: 'bulk', tableIds: [], auditAts: [...selectedAudits] }); setPw(''); setErr(false); }}
              >
                <Trash2 size={12} /> Elimina Selezionati ({selectedAudits.size})
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto text-sm">
            {visibleAudits.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nessuna operazione.</p>
            ) : (
              visibleAudits.map((a) => {
                const isVoid = a.action.includes('STORNO');
                const isDisc = a.action.toLowerCase().includes('sconto');
                const flagged = isVoid || isDisc;
                const sel = selectedAudits.has(a.at);
                return (
                  <div key={a.at} className={`flex gap-2 p-2 rounded items-center ${isVoid ? 'bg-danger/10' : 'bg-black/40'} ${a.deleted ? 'opacity-50' : ''}`}>
                    <button
                      className="text-gray-500 hover:text-accent shrink-0"
                      onClick={() => toggleAudit(a.at)}
                      disabled={a.deleted}
                    >
                      {sel ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
                    </button>
                    <span className={`text-xs text-gray-600 w-32 shrink-0 ${a.deleted ? 'line-through' : ''}`}>{fmtDateTime(a.at)}</span>
                    <span className={`flex-1 ${a.deleted ? 'line-through text-gray-600' : flagged ? (isVoid ? 'text-danger' : 'text-accent') : 'text-gray-300'}`}>
                      {a.action}
                    </span>
                    <span className="text-xs text-gray-500">{a.value}</span>
                    <span className="text-xs text-gray-600">{a.operator}</span>
                    {!a.deleted && (
                      <button
                        className="text-danger hover:text-red-400 shrink-0"
                        title="Elimina"
                        onClick={() => { setDeleteTarget({ kind: 'single', auditAt: a.at }); setPw(''); setErr(false); }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {detail !== null && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`Dettaglio ${tables.find((t) => t.id === detail)?.name ?? ''}`}
          maxWidth="max-w-xl"
        >
          {(() => {
            const t = tables.find((x) => x.id === detail);
            if (!t) return null;
            const elapsedMs = (t.closedAt ?? 0) - (t.startTime ?? 0) - t.totalPausedMs;
            return (
              <div className="space-y-3 text-sm">
                <Row label="Operatore" value={t.operator ?? 'N/D'} />
                <Row label="Chiuso il" value={t.closedAt ? fmtDateTime(t.closedAt) : '-'} />
                <Row label="Durata" value={`${Math.floor(elapsedMs / 60000)} min`} />
                <Row label="Giocatori" value={t.lastMatchPlayers.join(', ')} />
                <Row label="Totale" value={fmtEuro(t.finalCost ?? 0)} />
                <Row label="Nolo" value={fmtEuro(t.noloRevenue ?? 0)} />
                <Row label="Bar" value={fmtEuro(t.barRevenue ?? 0)} />
                <Row label="Sconti applicati" value={fmtEuro(t.discountsApplied)} />
                <Row label="Arrotondamento" value={fmtEuro(t.roundingApplied)} />
              </div>
            );
          })()}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          open
          onClose={() => { setDeleteTarget(null); setPw(''); setErr(false); }}
          title="Elimina record"
          footer={
            <>
              <button className="btn-ghost" onClick={() => { setDeleteTarget(null); setPw(''); setErr(false); }}>Annulla</button>
              <button className="btn-danger" onClick={confirmDelete}>
                <Trash2 size={14} /> Elimina
              </button>
            </>
          }
        >
          <div className="flex gap-3 items-start mb-3">
            <AlertTriangle className="text-danger" size={22} />
            <p className="text-gray-300">Sei sicuro? Questa azione è irreversibile. Richiede password admin.</p>
          </div>
          <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(false); }} onSubmit={confirmDelete} />
          {err && <p className="text-danger text-sm mt-2">Password errata</p>}
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between bg-black/40 rounded px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
