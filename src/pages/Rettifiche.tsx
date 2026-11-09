import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime } from '@/lib/utils';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function Rettifiche() {
  const { tables, closedTableDetails, athletes, rectifyClosedTablePayment } = useStore();
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [reason, setReason] = useState('');

  const todayClosed = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return tables
      .filter((t) => t.closedAt && t.closedAt >= startOfDay.getTime() && !t.deleted)
      .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  }, [tables]);

  const handleRectify = (tableId: number, athleteId: string, originalAmount: number) => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) { alert('Importo non valido'); return; }
    if (!reason.trim()) { alert('Inserisci un motivo'); return; }
    if (!confirm(`Confermi? Differenza €${(originalAmount - amount).toFixed(2)} andrà in insoluto.`)) return;
    rectifyClosedTablePayment(tableId, athleteId, amount, reason.trim());
    setEditingAthleteId(null);
    setEditingTableId(null);
    setNewAmount('');
    setReason('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <AlertTriangle size={22} className="text-accent" /> Rettifiche Pagamenti
        </h1>
        <p className="text-gray-400 text-sm mt-1">Modifica il pagamento di un socio su un tavolo già chiuso. La differenza va in insoluto.</p>
      </header>

      {todayClosed.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-gray-500">Nessun tavolo chiuso oggi.</p></div>
      ) : (
        <div className="space-y-4">
          {todayClosed.map((t) => {
            const details = closedTableDetails[t.id] || [];
            const totalPaid = details.reduce((s, d) => s + d.amount, 0);
            return (
              <div key={t.id} className="card p-4">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                  <div>
                    <h3 className="font-semibold text-gray-100 text-lg">{t.name}</h3>
                    <p className="text-xs text-gray-500">
                      Chiuso il {t.closedAt ? fmtDateTime(t.closedAt) : '-'}
                    </p>
                    {t.lastMatchPlayers && t.lastMatchPlayers.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Giocatori: {t.lastMatchPlayers.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase">Totale incassato</p>
                    <p className="text-accent font-bold text-xl">{fmtEuro(totalPaid)}</p>
                  </div>
                </div>

                {details.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">Nessun dettaglio disponibile per questo tavolo.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Giocatori e pagamenti:</p>
                    {details.map((d) => {
                      const athlete = athletes.find((a) => a.id === d.athleteId);
                      const currentDebt = athlete?.debt || 0;
                      const isEditing = editingAthleteId === d.athleteId && editingTableId === t.id;

                      return (
                        <div key={d.athleteId} className={`p-3 rounded-lg border ${
                          d.paymentMode === 'insoluto' ? 'bg-red-900/20 border-red-700/50' :
                          d.paymentMode === 'sospeso' ? 'bg-yellow-900/20 border-yellow-700/50' :
                          'bg-gray-800/50 border-gray-700'
                        }`}>
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-100">{d.name}</span>
                                <span className="text-xs text-gray-400">Debito attuale: €{currentDebt.toFixed(2)}</span>
                              </div>
                              <div>
                                <label className="label">Importo realmente pagato (€)</label>
                                <input 
                                  type="number" 
                                  step="0.10" 
                                  min="0" 
                                  className="input" 
                                  value={newAmount} 
                                  onChange={(e) => setNewAmount(e.target.value)} 
                                  placeholder={`Originale: €${d.amount.toFixed(2)}`}
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="label">Motivo della rettifica</label>
                                <input 
                                  className="input" 
                                  value={reason} 
                                  onChange={(e) => setReason(e.target.value)} 
                                  placeholder="Es. pagamento parziale, insoluto..."
                                />
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  className="btn-accent" 
                                  onClick={() => handleRectify(t.id, d.athleteId, d.amount)}
                                >
                                  <CheckCircle size={14} /> Conferma
                                </button>
                                <button 
                                  className="btn-ghost" 
                                  onClick={() => { 
                                    setEditingAthleteId(null); 
                                    setEditingTableId(null);
                                    setNewAmount(''); 
                                    setReason(''); 
                                  }}
                                >
                                  Annulla
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-gray-100 font-medium">{d.name}</p>
                                <p className="text-xs text-gray-500">
                                  {d.paymentMode === 'pagato' && '✅ Pagato'}
                                  {d.paymentMode === 'sospeso' && '⏳ Sospeso'}
                                  {d.paymentMode === 'insoluto' && '❌ Insoluto'}
                                  {currentDebt > 0 && ` · Debito: €${currentDebt.toFixed(2)}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 uppercase">Ha pagato</p>
                                  <p className={`font-bold text-lg ${
                                    d.paymentMode === 'insoluto' ? 'text-red-400' : 'text-accent'
                                  }`}>
                                    {fmtEuro(d.amount)}
                                  </p>
                                </div>
                                <button 
                                  className="btn-ghost p-2" 
                                  onClick={() => { 
                                    setEditingTableId(t.id); 
                                    setEditingAthleteId(d.athleteId); 
                                    setNewAmount(d.amount.toString()); 
                                    setReason(''); 
                                  }} 
                                  title="Rettifica pagamento"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}