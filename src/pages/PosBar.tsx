import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Athlete, Product } from '@/types';
import { fmtEuro, fmtDateTime, sortByNameIT, sortByCategoryThenNameIT } from '@/lib/utils';
import Modal from '@/components/Modal';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { Plus, Trash2, ShoppingCart, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { sortAthletes, socioBadge } from '@/pages/Atleti';

type CartLine = { athleteId: string; athleteName: string; productId: string; name: string; price: number; qty: number };

export default function PosBar() {
  const { products, athletes, suspendedOrders, addSuspendedOrder, paySuspended, markInsoluto, deleteSuspended } = useStore();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selAthlete, setSelAthlete] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const sortedAthletes = useMemo(() => sortAthletes(athletes), [athletes]);
  const sortedProducts = useMemo(() => sortByCategoryThenNameIT(products), [products]);

  const addToCart = (p: Product) => {
    if (!selAthlete) {
      alert('Seleziona un atleta prima di aggiungere prodotti.');
      return;
    }
    const a = athletes.find((x) => x.id === selAthlete)!;
    setCart((c) => {
      const ex = c.find((l) => l.productId === p.id && l.athleteId === selAthlete);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { athleteId: a.id, athleteName: a.name, productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const checkout = (mode: 'pay' | 'suspend' | 'insoluto') => {
    if (cart.length === 0) return;
    if (mode === 'pay') {
      useStore.getState().revenueLines = [
        ...useStore.getState().revenueLines,
        {
          id: Math.random().toString(36).slice(2),
          source: 'bar',
          description: `Bar - ${cart.map((l) => l.athleteName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`,
          amount: total,
          at: Date.now(),
          operator: useStore.getState().currentOperator || 'Operatore',
        },
      ];
      cart.forEach((l) => {
        useStore.setState({
          products: useStore.getState().products.map((p) =>
            p.id === l.productId ? { ...p, stock: Math.max(0, p.stock - l.qty) } : p
          ),
        });
      });
      useStore.getState().logAudit('Vendita Bar', `€${total.toFixed(2)}`);
    } else if (mode === 'suspend') {
      const grouped = groupByAthlete(cart);
      grouped.forEach((g) => addSuspendedOrder({ athleteId: g.athleteId, athleteName: g.athleteName, items: g.items, total: g.total }));
    } else if (mode === 'insoluto') {
      const grouped = groupByAthlete(cart);
      grouped.forEach((g) => {
        addSuspendedOrder({ athleteId: g.athleteId, athleteName: g.athleteName, items: g.items, total: g.total });
        markInsoluto(useStore.getState().suspendedOrders.slice(-1)[0]?.id ?? '');
      });
    }
    setCart([]);
    setCheckoutOpen(false);
  };

  const pendingSuspended = suspendedOrders.filter((o) => o.status === 'sospeso');

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">POS Bar</h1>
          <p className="text-sm text-gray-500">Seleziona atleta, aggiungi prodotti, incassa</p>
        </div>
        <button
          className="btn-ghost relative"
          onClick={() => setSuspendedOpen(true)}
        >
          <Clock size={16} /> Ordini Sospesi
          {pendingSuspended.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-danger text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
              {pendingSuspended.length}
            </span>
          )}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <label className="label">Atleta per questo acquisto</label>
            <select className="input" value={selAthlete} onChange={(e) => setSelAthlete(e.target.value)}>
              <option value="">Seleziona atleta...</option>
              {sortedAthletes.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {a.socioType}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="card p-4 text-left hover:border-accent/40 disabled:opacity-40"
              >
                <p className="font-medium text-gray-200 truncate">{p.name}</p>
                <p className="text-xs text-gray-500 mt-1">{p.category}</p>
                <div className="flex justify-between mt-2">
                  <span className="text-accent font-semibold">{fmtEuro(p.price)}</span>
                  <span className="text-xs text-gray-600">Giac. {p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 h-fit sticky top-4">
          <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
            <ShoppingCart size={18} className="text-accent" /> Carrello
          </h3>
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Carrello vuoto</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {cart.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-black/40 rounded p-2">
                  <div className="min-w-0">
                    <p className="text-gray-200 truncate">{l.qty}x {l.name}</p>
                    <p className="text-xs text-gray-600">{l.athleteName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">{fmtEuro(l.price * l.qty)}</span>
                    <button
                      className="text-gray-600 hover:text-danger"
                      onClick={() => setCart((c) => c.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3 flex justify-between font-semibold">
            <span className="text-gray-400">Totale</span>
            <span className="text-accent text-lg">{fmtEuro(total)}</span>
          </div>
          <button
            className="btn-accent w-full mt-3"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            Checkout
          </button>
        </div>
      </div>

      {checkoutOpen && (
        <Modal open onClose={() => setCheckoutOpen(false)} title="Checkout">
          <p className="text-gray-300 mb-4">Totale da incassare: <span className="text-accent font-semibold text-lg">{fmtEuro(total)}</span></p>
          <div className="grid grid-cols-1 gap-2">
            <button className="btn-success" onClick={() => checkout('pay')}>
              <CheckCircle size={16} /> Paga Ora
            </button>
            <button className="btn-ghost" onClick={() => checkout('suspend')}>
              <Clock size={16} /> Manda in Sospeso
            </button>
            <button className="btn-danger" onClick={() => checkout('insoluto')}>
              <AlertTriangle size={16} /> Segna come Insoluto
            </button>
          </div>
        </Modal>
      )}

      {suspendedOpen && (
        <Modal open onClose={() => setSuspendedOpen(false)} title="Ordini Sospesi" maxWidth="max-w-2xl">
          {suspendedOrders.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Nessun ordine sospeso.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {suspendedOrders.map((o) => (
                <div key={o.id} className={`card p-3 ${o.status === 'insoluto' ? 'border-danger/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-200">{o.athleteName}</p>
                      <p className="text-xs text-gray-500">{fmtDateTime(o.createdAt)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      o.status === 'sospeso' ? 'bg-accent/20 text-accent' : 'bg-danger/20 text-danger'
                    }`}>
                      {o.status === 'sospeso' ? 'Sospeso' : 'Insoluto'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {o.items.map((i, idx) => <span key={idx}>{i.qty}x {i.name} </span>)}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <span className="text-accent font-semibold">{fmtEuro(o.total)}</span>
                    <div className="flex gap-1">
                      {o.status === 'sospeso' && (
                        <>
                          <button className="btn-success text-xs px-2 py-1" onClick={() => paySuspended(o.id)}>Salda Ora</button>
                          <button className="btn-danger text-xs px-2 py-1" onClick={() => markInsoluto(o.id)}>Insoluto</button>
                        </>
                      )}
                      <button
                        className="text-gray-600 hover:text-danger p-1"
                        onClick={async () => { if (await confirm('Eliminare questo ordine?')) deleteSuspended(o.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {dialog}
    </div>
  );
}

function groupByAthlete(cart: CartLine[]) {
  const map = new Map<string, { athleteId: string; athleteName: string; items: { productId: string; name: string; price: number; qty: number }[]; total: number }>();
  cart.forEach((l) => {
    const g = map.get(l.athleteId) ?? { athleteId: l.athleteId, athleteName: l.athleteName, items: [], total: 0 };
    const ex = g.items.find((i) => i.productId === l.productId);
    if (ex) ex.qty += l.qty;
    else g.items.push({ productId: l.productId, name: l.name, price: l.price, qty: l.qty });
    g.total += l.price * l.qty;
    map.set(l.athleteId, g);
  });
  return [...map.values()];
}
