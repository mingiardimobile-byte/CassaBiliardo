import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Table, Player, PlayerCheckout } from '@/types';
import { fmtEuro, fmtTime, fmtDateTime, sortByNameIT, sortByCategoryThenNameIT } from '@/lib/utils';
import Modal from '@/components/Modal';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { Circle, Pause, Play, Users, X, Coffee, Plus, History, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { sortAthletes, socioBadge } from '@/pages/Atleti';

export default function Tavoli() {
  const tables = useStore((s) => s.tables);
  const athletes = useStore((s) => s.athletes);
  const settings = useStore((s) => s.settings);
  const { openTable, pauseTable, resumeTable, closeTable, exitPlayers, addBarItem, addPlayerToTable } = useStore();

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tick, setTick] = useState(0);
  const [openModal, setOpenModal] = useState<Table | null>(null);
  const { confirm, dialog } = useConfirm();

  const sortedAthletes = useMemo(() => sortAthletes(athletes), [athletes]);

  const athleteInTable = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => {
      if (t.status === 'occupato') {
        t.players.forEach((p) => map.set(p.athleteId, t.name));
      }
    });
    return map;
  }, [tables]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const liveTable = (t: Table) => tables.find((x) => x.id === t.id) ?? t;
  void tick;

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Tavoli</h1>
        <p className="text-sm text-gray-500">Tariffa: {fmtEuro(settings.baseRate)}/h · Max tavolo: {fmtEuro(settings.tableMax)}/h</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            onOpen={() => setOpenModal(t)}
            onClick={() => t.status === 'occupato' && setSelectedTable(t)}
          />
        ))}
      </div>

      {openModal && (
        <OpenTableModal
          table={openModal}
          athletes={sortedAthletes}
          athleteInTable={athleteInTable}
          onClose={() => setOpenModal(null)}
          onConfirm={(players) => {
            openTable(openModal.id, players);
            setOpenModal(null);
          }}
        />
      )}

      {selectedTable && (
        <TableDetailModal
          table={liveTable(selectedTable)}
          athleteInTable={athleteInTable}
          onClose={() => setSelectedTable(null)}
          onAddItem={(athleteId, item) => addBarItem(liveTable(selectedTable).id, athleteId, item)}
          onAddPlayer={(p) => addPlayerToTable(liveTable(selectedTable).id, p)}
          onPause={() => pauseTable(liveTable(selectedTable).id)}
          onResume={() => resumeTable(liveTable(selectedTable).id)}
          onCloseTable={async (checkouts) => {
            const isFullClose = checkouts.length === liveTable(selectedTable).players.length;
            const label = isFullClose ? 'Chiudi Tavolo' : 'Uscita parziale';
            const ok = await confirm(`Sei sicuro di procedere? (${label})`, { title: label, confirmLabel: 'Conferma' });
            if (!ok) return null;
            const result = isFullClose
              ? closeTable(liveTable(selectedTable).id, 'full', checkouts)
              : exitPlayers(liveTable(selectedTable).id, checkouts);
            if (result) setSelectedTable(null);
            return result;
          }}
        />
      )}

      {dialog}
    </div>
  );
}

