import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import Sidebar from '@/components/Sidebar';
import Tavoli from '@/pages/Tavoli';
import PosBar from '@/pages/PosBar';
import Magazzino from '@/pages/Magazzino';
import Atleti from '@/pages/Atleti';
import Abbonamenti from '@/pages/Abbonamenti';
import CassaGiornaliera from '@/pages/CassaGiornaliera';
import Statistiche from '@/pages/Statistiche';
import Storico from '@/pages/Storico';
import Supervisione from '@/pages/Supervisione';
import Insoluti from '@/pages/Insoluti';
import Rettifiche from '@/pages/Rettifiche';
import Impostazioni from '@/pages/Impostazioni';
import type { PageKey } from '@/types';

export default function App() {
  const [page, setPage] = useState<PageKey>('tavoli');
  const { checkAutoLock, touch, suspendedOrders } = useStore();
  const suspendedCount = suspendedOrders.filter((o) => o.status === 'sospeso').length;

  useEffect(() => {
    const id = setInterval(checkAutoLock, 30000);
    const onClick = () => touch();
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onClick);
    return () => {
      clearInterval(id);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onClick);
    };
  }, [checkAutoLock, touch]);

  const renderPage = () => {
    switch (page) {
      case 'tavoli': return <Tavoli />;
      case 'pos': return <PosBar />;
      case 'magazzino': return <Magazzino />;
      case 'atleti': return <Atleti />;
      case 'abbonamenti': return <Abbonamenti />;
      case 'cassa': return <CassaGiornaliera />;
      case 'statistiche': return <Statistiche />;
      case 'storico': return <Storico />;
      case 'supervisione': return <Supervisione />;
      case 'insoluti': return <Insoluti />;
      case 'rettifiche': return <Rettifiche />;
      case 'impostazioni': return <Impostazioni />;
      default: return <Tavoli />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-gray-200">
      <Sidebar current={page} onNavigate={setPage} suspendedCount={suspendedCount} />
      <main className="flex-1 overflow-y-auto">{renderPage()}</main>
    </div>
  );
}