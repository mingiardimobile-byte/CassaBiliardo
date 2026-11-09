import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { UserPlus, Search, Edit2, Trash2, Trophy } from 'lucide-react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Esportate per essere usate da Tavoli.tsx
export const sortAthletes = (athletes: { id: string; name: string; socioType?: string }[]) =>
  [...athletes].sort((a, b) => a.name.localeCompare(b.name));

export const socioBadge = (socioType?: string) => {
  if (!socioType || socioType === 'Socio Ordinario') return null;
  return (
    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">
      {socioType}
    </span>
  );
};

export default function Atleti() {
  const { athletes, tables, addAthlete, updateAthlete, deleteAthlete } = useStore();
  const [search, setSearch] = useState('');
  const [filterLetter, setFilterLetter] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sortedAthletes = useMemo(() => {
    let list = [...athletes];
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(s));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [athletes, search]);

  const getAthleteTable = (athleteId: string) => {
    const table = tables.find(t =>
      t.status === 'occupato' && t.players.some(p => p.athleteId === athleteId)
    );
    return table ? table.name : null;
  };

  const handleAdd = () => {
    if (newName.trim()) {
      addAthlete(newName.trim());
      setNewName('');
    }
  };

  const handleEditStart = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleEditSave = () => {
    if (editingId && editName.trim()) {
      updateAthlete(editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Eliminare ${name}?`)) {
      deleteAthlete(id);
    }
  };

  const handleLetterClick = (letter: string) => {
    setFilterLetter(letter);
    const el = document.getElementById(`atleta-${letter}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 1500);
    }
  };

  const handleClearFilter = () => {
    setFilterLetter(null);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Trophy size={22} className="text-accent" /> Atleti
        </h1>
        <p className="text-gray-400 text-sm mt-1">{athletes.length} atleti registrati</p>
      </header>

      <section className="card p-4 mb-4">
        <h2 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
          <UserPlus size={16} className="text-accent" /> Nuovo Atleta
        </h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome e cognome"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn-accent" onClick={handleAdd} disabled={!newName.trim()}>
            <UserPlus size={14} /> Aggiungi
          </button>
        </div>
      </section>

      <section className="card p-4 mb-4">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca atleta..."
            />
          </div>
          {filterLetter && (
            <button className="btn-ghost text-sm" onClick={handleClearFilter}>
              ✕ Rimuovi filtro
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            className={`px-2 py-1 rounded text-xs font-bold transition ${
              filterLetter === null ? 'bg-accent text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={handleClearFilter}
          >
            TUTTI
          </button>
          {LETTERS.map((l) => {
            const hasAthletes = sortedAthletes.some((a) => a.name.toUpperCase().startsWith(l));
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
      </section>

      <section className="card p-4">
        <h2 className="font-semibold text-gray-100 mb-3">
          Elenco ({sortedAthletes.length})
        </h2>
        {sortedAthletes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nessun atleta trovato</p>
        ) : (
          <div className="space-y-2">
            {sortedAthletes.map((a) => {
              const firstLetter = a.name.charAt(0).toUpperCase();
              const prevAthlete = sortedAthletes[sortedAthletes.indexOf(a) - 1];
              const showLetterHeader = !prevAthlete || prevAthlete.name.charAt(0).toUpperCase() !== firstLetter;
              const activeTable = getAthleteTable(a.id);

              return (
                <div key={a.id}>
                  {showLetterHeader && (
                    <div
                      id={`atleta-${firstLetter}`}
                      className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur px-3 py-1 text-xs font-bold text-accent uppercase tracking-widest border-b border-gray-700 mb-2"
                    >
                      {firstLetter}
                    </div>
                  )}
                  {editingId === a.id ? (
                    <div className="flex gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <input
                        className="input flex-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                        autoFocus
                      />
                      <button className="btn-accent" onClick={handleEditSave}>Salva</button>
                      <button className="btn-ghost" onClick={() => setEditingId(null)}>Annulla</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="text-accent font-bold text-lg w-6">{firstLetter}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-gray-100 font-medium">{a.name}</p>
                            {activeTable && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-yellow-400 text-black shadow-md flex items-center gap-1">
                                🎱 {activeTable}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {a.socioType || 'Socio Ordinario'} • Debito: €{(a.debt || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-ghost p-2"
                          onClick={() => handleEditStart(a.id, a.name)}
                          title="Modifica"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn-danger p-2"
                          onClick={() => handleDelete(a.id, a.name)}
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}