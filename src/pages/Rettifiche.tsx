import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { fmtEuro, fmtDateTime } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, XCircle, PauseCircle, CheckCircle2, Edit3 } from 'lucide-react';

type PaymentMode = 'pagato' | 'sospeso' | 'insoluto';

export default function Rettifiche() {
  const { closedTableDetails, athletes, rectifyClosedTablePayment, batchRectifyPlayers } = useStore();
  // Migrazione automatica: se closedTableDetails è un oggetto (vecchio formato), convertilo in array
  const normalizedClosedTableDetails = useMemo(() => {
    if (Array.isArray(closedTableDetails)) {
      return closedTableDetails;
    }
    if (closedTableDetails && typeof closedTableDetails === 'object') {
      // Vecchio formato: converti in array
      return Object.values(closedTableDetails);
    }
    return [];
  }, [closedTableDetails]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newMode, setNewMode] = useState<PaymentMode>('pagato');
  const [reason, setReason] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  // FIX: controllo di sicurezza per closedTableDetails
    const safeClosedTableDetails = normalizedClosedTableDetails;

  const todayEntries = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    return safeClosedTableDetails
      .filter((e) => e.closeTime >= startOfDay.getTime())
      .sort((a, b) => b.closeTime - a.closeTime);
  }, [safeClosedTableDetails]);

  const groupedByTable = useMemo(() => {
    const groups: Record<number, typeof todayEntries> = {};
    todayEntries.forEach((e) => {
      if (!groups[e.tableId]) groups[e.tableId] = [];
      groups[e.tableId].push(e);
    });
    return groups;
  }, [todayEntries]);

  const openEdit = (entryId: string, athleteId: string, currentAmount: number, currentMode: PaymentMode) => {
    setEditingEntryId(entryId);
    setEditingAthleteId(athleteId);
    setNewAmount(currentAmount.toString());
    setNewMode(currentMode);
    setReason('');
  };

  const cancelEdit = () => {
    setEditingAthleteId(null);
    setEditingEntryId(null);
    setNewAmount('');
    setNewMode('pagato');
    setReason('');
  };

  const togglePlayerSelection = (entryId: string, athleteId: string) => {
    const newSel = new Set(selectedPlayers);
    const key = `${entryId}:${athleteId}`;
    if (newSel.has(key)) newSel.delete(key);
    else newSel.add(key);
    setSelectedPlayers(newSel);
  };

  const handleConfirm = (entryId: string, athleteId: string, originalAmount: number) => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) { alert('Importo non valido'); return; }
    if (!reason.trim() && amount !== originalAmount) { alert('Inserisci un motivo per la modifica'); return; }
    const finalReason = reason.trim() || 'Nessun motivo specificato';
    
    if (!confirm(`Confermi la modifica?\n\nImporto: €${originalAmount.toFixed(2)} → €${amount.toFixed(2)}\nStato: ${newMode}\nDifferenza: €${(amount - originalAmount).toFixed(2)}`)) return;
    
    rectifyClosedTablePayment(entryId, athleteId, amount, newMode, finalReason);
    cancelEdit();
  };

  const quickSetMode = (entryId: string, athleteId: string, currentAmount: number, mode: PaymentMode) => {
    if (mode === 'insoluto' && currentAmount > 0) {
      if (!confirm(`Mettere tutto in insoluto? L'importo €${currentAmount.toFixed(2)} verrà aggiunto al debito dell'atleta.`)) return;
      rectifyClosedTablePayment(entryId, athleteId, 0, 'insoluto', 'Messo in insoluto totale');
    } else if (mode === 'sospeso') {
      if (!confirm(`Mettere in sospeso? L'importo resta €${currentAmount.toFixed(2)} ma non viene incassato.`)) return;
      rectifyClosedTablePayment(entryId, athleteId, currentAmount, 'sospeso', 'Messo in sospeso');
    } else if (mode === 'pagato') {
      if (!confirm(`Segnare come pagato? L'importo resta €${currentAmount.toFixed(2)}.`)) return;
      rectifyClosedTablePayment(entryId, athleteId, currentAmount, 'pagato', 'Segnato come pagato');
    }
  };

  const handleBatchAction = (entryId: string, mode: PaymentMode) => {
    const entry = todayEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const ids = Array.from(selectedPlayers)
      .filter((k) => k.startsWith(`${entryId}:`))
      .map((k) => k.split(':')[1]);
    if (ids.length === 0) { alert('Seleziona almeno un giocatore'); return; }
    
    const names = entry.players.filter((p) => ids.includes(p.athleteId)).map((p) => p.name).join(', ');
    const total = entry.players.filter((p) => ids.includes(p.athleteId)).reduce((s, p) => s + p.amount, 0);
    
    let msg = '';
    if (mode === 'insoluto') msg = `Mettere in INSOLUTO TOTALE ${ids.length} giocatore/i (${names})? Totale €${total.toFixed(2)} andrà in debito.`;
    else if (mode === 'sospeso') msg = `Mettere in SOSPESO ${ids.length} giocatore/i (${names})? Totale €${total.toFixed(2)} resta sospeso.`;
    else msg = `Segnare come PAGATO ${ids.length} giocatore/i (${names})? Totale €${total.toFixed(2)}.`;
    
    if (!confirm(msg)) return;
    
    batchRectifyPlayers(entryId, ids, mode, `Azione batch: ${mode}`);
    setSelectedPlayers(new Set());
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <AlertTriangle size={22} className="text-accent" /> Rettifiche Pagamenti
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Chiusure tavoli di oggi. Modifica importi e stati di pagamento. La lista si azzera alla chiusura cassa.
        </p>
      </header>

      {todayEntries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">Nessuna chiusura tavolo registrata oggi.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByTable).map(([tableId, entries]) => (
            <div key={tableId}>
              <h2 className="text-lg font-bold text-accent mb-3 flex items-center gap-2">
                🎱 Tavolo {tableId}
                <span className="text-xs font-normal text-gray-500">({entries.length} chiusur{entries.length === 1 ? 'a' : 'e'})</span>
              </h2>
              <div className="space-y-4">
                {entries.map((entry) => {
                  const entrySelectedCount = Array.from(selectedPlayers).filter((k) => k.startsWith(`${entry.id}:`)).length;
                  return (
                    <div key={entry.id} className="card p-4">
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                        <div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> Apertura: {fmtDateTime(entry.openTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> Chiusura: {fmtDateTime(entry.closeTime)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Giocatori: {entry.players.map((p) => p.name).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 uppercase">Totale incassato</p>
                          <p className="text-accent font-bold text-xl">{fmtEuro(entry.total)}</p>
                        </div>
                      </div>

                      {entrySelectedCount > 0 && (
                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 mb-3 flex items-center justify-between">
                          <span className="text-xs text-accent font-bold">
                            {entrySelectedCount} giocatore/i selezionato/i
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBatchAction(entry.id, 'pagato')}
                              className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Pagato
                            </button>
                            <button
                              onClick={() => handleBatchAction(entry.id, 'sospeso')}
                              className="px-2 py-1 rounded text-xs bg-yellow-600 text-white hover:bg-yellow-700 flex items-center gap-1"
                            >
                              <PauseCircle size={12} /> Sospeso
                            </button>
                            <button
                              onClick={() => handleBatchAction(entry.id, 'insoluto')}
                              className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
                            >
                              <XCircle size={12} /> Insoluto
                            </button>
                            <button
                              onClick={() => setSelectedPlayers(new Set(Array.from(selectedPlayers).filter((k) => !k.startsWith(`${entry.id}:`))))}
                              className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                            >
                              Annulla selezione
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {entry.players.map((p) => {
                          const athlete = athletes.find((a) => a.id === p.athleteId);
                          const currentDebt = athlete?.debt || 0;
                          const isEditing = editingAthleteId === p.athleteId && editingEntryId === entry.id;
                          const isSelected = selectedPlayers.has(`${entry.id}:${p.athleteId}`);

                          return (
                            <div key={p.athleteId} className={`p-3 rounded-lg border ${
                              p.paymentMode === 'insoluto' ? 'bg-red-900/20 border-red-700/50' :
                              p.paymentMode === 'sospeso' ? 'bg-yellow-900/20 border-yellow-700/50' :
                              'bg-gray-800/50 border-gray-700'
                            } ${isSelected ? 'ring-2 ring-accent' : ''}`}>
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-100 text-lg">{p.name}</span>
                                    <span className="text-xs text-gray-400">Debito attuale: €{currentDebt.toFixed(2)}</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="label">Importo (€)</label>
                                      <input 
                                        type="number" 
                                        step="0.10" 
                                        min="0" 
                                        className="input" 
                                        value={newAmount} 
                                        onChange={(e) => setNewAmount(e.target.value)}
                                      />
                                      <div className="flex gap-1 mt-1">
                                        <button className="text-[10px] px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600" onClick={() => setNewAmount('0')}>0€</button>
                                        <button className="text-[10px] px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600" onClick={() => setNewAmount((parseFloat(newAmount || '0') / 2).toFixed(2))}>½</button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="label">Stato pagamento</label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => setNewMode('pagato')}
                                          className={`flex-1 px-2 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${
                                            newMode === 'pagato' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
                                          }`}
                                        >
                                          <CheckCircle2 size={12} /> Pagato
                                        </button>
                                        <button
                                          onClick={() => setNewMode('sospeso')}
                                          className={`flex-1 px-2 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${
                                            newMode === 'sospeso' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400'
                                          }`}
                                        >
                                          <PauseCircle size={12} /> Sospeso
                                        </button>
                                        <button
                                          onClick={() => setNewMode('insoluto')}
                                          className={`flex-1 px-2 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${
                                            newMode === 'insoluto' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'
                                          }`}
                                        >
                                          <XCircle size={12} /> Insoluto
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="label">Motivo della modifica</label>
                                    <input 
                                      className="input" 
                                      value={reason} 
                                      onChange={(e) => setReason(e.target.value)} 
                                      placeholder="Es. pagamento parziale, recupero insoluto..."
                                      autoFocus
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <button 
                                      className="btn-accent flex-1" 
                                      onClick={() => handleConfirm(entry.id, p.athleteId, p.amount)}
                                    >
                                      <CheckCircle size={14} /> Conferma modifica
                                    </button>
                                    <button 
                                      className="btn-ghost" 
                                      onClick={cancelEdit}
                                    >
                                      Annulla
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => togglePlayerSelection(entry.id, p.athleteId)}
                                      className="w-4 h-4 accent-accent"
                                    />
                                    <div>
                                      <p className="text-gray-100 font-medium">{p.name}</p>
                                      <p className="text-xs text-gray-500">
                                        {p.paymentMode === 'pagato' && '✅ Pagato'}
                                        {p.paymentMode === 'sospeso' && '⏳ Sospeso'}
                                        {p.paymentMode === 'insoluto' && '❌ Insoluto'}
                                        {currentDebt > 0 && ` · Debito: €${currentDebt.toFixed(2)}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right mr-2">
                                      <p className="text-xs text-gray-500 uppercase">Ha pagato</p>
                                      <p className={`font-bold text-lg ${
                                        p.paymentMode === 'insoluto' ? 'text-red-400' : 
                                        p.paymentMode === 'sospeso' ? 'text-yellow-400' : 'text-accent'
                                      }`}>
                                        {fmtEuro(p.amount)}
                                      </p>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1">
                                      {p.paymentMode !== 'pagato' && (
                                        <button 
                                          className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40" 
                                          onClick={() => quickSetMode(entry.id, p.athleteId, p.amount, 'pagato')} 
                                          title="Segna come pagato"
                                        >
                                          <CheckCircle2 size={14} />
                                        </button>
                                      )}
                                      {p.paymentMode !== 'sospeso' && (
                                        <button 
                                          className="p-1.5 rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40" 
                                          onClick={() => quickSetMode(entry.id, p.athleteId, p.amount, 'sospeso')} 
                                          title="Metti in sospeso"
                                        >
                                          <PauseCircle size={14} />
                                        </button>
                                      )}
                                      {p.paymentMode !== 'insoluto' && p.amount > 0 && (
                                        <button 
                                          className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40" 
                                          onClick={() => quickSetMode(entry.id, p.athleteId, p.amount, 'insoluto')} 
                                          title="Metti in insoluto totale"
                                        >
                                          <XCircle size={14} />
                                        </button>
                                      )}
                                      <button 
                                        className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600" 
                                        onClick={() => openEdit(entry.id, p.athleteId, p.amount, p.paymentMode)} 
                                        title="Modifica completa (importo + stato)"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}