function TableCard({ table, onOpen, onClick }: { table: Table; onOpen: () => void; onClick: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (table.status !== 'occupato') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [table.status]);
  void tick;

  const isPaused = table.pausedAt !== null;
  const elapsedMs = table.startTime
    ? (table.pausedAt ?? Date.now()) - table.startTime - table.totalPausedMs
    : 0;
  const hours = Math.max(0, elapsedMs / 3600000);
  const n = table.players.length;
  const { baseRate, tableMax } = useStore.getState().settings;
  let cost = 0;
  const subscribedCount = table.players.filter((p) => p.isSubscribed).length;
  const payingCount = n - subscribedCount;
  if (payingCount > 0) {
    if (n === 1) cost = baseRate * hours;
    else if (n === 2) cost = baseRate * hours * (payingCount === 2 ? 2 : 1);
    else cost = (tableMax * hours * payingCount) / n;
  }
  const barTotal = table.players.reduce(
    (s, p) => s + p.items.reduce((x, i) => x + i.price * i.qty, 0),
    0
  );

  return (
    <div
      className={`card p-4 transition-all ${
        table.status === 'occupato' ? 'border-danger/40' : 'border-border hover:border-accent/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-100">{table.name}</h3>
        <div className="flex items-center gap-1.5 text-xs">
          <Circle
            size={10}
            className={table.status === 'libero' ? 'fill-success text-success' : 'fill-danger text-danger animate-blink'}
          />
          <span className={table.status === 'libero' ? 'text-success' : 'text-danger'}>
            {table.status === 'libero' ? 'Libero' : 'Occupato'}
          </span>
          {isPaused && (
            <span className="ml-1 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded font-bold">
              IN PAUSA
            </span>
          )}
        </div>
      </div>

      {table.status === 'libero' ? (
        <div className="space-y-3">
          {table.lastMatchCost !== null && (
            <div className="bg-black/40 rounded-lg p-3 border border-border">
              <p className="text-[10px] uppercase text-gray-600 mb-1">Ultima partita</p>
              <p className="text-sm text-accent font-semibold">{fmtEuro(table.lastMatchCost)}</p>
              <p className="text-xs text-gray-500 truncate">
                {table.lastMatchPlayers.join(', ')}
              </p>
              {table.lastMatchAt && (
                <p className="text-[10px] text-gray-600 mt-1">{fmtDateTime(table.lastMatchAt)}</p>
              )}
            </div>
          )}
          <button className="btn-accent w-full" onClick={onOpen}>
            <Plus size={16} /> Apri Tavolo
          </button>
        </div>
      ) : (
        <div className="space-y-3" onClick={onClick} role="button">
          <div className="bg-black/40 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
              <Users size={14} className="text-accent" />
              {n} giocatori
              {subscribedCount > 0 && (
                <span className="bg-accent/20 text-accent text-[10px] px-1.5 rounded font-bold">ABB</span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {table.players.map((p) => p.name + (p.isSubscribed ? ' ⭐' : '')).join(', ')}
            </p>
          </div>
          <div className="bg-black/40 rounded-lg p-3 font-mono">
            <p className="text-2xl text-accent tabular-nums">{fmtTime(elapsedMs)}</p>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Nolo: {fmtEuro(cost)}</span>
              <span>Bar: {fmtEuro(barTotal)}</span>
            </div>
            <p className="text-right text-lg text-gray-100 font-semibold mt-1">
              Tot: {fmtEuro(cost + barTotal)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {isPaused ? (
              <button
                className="btn-success text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  resumeTableBtn(table.id);
                }}
              >
                <Play size={14} /> Riprendi
              </button>
            ) : (
              <button
                className="btn-ghost text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  pauseTableBtn(table.id);
                }}
              >
                <Pause size={14} /> Pausa
              </button>
            )}
            <button className="btn-danger text-sm" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pauseTableBtn(id: number) {
  useStore.getState().pauseTable(id);
}
function resumeTableBtn(id: number) {
  useStore.getState().resumeTable(id);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function OpenTableModal({
  table,
  athletes,
  athleteInTable,
  onClose,
  onConfirm,
}: {
  table: Table;
  athletes: { id: string; name: string; socioType?: string }[];
  athleteInTable: Map<string, string>;
  onClose: () => void;
  onConfirm: (players: { athleteId: string; name: string; isSubscribed: boolean }[]) => void;
}) {
  const subscriptions = useStore((s) => s.subscriptions);
  const [selected, setSelected] = useState<string[]>([]);
  const [filterLetter, setFilterLetter] = useState<string | null>(null);

  const isSubscribed = (athleteId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return subscriptions.some(
      (s) => s.athleteId === athleteId && s.status === 'attivo' && s.startDate <= today && s.endDate >= today
    ) || subscriptions.some((s) => s.athleteId === athleteId && s.status === 'pagato');
  };

  const toggle = (id: string) => {
    if (athleteInTable.has(id)) return;
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s
    );
  };

  const handleLetterClick = (letter: string) => {
    setFilterLetter(letter);
    const el = document.getElementById(`open-table-atleta-${letter}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 1500);
    }
  };

  const handleClearFilter = () => {
    setFilterLetter(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Apri ${table.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
          <button
            className="btn-accent"
            disabled={selected.length === 0}
            onClick={() =>
              onConfirm(
                selected.map((id) => {
                  const a = athletes.find((x) => x.id === id)!;
                  return { athleteId: id, name: a.name, isSubscribed: isSubscribed(id) };
                })
              )
            }
          >
            Apri ({selected.length})
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-3">Seleziona da 1 a 3 atleti. Quelli già in gioco sono disabilitati.</p>

      <div className="mb-3">
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            className={`px-2 py-1 rounded text-xs font-bold transition ${
              filterLetter === null ? 'bg-accent text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={handleClearFilter}
          >
            TUTTI
          </button>
          {LETTERS.map((l) => {
            const hasAthletes = athletes.some((a) => a.name.toUpperCase().startsWith(l));
            return (
              <button
                key={l}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  filterLetter === l
                    ? 'bg-accent text-black'
                    : hasAthletes
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
                onClick={() => hasAthletes && handleLetterClick(l)}
                disabled={!hasAthletes}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {athletes.length === 0 ? (
        <p className="text-gray-500 text-sm">Nessun atleta registrato. Aggiungili dalla sezione Atleti.</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {athletes.map((a) => {
            const sel = selected.includes(a.id);
            const sub = isSubscribed(a.id);
            const busyTable = athleteInTable.get(a.id);
            const isBusy = !!busyTable;
            const firstLetter = a.name.charAt(0).toUpperCase();
            const prevAthlete = athletes[athletes.indexOf(a) - 1];
            const showLetterHeader = !prevAthlete || prevAthlete.name.charAt(0).toUpperCase() !== firstLetter;
            const matchesFilter = filterLetter === null || firstLetter === filterLetter;

            if (!matchesFilter) return null;

            return (
              <div key={a.id}>
                {showLetterHeader && (
                  <div
                    id={`open-table-atleta-${firstLetter}`}
                    className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur px-3 py-1 text-xs font-bold text-accent uppercase tracking-widest border-b border-gray-700 mb-1"
                  >
                    {firstLetter}
                  </div>
                )}
                <button
                  onClick={() => toggle(a.id)}
                  disabled={isBusy}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                    isBusy
                      ? 'bg-yellow-500/10 border-yellow-500/40 text-gray-500 cursor-not-allowed'
                      : sel
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-black/40 border-border text-gray-300 hover:border-accent/40'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {a.name}
                    {isBusy && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-400 text-black">
                        🎱 {busyTable}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {socioBadge(a.socioType)}
                    {sub && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">ABB</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function TableDetailModal({
  table,
  athleteInTable,
  onClose,
  onAddItem,
  onAddPlayer,
  onPause,
  onResume,
  onCloseTable,
}: {
  table: Table;
  athleteInTable: Map<string, string>;
  onClose: () => void;
  onAddItem: (athleteId: string, item: { productId: string; name: string; price: number; qty: number }) => void;
  onAddPlayer: (p: { athleteId: string; name: string; isSubscribed: boolean }) => void;
  onPause: () => void;
  onResume: () => void;
  onCloseTable: (checkouts: PlayerCheckout[]) => Promise<{ total: number; perPlayer: number[] } | null>;
}) {
  const products = useStore((s) => s.products);
  const athletes = useStore((s) => s.athletes);
  const settings = useStore((s) => s.settings);
  const sortedProducts = useMemo(() => sortByCategoryThenNameIT(products), [products]);
  const sortedAthletes = useMemo(() => sortAthletes(athletes), [athletes]);
  const [tab, setTab] = useState<'riepilogo' | 'bar' | 'pause'>('riepilogo');
  const [barTarget, setBarTarget] = useState<string>('');
  const [closeMode, setCloseMode] = useState<'single' | 'double' | 'triple' | null>(null);
  const [closeResult, setCloseResult] = useState<{ total: number; perPlayer: number[] } | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const elapsedMs = table.startTime
    ? (table.pausedAt ?? Date.now()) - table.startTime - table.totalPausedMs
    : 0;
  const isPaused = table.pausedAt !== null;

  // Calcola il tempo di permanenza di ogni giocatore
  const getPlayerPlayTime = (p: Player) => {
    const joinTime = p.joinTime ?? table.startTime ?? Date.now();
    const now = Date.now();
    const elapsed = (table.pausedAt ?? now) - joinTime;
    const pauseAfterJoin = table.pauseLogs
      .filter(log => log.at >= joinTime)
      .reduce((sum, log) => sum + log.durationMs, 0);
    return Math.max(0, elapsed - pauseAfterJoin);
  };

  return (
    <Modal open onClose={onClose} title={table.name} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-3xl text-accent tabular-nums">{fmtTime(elapsedMs)}</div>
        {isPaused ? (
          <span className="bg-accent/20 text-accent text-xs px-3 py-1 rounded-full font-bold">IN PAUSA</span>
        ) : (
          <span className="bg-danger/20 text-danger text-xs px-3 py-1 rounded-full font-bold">IN CORSO</span>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {(['riepilogo', 'bar', 'pause'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'riepilogo' ? 'Riepilogo' : t === 'bar' ? 'Consumazioni Bar' : 'Registro Pause'}
          </button>
        ))}
      </div>

      {tab === 'riepilogo' && (
        <div className="space-y-3">
          {table.players.map((p, idx) => {
            const playTime = getPlayerPlayTime(p);
            return (
              <div key={idx} className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">{p.name}</span>
                    {p.isSubscribed && (
                      <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">ABB · Nolo 0€</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{fmtTime(playTime)}</span>
                  </div>
                </div>
                {p.items.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {p.items.map((i, iidx) => (
                      <div key={iidx} className="flex justify-between text-xs text-gray-500 pl-3">
                        <span>{i.qty}x {i.name}</span>
                        <span>{fmtEuro(i.price * i.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {table.players.length < 3 && (
            <button className="btn-ghost w-full text-sm" onClick={() => setAddPlayerOpen(true)}>
              <Plus size={14} /> Aggiungi giocatore
            </button>
          )}
          <div className="flex gap-2 pt-4 border-t border-border">
            {isPaused ? (
              <button className="btn-success flex-1" onClick={onResume}><Play size={14} /> Riprendi</button>
            ) : (
              <button className="btn-ghost flex-1" onClick={onPause}><Pause size={14} /> Pausa</button>
            )}
            <button className="btn-danger flex-1" onClick={() => setCloseMode('single')}>
              <X size={14} /> Chiudi Tavolo
            </button>
          </div>
          {checkoutMode && (
            <CheckoutFlow
              table={table}
              settings={settings}
              mode={closeMode ?? 'single'}
              onCancel={() => setCheckoutMode(false)}
              onConfirm={async (checkouts) => {
                const r = await onCloseTable(checkouts);
                if (r) { setCloseResult(r); setCheckoutMode(false); }
              }}
            />
          )}
        </div>
      )}

      {tab === 'bar' && (
        <div className="space-y-3">
          <div>
            <label className="label">Aggiungi a:</label>
            <select className="input" value={barTarget} onChange={(e) => setBarTarget(e.target.value)}>
              <option value="">Seleziona giocatore...</option>
              {table.players.map((p) => (
                <option key={p.athleteId} value={p.athleteId}>{p.name}</option>
              ))}
            </select>
          </div>
          {products.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nessun prodotto in magazzino.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {sortedProducts.map((p) => (
                <button
                  key={p.id}
                  disabled={!barTarget || p.stock <= 0}
                  onClick={() => {
                    onAddItem(barTarget, { productId: p.id, name: p.name, price: p.price, qty: 1 });
                  }}
                  className="card p-3 text-left hover:border-accent/40 disabled:opacity-40"
                >
                  <p className="text-sm text-gray-200 truncate">{p.name}</p>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{fmtEuro(p.price)}</span>
                    <span>Giac.: {p.stock}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'pause' && (
        <div className="space-y-2">
          {table.pauseLogs.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nessuna pausa registrata.</p>
          ) : (
            table.pauseLogs.map((log, i) => (
              <div key={i} className="card p-3 flex items-center gap-3 text-sm">
                <History size={16} className="text-accent" />
                <div className="flex-1">
                  <p className="text-gray-300">Inizio: {fmtDateTime(log.at)}</p>
                  <p className="text-xs text-gray-500">Durata: {fmtTime(log.durationMs)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {addPlayerOpen && (
        <Modal open onClose={() => setAddPlayerOpen(false)} title="Aggiungi giocatore">
          <p className="text-xs text-gray-500 mb-2">Gli atleti già impegnati in altri tavoli sono disabilitati. Il nuovo giocatore pagherà solo dal momento dell'inserimento.</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {sortedAthletes
              .filter((a) => !table.players.some((p) => p.athleteId === a.id))
              .map((a) => {
                const busyTable = athleteInTable.get(a.id);
                const isBusy = !!busyTable;
                return (
                  <button
                    key={a.id}
                    disabled={isBusy}
                    className={`w-full text-left px-3 py-2 rounded-lg border flex items-center justify-between ${
                      isBusy
                        ? 'bg-yellow-500/10 border-yellow-500/40 text-gray-500 cursor-not-allowed'
                        : 'bg-black/40 border-border hover:border-accent/40 text-gray-300'
                    }`}
                    onClick={() => {
                      if (isBusy) return;
                      onAddPlayer({ athleteId: a.id, name: a.name, isSubscribed: false });
                      setAddPlayerOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {a.name}
                      {isBusy && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-400 text-black">
                          🎱 {busyTable}
                        </span>
                      )}
                    </span>
                    {socioBadge(a.socioType)}
                  </button>
                );
              })}
          </div>
        </Modal>
      )}

      {closeMode && (
        <Modal open onClose={() => setCloseMode(null)} title="Chiudi Tavolo">
          <p className="text-sm text-gray-400 mb-4">Seleziona quanti soci escono:</p>
          <div className="space-y-2">
            <CloseOption label="Esce 1 socio" desc="Un solo socio paga il conto" onClick={() => startCheckout('single')} />
            <CloseOption label="Escono 2 soci" desc="Diviso tra due soci" onClick={() => startCheckout('double')} />
            {table.players.length === 3 && (
              <CloseOption label="Escono 3 soci" desc="Tutti e tre i giocatori escono" onClick={() => startCheckout('triple')} />
            )}
          </div>
        </Modal>
      )}

      {closeResult && (
        <Modal open onClose={() => { setCloseResult(null); onClose(); }} title="Tavolo chiuso">
          <p className="text-gray-300 mb-2">Totale incassato: <span className="text-accent font-semibold">{fmtEuro(closeResult.total)}</span></p>
          {closeResult.perPlayer.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Quota per socio</p>
              {closeResult.perPlayer.map((amt, i) => (
                <div key={i} className="flex justify-between bg-black/40 rounded px-3 py-2 text-sm">
                  <span className="text-gray-400">Socio {i + 1}</span>
                  <span className="text-gray-200">{fmtEuro(amt)}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn-accent w-full mt-4" onClick={() => { setCloseResult(null); onClose(); }}>OK</button>
        </Modal>
      )}
    </Modal>
  );

  async function startCheckout(mode: 'single' | 'double' | 'triple') {
    setCloseMode(mode);
    setCheckoutMode(true);
  }
}

function PlayerRow({ player }: { player: Player }) {
  const barTotal = player.items.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-200">{player.name}</span>
          {player.isSubscribed && (
            <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">ABB · Nolo 0€</span>
          )}
        </div>
        <span className="text-sm text-gray-400">{fmtEuro(barTotal)}</span>
      </div>
      {player.items.length > 0 && (
        <div className="mt-2 space-y-1">
          {player.items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-xs text-gray-500 pl-3">
              <span>{i.qty}x {i.name}</span>
              <span>{fmtEuro(i.price * i.qty)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CloseOption({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full card p-3 flex items-center justify-between hover:border-accent/40 text-left"
    >
      <div>
        <p className="text-gray-200 font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ChevronRight className="text-gray-600" size={18} />
    </button>
  );
}

const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function CheckoutFlow({
  table,
  settings,
  mode,
  onCancel,
  onConfirm,
}: {
  table: Table;
  settings: { baseRate: number; tableMax: number };
  mode: 'single' | 'double' | 'triple';
  onCancel: () => void;
  onConfirm: (checkouts: PlayerCheckout[]) => Promise<void>;
}) {
  const now = Date.now();
  const { baseRate, tableMax } = settings;
  const n = table.players.length;

  const subscribedCount = table.players.filter((p) => p.isSubscribed).length;
  const noloPaying = n - subscribedCount;

  // Calcolo nolo teorico INDIVIDUALE per ogni giocatore
  const playerNoloMap = new Map<string, number>();
  table.players.forEach((p) => {
    const joinTime = p.joinTime ?? table.startTime ?? now;
    const elapsedMs = (table.pausedAt ?? now) - joinTime;
    const pauseAfterJoin = table.pauseLogs
      .filter(log => log.at >= joinTime)
      .reduce((sum, log) => sum + log.durationMs, 0);
    const hours = Math.max(0, (elapsedMs - pauseAfterJoin) / 3600000);
    
    let nolo = 0;
    if (!p.isSubscribed) {
      if (n <= 2) {
        nolo = baseRate * hours;
      } else {
        nolo = (tableMax / Math.max(1, noloPaying)) * hours;
      }
    }
    playerNoloMap.set(p.athleteId, Math.round(nolo * 100) / 100);
  });

  const exitingCount = mode === 'single' ? 1 : mode === 'double' ? 2 : 3;
  const [exitingIds, setExitingIds] = useState<Set<string>>(
    () => new Set(table.players.slice(0, exitingCount).map((p) => p.athleteId))
  );
  const toggleExit = (id: string) =>
    setExitingIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const defaultState = () => ({ noloDiscountPct: 0, noloRounding: 0, barDiscountPct: 0, barRounding: 0, paymentMode: 'pagato' as 'pagato' | 'sospeso' | 'insoluto' });

  const [playerStates, setPlayerStates] = useState<Record<string, {
    noloDiscountPct: number;
    noloRounding: number;
    barDiscountPct: number;
    barRounding: number;
    paymentMode: 'pagato' | 'sospeso' | 'insoluto';
  }>>(() => {
    const init: Record<string, ReturnType<typeof defaultState>> = {};
    table.players.forEach((p) => { init[p.athleteId] = defaultState(); });
    return init;
  });

  const computePlayer = (p: Player) => {
    const st = playerStates[p.athleteId] ?? defaultState();
    const isSub = p.isSubscribed;
    const noloTheo = playerNoloMap.get(p.athleteId) ?? 0;
    const noloDisc = noloTheo * (st.noloDiscountPct / 100);
    const noloAfter = noloTheo - noloDisc;
    const noloFinal = noloAfter + st.noloRounding;
    const barTheo = Math.round(p.items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
    const barDisc = barTheo * (st.barDiscountPct / 100);
    const barAfter = barTheo - barDisc;
    const barFinal = barAfter + st.barRounding;
    const pendingDebt = p.pendingTableDebt ?? 0;
    const final = Math.round((noloFinal + barFinal + pendingDebt) * 100) / 100;
    return { st, noloTheo, noloDisc, noloAfter, noloFinal, barTheo, barDisc, barAfter, barFinal, pendingDebt, final };
  };

  const exitingPlayers = table.players.filter((p) => exitingIds.has(p.athleteId));
  const grandTotal = exitingPlayers.reduce((s, p) => s + computePlayer(p).final, 0);
  const canConfirm = exitingIds.size > 0;

  const handleConfirm = () => {
    const checkouts: PlayerCheckout[] = exitingPlayers.map((p) => {
      const c = computePlayer(p);
      return {
        athleteId: p.athleteId,
        name: p.name,
        noloTheoretical: c.noloTheo,
        noloDiscountPct: c.st.noloDiscountPct,
        noloRounding: c.st.noloRounding,
        barTheoretical: c.barTheo,
        barDiscountPct: c.st.barDiscountPct,
        barRounding: c.st.barRounding,
        paymentMode: c.st.paymentMode,
      };
    });
    onConfirm(checkouts);
  };

  const title = mode === 'single' ? 'Esce 1 Socio' : mode === 'double' ? 'Escono 2 Soci' : 'Escono 3 Soci';
  const confirmLabel = 'Conferma e Chiudi · ';

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>Annulla</button>
          <button className="btn-accent" disabled={!canConfirm} onClick={handleConfirm}>
            <CheckCircle size={14} /> {confirmLabel}{fmtEuro(grandTotal)}
          </button>
        </>
      }
    >
      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4 text-sm text-warning">
        Ogni giocatore paga solo per il tempo effettivo di permanenza al tavolo.
      </div>
      <div className="space-y-4">
        {table.players.map((p) => {
          const c = computePlayer(p);
          const st = c.st;
          const isExiting = exitingIds.has(p.athleteId);
          const update = (patch: Partial<typeof st>) =>
            setPlayerStates((s) => ({ ...s, [p.athleteId]: { ...s[p.athleteId], ...patch } }));
          
          // Calcola tempo di permanenza per visualizzazione
          const joinTime = p.joinTime ?? table.startTime ?? now;
          const elapsedMs = (table.pausedAt ?? now) - joinTime;
          const pauseAfterJoin = table.pauseLogs
            .filter(log => log.at >= joinTime)
            .reduce((sum, log) => sum + log.durationMs, 0);
          const playTime = Math.max(0, elapsedMs - pauseAfterJoin);
          
          return (
            <div key={p.athleteId} className={`card p-4 border-accent/20 ${!isExiting ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isExiting} onChange={() => toggleExit(p.athleteId)} />
                  </label>
                  <span className="font-semibold text-gray-100">{p.name}</span>
                  {p.isSubscribed && (
                    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">ABB · Nolo 0€</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} /> {fmtTime(playTime)}
                  </span>
                  <span className="text-accent font-bold text-lg">{fmtEuro(c.final)}</span>
                </div>
              </div>

              {isExiting && (
                <>
                  {c.pendingDebt > 0 && (
                    <div className="bg-warning/10 rounded px-3 py-1.5 mb-2 text-xs text-warning flex justify-between">
                      <span>Debito tavolo precedente (sospeso)</span>
                      <span className="font-semibold">+{fmtEuro(c.pendingDebt)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase mb-2">Nolo ({fmtTime(playTime)})</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Costo Nolo Teorico</span>
                          <span className="text-accent font-semibold">{fmtEuro(c.noloTheo)}</span>
                        </div>
                        <div>
                          <label className="label">Sconto %</label>
                          <select
                            className="input"
                            value={st.noloDiscountPct}
                            onChange={(e) => update({ noloDiscountPct: +e.target.value })}
                          >
                            {DISCOUNT_OPTIONS.map((d) => <option key={d} value={d}>{d}%</option>)}
                          </select>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dopo sconto</span>
                          <span className="text-gray-300">{fmtEuro(c.noloAfter)}</span>
                        </div>
                        <div>
                          <label className="label">Arrotondamento (±)</label>
                          <input
                            type="number"
                            step="0.05"
                            className="input"
                            value={st.noloRounding}
                            onChange={(e) => update({ noloRounding: +e.target.value })}
                          />
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-gray-400">Nolo finale</span>
                          <span className="text-gray-100 font-medium">{fmtEuro(c.noloFinal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase mb-2">Bar {c.barTheo > 0 ? `· ${p.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}` : ''}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Totale Bar</span>
                          <span className="text-gray-300 font-semibold">{fmtEuro(c.barTheo)}</span>
                        </div>
                        <div>
                          <label className="label">Sconto %</label>
                          <select
                            className="input"
                            value={st.barDiscountPct}
                            onChange={(e) => update({ barDiscountPct: +e.target.value })}
                          >
                            {DISCOUNT_OPTIONS.map((d) => <option key={d} value={d}>{d}%</option>)}
                          </select>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dopo sconto</span>
                          <span className="text-gray-300">{fmtEuro(c.barAfter)}</span>
                        </div>
                        <div>
                          <label className="label">Arrotondamento (±)</label>
                          <input
                            type="number"
                            step="0.05"
                            className="input"
                            value={st.barRounding}
                            onChange={(e) => update({ barRounding: +e.target.value })}
                          />
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-gray-400">Bar finale</span>
                          <span className="text-gray-100 font-medium">{fmtEuro(c.barFinal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-400 mr-1">Stato:</span>
                    {(['pagato', 'sospeso', 'insoluto'] as const).map((pm) => (
                      <button
                        key={pm}
                        onClick={() => update({ paymentMode: pm })}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          st.paymentMode === pm
                            ? pm === 'pagato'
                              ? 'bg-success/20 border-success text-success'
                              : pm === 'sospeso'
                              ? 'bg-warning/20 border-warning text-warning'
                              : 'bg-danger/20 border-danger text-danger'
                            : 'bg-black/40 border-border text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {pm === 'pagato' ? 'Pagato' : pm === 'sospeso' ? 'Sospeso' : 'Insoluto'}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex justify-between bg-accent/10 rounded px-3 py-2">
                    <span className="text-sm text-gray-300 font-medium">Importo Finale da Pagare</span>
                    <span className="text-accent font-bold">{fmtEuro(c.final)}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <div className="flex justify-between bg-card border border-accent/40 rounded-lg px-4 py-3">
          <span className="text-gray-200 font-semibold">Totale in uscita</span>
          <span className="text-accent text-xl font-bold">{fmtEuro(grandTotal)}</span>
        </div>
      </div>
    </Modal>
  );
}