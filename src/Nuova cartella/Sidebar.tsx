import { useState } from 'react';
import { useStore } from '@/store';
import { Lock, LogOut, User } from 'lucide-react';
import Modal from './Modal';
import PasswordInput from './PasswordInput';
import type { PageKey } from '@/types';

const FREE_PAGES: { key: PageKey; label: string }[] = [
  { key: 'tavoli', label: 'Tavoli' },
  { key: 'pos', label: 'POS Bar' },
  { key: 'insoluti', label: 'Insoluti' },
];

const PROTECTED_PAGES: { key: PageKey; label: string }[] = [
  { key: 'magazzino', label: 'Magazzino' },
  { key: 'atleti', label: 'Atleti' },
  { key: 'abbonamenti', label: 'Abbonamenti' },
  { key: 'cassa', label: 'Cassa Giornaliera' },
  { key: 'statistiche', label: 'Statistiche' },
  { key: 'storico', label: 'Storico' },
  { key: 'supervisione', label: 'Supervisione' },
  { key: 'rettifiche', label: 'Rettifiche' },
  { key: 'impostazioni', label: 'Impostazioni' },
];

const ICONS: Record<PageKey, string> = {
  tavoli: '🎱',
  pos: '🍺',
  magazzino: '📦',
  atleti: '🏆',
  abbonamenti: '💳',
  cassa: '💰',
  statistiche: '📊',
  storico: '🗓️',
  supervisione: '🔍',
  insoluti: '⚠️',
  rettifiche: '🔧',
  impostazioni: '⚙️',
};

type Props = {
  current: PageKey;
  onNavigate: (p: PageKey) => void;
  suspendedCount: number;
};

export default function Sidebar({ current, onNavigate, suspendedCount }: Props) {
  const { isAdminUnlocked, currentOperator, setOperator, unlockAdmin, lockAdmin, checkAutoLock } = useStore();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [pending, setPending] = useState<PageKey | null>(null);

  checkAutoLock();

  const handleNav = (p: PageKey) => {
    const isProtected = PROTECTED_PAGES.some((x) => x.key === p);
    if (isProtected && !isAdminUnlocked) {
      setPending(p);
      setPw('');
      setErr(false);
      return;
    }
    onNavigate(p);
  };

  const tryUnlock = () => {
    if (!pending) return;
    if (!unlockAdmin(pw)) {
      setErr(true);
      return;
    }
    setPw('');
    setErr(false);
    onNavigate(pending);
    setPending(null);
  };

  return (
    <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col h-full no-print">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center text-accent font-bold text-sm">
            NAB
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">Cassa Automatica</p>
            <p className="text-[10px] text-gray-500 truncate">Nuova Accademia del Biliardo</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-600 px-2 mt-2 mb-1">Libero accesso</p>
        {FREE_PAGES.map((p) => (
          <NavBtn
            key={p.key}
            label={p.label}
            icon={ICONS[p.key]}
            active={current === p.key}
            badge={p.key === 'insoluti' ? suspendedCount : 0}
            onClick={() => handleNav(p.key)}
          />
        ))}

        <p className="text-[10px] uppercase tracking-wider text-gray-600 px-2 mt-4 mb-1">Protetto</p>
        {PROTECTED_PAGES.map((p) => (
          <NavBtn
            key={p.key}
            label={p.label}
            icon={ICONS[p.key]}
            active={current === p.key}
            locked={!isAdminUnlocked}
            onClick={() => handleNav(p.key)}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        {!currentOperator ? (
          <div className="space-y-2">
            <label className="label flex items-center gap-1">
              <User size={12} /> Nome Operatore
            </label>
            <input
              className="input"
              placeholder="Es. Marco"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setOperator((e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => e.target.value && setOperator(e.target.value)}
            />
          </div>
        ) : (
          <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <User size={12} className="text-accent" /> {currentOperator}
            </span>
            <button
              className="text-gray-500 hover:text-danger"
              onClick={() => setOperator('')}
              title="Cambia operatore"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {isAdminUnlocked && (
          <button className="btn-ghost w-full text-sm" onClick={lockAdmin}>
            <Lock size={14} /> Blocca Admin
          </button>
        )}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Area Protetta"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPending(null)}>Annulla</button>
            <button className="btn-accent" onClick={tryUnlock}>
              <Lock size={14} /> Sblocca
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-500 mb-4">Inserisci la password per accedere a questa sezione.</p>
        <PasswordInput
          value={pw}
          onChange={(v) => { setPw(v); setErr(false); }}
          placeholder="Password"
          autoFocus
          onSubmit={tryUnlock}
        />
        {err && <p className="text-danger text-sm mt-2">Password errata</p>}
      </Modal>
    </aside>
  );
}

function NavBtn({
  label,
  icon,
  active,
  locked,
  badge,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  locked?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
        active ? 'bg-accent/15 text-accent border border-accent/30' : 'text-gray-400 hover:bg-black/40 hover:text-gray-200 border border-transparent'
      } ${locked ? 'opacity-50' : ''}`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {locked && <Lock size={12} className="text-gray-600" />}
      {!!badge && badge > 0 && (
        <span className="bg-danger text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}