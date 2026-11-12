import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle, Clock, User, Table2, Trash2 } from 'lucide-react';

export default function Insoluti() {
  const { pendingDebts, suspendedOrders, tables, markDebtAsPaid, assignDebtToTable, assignDebtToAthlete, deletePendingDebt } = useStore();
  const [filter, setFilter] = useState<'tutti' | 'sospesi' | 'insoluti' | 'saldati'>('tutti');
  const [assigningDebtId, setAssigningDebtId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  // Unisci pendingDebts e suspendedOrders con status 'insoluto'
  const allDebts = useMemo(() => {
    const pendingFromSuspended = suspendedOrders
      .filter((o) => o.status === 'insoluto' && !o.voided)
      .map((o) => ({
        id: o.id,
        athleteId: o.athleteId,
        athleteName: o.athleteName,
        amount: o.total,
        type: 'insoluto' as const,
        source: o.source || 'bar',
        createdAt: o.createdAt,
        reason: `Ordine bar: ${o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}`,
        paidAt: null,
      }));
    
    return [...pendingDebts, ...pendingFromSuspended];
  }, [pendingDebts, suspendedOrders]);

  const activeDebts = useMemo(() => {
    return allDebts.filter((d) => !d.paidAt);
  }, [allDebts]);

  const paidDebts = useMemo(() => {
    return allDebts.filter((d) => d.paidAt);
  }, [allDebts]);

  const filteredDebts = useMemo(() => {
    if (filter === 'saldati') return paidDebts;
    const active = activeDebts;
    if (filter === 'sospesi') return active.filter((d) => d.type === 'sospeso');
    if (filter === 'insoluti') return active.filter((d) => d.type === 'insoluto');
    return active;
  }, [filter, activeDebts, paidDebts]);

  const totalSospesi = activeDebts.filter((d) => d.type === 'sospeso').reduce((s, d) => s + d.amount, 0);
  const totalInsoluti = activeDebts.filter((d) => d.type === 'insoluto').reduce((s, d) => s + d.amount, 0);
  const totalSaldati = paidDebts.reduce((s, d) => s + d.amount, 0);

  const openAssignModal = (debtId: string) => {
    setAssigningDebtId(debtId);
    setSelectedTableId(null);
  };

  const handleAssignToTable = () => {
    if (!assigningDebtId || !selectedTableId) return;
    assignDebtToTable(assigningDebtId, selectedTableId);
    setAssigningDebtId(null);
    setSelectedTableId(null);
  };

  const handleAssignToAthlete = (debtId: string) => {
    if (!confirm('Assegnare questo debito al socio? Verrà sommato al suo debito personale.')) return;
    assignDebtToAthlete(debtId);
  };

  const handleMarkAsPaid = (debtId: string) => {
    const debt = allDebts.find((d) => d.id === debtId);
    if (!debt) return;
    if (!confirm(`Saldare il debito di ${debt.athleteName} per €${debt.amount.toFixed(2)}?`)) return;
    markDebtAsPaid(debtId);
  };

  const handleDelete = (debtId: string) => {
    const debt = allDebts.find((d) => d.id === debtId);
    if (!debt) return;
    if (debt.type === 'insoluto') {
      alert('Non è possibile eliminare un insoluto. Può essere solo saldato.');
      return;
    }
    if (!confirm(`Eliminare il sospeso di ${debt.athleteName} per €${debt.amount.toFixed(2)}?`)) return;
    deletePendingDebt(debtId);
  };

  const occupiedTables = tables.filter((t) => t.status === 'occupato');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <AlertTriangle size={22} className="text-accent" /> Insoluti e Sospesi
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Gestione debiti: sospesi (da saldare in giornata) e insoluti (fino a saldo).
        </p>
      </header>

      {/* Riepilogo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 border-l-4 border-yellow-500">
          <p className="text-xs text-gray-500 uppercase">Sospesi (oggi)</p>
          <p className="text-2xl font-bold text-yellow-400">{fmtEuro(totalSospesi)}</p>
          <p className="text-xs text-gray-500">{activeDebts.filter((d) => d.type === 'sospeso').length} debiti</p>
        </div>
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-500 uppercase">Insoluti</p>
          <p className="text-2xl font-bold text-red-400">{fmtEuro(totalInsoluti)}</p>
          <p className="text-xs text-gray-500">{activeDebts.filter((d) => d.type === 'insoluto').length} debiti</p>
        </div>
        <div className="card p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase">Saldati</p>
          <p className="text-2xl font-bold text-green-400">{fmtEuro(totalSaldati)}</p>
          <p className="text-xs text-gray-500">{paidDebts.length} saldi</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['tutti', 'sospesi', 'insoluti', 'saldati'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${
              filter === f
                ? 'bg-accent text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredDebts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">Nessun debito in questa categoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map((debt) => {
            const isPaid = !!debt.paidAt;
            const isSospeso = debt.type === 'sospeso';
            
            return (
              <div
                key={debt.id}
                className={`card p-4 ${
                  isPaid
                    ? 'bg-green-900/20 border border-green-700/50'
                    : isSospeso
                    ? 'bg-yellow-900/20 border border-yellow-700/50'
                    : 'bg-red-900/20 border border-red-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-100 text-lg">{debt.athleteName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        isPaid
                          ? 'bg-green-600 text-white'
                          : isSospeso
                          ? 'bg-yellow-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}>
                        {isPaid ? 'SALDATO' : isSospeso ? 'SOSPESO' : 'INSOLUTO'}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {debt.source === 'tavolo' ? `🎱 ${debt.tableName || 'Tavolo'}` : '🍺 Bar'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Creato: {fmtDateTime(debt.createdAt)}
                      {isPaid && ` · Saldato: ${fmtDateTime(debt.paidAt!)}`}
                      {debt.reason && ` · ${debt.reason}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-accent">{fmtEuro(debt.amount)}</p>
                  </div>
                </div>

                {!isPaid && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700 flex-wrap">
                    <button
                      onClick={() => openAssignModal(debt.id)}
                      className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
                      title="Assegna a un tavolo aperto"
                    >
                      <Table2 size={14} /> Assegna a tavolo
                    </button>
                    <button
                      onClick={() => handleAssignToAthlete(debt.id)}
                      className="px-3 py-1.5 rounded bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 flex items-center gap-1"
                      title="Somma al debito personale del socio"
                    >
                      <User size={14} /> Assegna a socio
                    </button>
                    <button
                      onClick={() => handleMarkAsPaid(debt.id)}
                      className="px-3 py-1.5 rounded bg-green-600 text-white text-xs font-bold hover:bg-green-700 flex items-center gap-1"
                      title="Segna come saldato (diventa incasso)"
                    >
                      <CheckCircle size={14} /> Saldato
                    </button>
                    {isSospeso && (
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-xs font-bold hover:bg-gray-600 flex items-center gap-1"
                        title="Elimina (solo sospesi)"
                      >
                        <Trash2 size={14} /> Elimina
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale assegnazione a tavolo */}
      {assigningDebtId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-lg font-bold text-gray-100 mb-4">Assegna debito a tavolo</h3>
            <p className="text-sm text-gray-400 mb-4">
              Seleziona il tavolo aperto dove il socio sta giocando. Il debito verrà sommato al suo conto.
            </p>
            
            {occupiedTables.length === 0 ? (
              <p className="text-yellow-400 text-sm mb-4">Nessun tavolo aperto al momento.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {occupiedTables.map((t) => {
                  const debt = allDebts.find((d) => d.id === assigningDebtId);
                  const playerInTable = t.players.find((p) => p.athleteId === debt?.athleteId);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTableId(t.id)}
                      className={`w-full p-3 rounded-lg text-left border ${
                        selectedTableId === t.id
                          ? 'bg-accent/20 border-accent'
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-100">{t.name}</span>
                        {playerInTable && (
                          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                            ✓ Socio presente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.players.map((p) => p.name).join(', ')}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAssignToTable}
                disabled={!selectedTableId}
                className="flex-1 px-4 py-2 rounded bg-accent text-black font-bold disabled:bg-gray-700 disabled:text-gray-500"
              >
                Conferma
              </button>
              <button
                onClick={() => { setAssigningDebtId(null); setSelectedTableId(null); }}
                className="px-4 py-2 rounded bg-gray-700 text-gray-300 font-bold hover:bg-gray-600"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}