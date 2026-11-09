import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Product } from '@/types';
import { fmtEuro, sortByCategoryThenNameIT } from '@/lib/utils';
import Modal from '@/components/Modal';
import ConfirmDialog, { useConfirm } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

const CATEGORIES = ['Bevande', 'Caffetteria', 'Snack', 'Altro'];

export default function Magazzino() {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [edit, setEdit] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const { confirm, dialog } = useConfirm();
  const sorted = useMemo(() => sortByCategoryThenNameIT(products), [products]);

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Magazzino</h1>
          <p className="text-sm text-gray-500">{products.length} prodotti</p>
        </div>
        <button className="btn-accent" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nuovo Prodotto
        </button>
      </header>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="mx-auto text-gray-700 mb-3" size={48} />
          <p className="text-gray-500">Nessun prodotto. Aggiungi il primo.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Prodotto</th>
                <th className="text-left p-3">Categoria</th>
                <th className="text-right p-3">Giacenza</th>
                <th className="text-right p-3">Prezzo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-black/20">
                  <td className="p-3 text-gray-200">{p.name}</td>
                  <td className="p-3 text-gray-400">{p.category}</td>
                  <td className="p-3 text-right">
                    <span className={p.stock <= 2 ? 'text-danger font-semibold' : 'text-gray-300'}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="p-3 text-right text-gray-300">{fmtEuro(p.price)}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button className="text-gray-500 hover:text-accent" onClick={() => setEdit(p)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="text-gray-500 hover:text-danger"
                        onClick={async () => {
                          if (await confirm(`Eliminare "${p.name}"?`)) deleteProduct(p.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(edit || creating) && (
        <ProductForm
          product={edit}
          onClose={() => {
            setEdit(null);
            setCreating(false);
          }}
          onSave={(data) => {
            if (edit) updateProduct(edit.id, data);
            else addProduct(data);
            setEdit(null);
            setCreating(false);
          }}
        />
      )}

      {dialog}
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSave,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (data: Omit<Product, 'id'>) => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? CATEGORIES[0]);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [price, setPrice] = useState(product?.price ?? 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Modifica prodotto' : 'Nuovo prodotto'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
          <button
            className="btn-accent"
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), category, stock, price })}
          >
            Salva
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Giacenza</label>
            <input type="number" min="0" className="input" value={stock} onChange={(e) => setStock(+e.target.value)} />
          </div>
          <div>
            <label className="label">Prezzo (€)</label>
            <input type="number" step="0.10" min="0" className="input" value={price} onChange={(e) => setPrice(+e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
