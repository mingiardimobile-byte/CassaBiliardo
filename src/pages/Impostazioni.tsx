import { useState } from 'react';
import { useStore } from '@/store';
import PasswordInput from '@/components/PasswordInput';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { downloadJSON, fmtEuro } from '@/lib/utils';
import {
  Settings as SettingsIcon, Lock, Save, RotateCcw, Download, Upload,
  KeyRound, DollarSign, Mail, Trash2, AlertTriangle, AlertOctagon,
} from 'lucide-react';

const RESET_OPTIONS = [
  { key: 'resetMagazzino', label: 'Azzera Magazzino', icon: '📦' },
  { key: 'resetAtleti', label: 'Azzera Atleti', icon: '🏆' },
  { key: 'resetStorici', label: 'Azzera Storici', icon: '🗓️' },
  { key: 'resetAbbonamenti', label: 'Azzera Abbonamenti', icon: '💳' },
  { key: 'resetSospesi', label: 'Azzera Ordini Sospesi', icon: '⏳' },
  { key: 'resetTotal', label: 'Reset Totale', icon: '⚠️' },
] as const;

export default function Impostazioni() {
  const {
    settings, setSettings, importState, setTableTotalizer, emergencyUnlockTable,
    resetMagazzino, resetAtleti, resetStorici, resetAbbonamenti, resetSospesi, resetTotal,
  } = useStore();
  const { confirm, dialog } = useConfirm();

  const [currentPw, setCurrentPw] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [confirmOwner, setConfirmOwner] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [baseRate, setBaseRate] = useState(settings.baseRate);
  const [tableMax, setTableMax] = useState(settings.tableMax);
  const [email, setEmail] = useState(settings.email);
  const [newTotalizer, setNewTotalizer] = useState(useStore.getState().cumulativeTotalizer);

  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const resetFns = { resetMagazzino, resetAtleti, resetStorici, resetAbbonamenti, resetSospesi, resetTotal };

  const requireOwner = (action: () => void) => {
    if (pw !== settings.ownerPassword) { setErr(true); return; }
    action();
    setPw(''); setErr(false);
  };

  const handleChangePassword = () => {
    setPwMsg(null);
    if (currentPw !== settings.ownerPassword) {
      setPwMsg({ type: 'err', text: 'La password attuale non è corretta.' });
      return;
    }
    if (!newOwner || newOwner.length < 4) {
      setPwMsg({ type: 'err', text: 'La nuova password deve avere almeno 4 caratteri.' });
      return;
    }
    if (newOwner !== confirmOwner) {
      setPwMsg({ type: 'err', text: 'Le nuove password non coincidono.' });
      return;
    }
    setSettings({ ownerPassword: newOwner });
    setCurrentPw(''); setNewOwner(''); setConfirmOwner('');
    setPwMsg({ type: 'ok', text: 'Password aggiornata con successo.' });
  };

  const handleReset = async (key: keyof typeof resetFns, label: string) => {
    if (await confirm(`Confermi: ${label}?`, { title: 'Reset', confirmLabel: 'Azzera' })) {
      resetFns[key]();
    }
  };

  const handleBackup = () => downloadJSON('backup_cassa_completo.json', useStore.getState());

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        importState(data);
        alert('Backup ripristinato con successo.');
      } catch {
        alert('File non valido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <SettingsIcon size={22} className="text-accent" /> Impostazioni
        </h1>
      </header>

      <Section title="Cambia Password Proprietario" icon={<KeyRound size={16} />}>
        <label className="label">Password attuale</label>
        <PasswordInput value={currentPw} onChange={setCurrentPw} placeholder="Inserisci la password attuale" />

        <label className="label mt-3">Nuova password</label>
        <PasswordInput value={newOwner} onChange={setNewOwner} placeholder="Inserisci la nuova password" />

        <label className="label mt-3">Conferma nuova password</label>
        <PasswordInput value={confirmOwner} onChange={setConfirmOwner} placeholder="Ripeti la nuova password" />

        {pwMsg && (
          <div className={`mt-3 p-2 rounded text-sm flex items-center gap-2 ${pwMsg.type === 'ok' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {pwMsg.type === 'err' && <AlertTriangle size={14} />}
            {pwMsg.text}
          </div>
        )}

        <button
          className="btn-accent mt-3"
          disabled={!currentPw || !newOwner || !confirmOwner}
          onClick={handleChangePassword}
        >
          <Save size={14} /> Aggiorna Password
        </button>
      </Section>

      <Section title="Email destinatario" icon={<Mail size={16} />}>
        <div className="flex gap-2">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.it" />
          <button className="btn-accent" onClick={() => setSettings({ email })}><Save size={14} /></button>
        </div>
      </Section>

      <OwnerSection title="Tariffe Nolo" icon={<DollarSign size={16} />} pw={pw} setPw={setPw} err={err} setErr={setErr}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tariffa base (€/h)</label>
            <input type="number" step="0.10" min="0" className="input" value={baseRate} onChange={(e) => setBaseRate(+e.target.value)} />
          </div>
          <div>
            <label className="label">Max tavolo (€/h)</label>
            <input type="number" step="0.10" min="0" className="input" value={tableMax} onChange={(e) => setTableMax(+e.target.value)} />
          </div>
        </div>
        <button
          className="btn-accent mt-3"
          onClick={() => requireOwner(() => setSettings({ baseRate, tableMax }))}
        >
          <Lock size={14} /> Salva Tariffe
        </button>
      </OwnerSection>

      <OwnerSection title="Totalizzatore Tavoli" icon={<DollarSign size={16} />} pw={pw} setPw={setPw} err={err} setErr={setErr}>
        <div className="bg-black/40 rounded-lg p-3 mb-3">
          <p className="text-xs uppercase text-gray-500">Valore attuale</p>
          <p className="text-accent text-2xl font-bold">{fmtEuro(useStore((s) => s.cumulativeTotalizer))}</p>
          <p className="text-xs text-gray-600 mt-1">Si aggiorna automaticamente alla chiusura dei tavoli</p>
        </div>
        <label className="label">Modifica manualmente (per inserire incassi giorni non presidiati)</label>
        <input type="number" step="0.10" min="0" className="input mb-2" value={newTotalizer} onChange={(e) => setNewTotalizer(+e.target.value)} />
        <button
          className="btn-accent"
          onClick={() => requireOwner(() => {
            setTableTotalizer(newTotalizer);
            alert('Totalizzatore aggiornato');
          })}
        >
          <Lock size={14} /> Aggiorna Manualmente
        </button>
      </OwnerSection>

      <OwnerSection title="Backup e Ripristino" icon={<Download size={16} />} pw={pw} setPw={setPw} err={err} setErr={setErr}>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => requireOwner(handleBackup)}>
            <Download size={14} /> Backup JSON
          </button>
          <label className="btn-ghost cursor-pointer">
            <Upload size={14} /> Ripristina
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { requireOwner(() => handleRestore(e)); }} />
          </label>
        </div>
      </OwnerSection>

      {/* --- NUOVA SEZIONE: GESTIONE EMERGENZE --- */}
      <OwnerSection title="Gestione Emergenze" icon={<AlertOctagon size={16} />} pw={pw} setPw={setPw} err={err} setErr={setErr}>
        <p className="text-xs text-gray-400 mb-3">Sblocca forzatamente un tavolo bloccato. La sessione viene archiviata e il tavolo torna libero.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((id) => (
            <button
              key={id}
              className="btn-danger text-sm flex items-center justify-center gap-1"
              onClick={() => requireOwner(() => emergencyUnlockTable(id))}
            >
              <AlertOctagon size={12} /> Sblocca Tavolo {id}
            </button>
          ))}
        </div>
      </OwnerSection>

      <OwnerSection title="Reset Granulare" icon={<RotateCcw size={16} />} pw={pw} setPw={setPw} err={err} setErr={setErr}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {RESET_OPTIONS.map((o) => (
            <button
              key={o.key}
              className="btn-danger text-sm"
              onClick={() => requireOwner(() => handleReset(o.key, o.label))}
            >
              <Trash2 size={12} /> {o.label}
            </button>
          ))}
        </div>
      </OwnerSection>

      {dialog}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4 mb-4">
      <h2 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <span className="text-accent">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function OwnerSection({
  title, icon, children, pw, setPw, err, setErr,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  pw: string; setPw: (v: string) => void; err: boolean; setErr: (v: boolean) => void;
}) {
  return (
    <section className="card p-4 mb-4 border-accent/20">
      <h2 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <Lock size={14} className="text-accent" /> <span className="text-accent">{icon}</span> {title}
      </h2>
      <div className="mb-3">
        <label className="label">Password Proprietario</label>
        <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(false); }} />
        {err && <p className="text-danger text-xs mt-1">Password errata</p>}
      </div>
      {children}
    </section>
  );
}