import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Table, Product, Athlete, SuspendedOrder, Subscription,
  Reconciliation, Settings, AuditEntry, RevenueLine, BarItem, Expense, PlayerCheckout,
} from '@/types';

type StoreState = {
  tables: Table[];
  products: Product[];
  athletes: Athlete[];
  suspendedOrders: SuspendedOrder[];
  subscriptions: Subscription[];
  reconciliations: Reconciliation[];
  settings: Settings;
  auditLog: AuditEntry[];
  revenueLines: RevenueLine[];
  expenses: { id: string; description: string; category: string; amount: number; at: number }[];
  fund: number;
  cumulativeTotalizer: number;
  currentOperator: string;
  isAdminUnlocked: boolean;
  isOwnerUnlocked: boolean;
  lastActivity: number;
  closedTableDetails: Record<number, { athleteId: string; name: string; amount: number; paymentMode: string }[]>;

  setOperator: (name: string) => void;
  unlockAdmin: (password: string) => boolean;
  lockAdmin: () => void;
  unlockOwner: (password: string) => boolean;
  lockOwner: () => void;
  touch: () => void;
  checkAutoLock: () => void;

  setSettings: (s: Partial<Settings>) => void;

  addAthlete: (name: string) => void;
  updateAthlete: (id: string, patch: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;

  deleteAuditEntry: (at: number) => void;
  deleteAuditEntries: (ats: number[]) => void;
  deleteAllAudit: () => void;
  deleteTableRecord: (id: number) => void;
  deleteTableRecords: (ids: number[]) => void;

  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  openTable: (id: number, players: { athleteId: string; name: string; isSubscribed: boolean }[]) => void;
  addPlayerToTable: (tableId: number, p: { athleteId: string; name: string; isSubscribed: boolean }) => void;
  pauseTable: (id: number) => void;
  resumeTable: (id: number) => void;
  addBarItem: (tableId: number, athleteId: string, item: BarItem) => void;
  closeTable: (id: number, mode: 'single' | 'double' | 'full', checkouts: PlayerCheckout[]) => { total: number; perPlayer: number[] } | null;
  exitPlayers: (id: number, checkouts: PlayerCheckout[]) => { total: number; perPlayer: number[] } | null;
  emergencyUnlockTable: (id: number) => void;

  addSuspendedOrder: (o: Omit<SuspendedOrder, 'id' | 'createdAt' | 'status'>) => void;
  paySuspended: (id: string) => void;
  markInsoluto: (id: string) => void;
  deleteSuspended: (id: string) => void;
  voidInsoluto: (id: string) => void;

  addSubscription: (s: Omit<Subscription, 'id'>) => void;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  paySubscription: (id: string) => void;

  setFund: (amount: number) => void;
  addExpense: (e: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  voidRevenueLine: (id: string) => void;

  closeReconciliation: () => Reconciliation;
  deleteReconciliation: (id: string) => void;
  deleteAllReconciliations: () => void;

  resetMagazzino: () => void;
  resetAtleti: () => void;
  resetStorici: () => void;
  resetAbbonamenti: () => void;
  resetSospesi: () => void;
  resetTotal: () => void;

  importState: (s: Partial<StoreState>) => void;
  setTableTotalizer: (amount: number) => void;
  adjustPlayerPayment: (athleteId: string, newPaidAmount: number, reason: string) => void;
  rectifyClosedTablePayment: (tableId: number, athleteId: string, newPaidAmount: number, reason: string) => void;
  logAudit: (action: string, value: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const DEFAULT_TABLES: Table[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  name: `Tavolo ${n}`,
  status: 'libero',
  players: [],
  startTime: null,
  pausedAt: null,
  totalPausedMs: 0,
  pauseLogs: [],
  closedAt: null,
  operator: null,
  lastMatchCost: null,
  lastMatchPlayers: [],
  lastMatchAt: null,
  finalCost: null,
  noloRevenue: null,
  barRevenue: null,
  discountsApplied: 0,
  barDiscountApplied: 0,
  roundingApplied: 0,
  deleted: false,
  deletedAt: null,
  theoreticalCost: null,
  discountPercent: 0,
  discountAmount: 0,
  roundingAmount: 0,
  finalAmount: null,
  barTheoretical: 0,
  barDiscount: 0,
  barRounding: 0,
  barFinal: 0,
  noloAlreadyCounted: 0,
}));

const DEFAULT_SETTINGS: Settings = {
  ownerPassword: '161193',
  baseRate: 6,
  tableMax: 9,
  email: '',
  generalTotalizerOverride: null,
  generalTotalizerOverrideDate: null,
};

// Calcola le ore effettive di permanenza di un giocatore
const getPlayerHours = (player: { joinTime?: number }, table: Table, now: number) => {
  const joinTime = player.joinTime ?? table.startTime ?? now;
  const elapsedMs = (table.pausedAt ?? now) - joinTime;
  // Sottraggo le pause fatte dopo il join del giocatore
  const pauseAfterJoin = table.pauseLogs
    .filter(log => log.at >= joinTime)
    .reduce((sum, log) => sum + log.durationMs, 0);
  return Math.max(0, (elapsedMs - pauseAfterJoin) / 3600000);
};

// Calcola il nolo teorico per un singolo giocatore
const calcPlayerNolo = (player: { isSubscribed: boolean; joinTime?: number }, table: Table, now: number, baseRate: number, tableMax: number) => {
  if (player.isSubscribed) return 0;
  const hours = getPlayerHours(player, table, now);
  const n = table.players.length;
  const subscribedCount = table.players.filter(p => p.isSubscribed).length;
  const noloPaying = n - subscribedCount;
  
  if (n <= 2) {
    return baseRate * hours;
  } else {
    // 3+ giocatori: tableMax diviso per num paganti, moltiplicato per ore individuali
    return (tableMax / Math.max(1, noloPaying)) * hours;
  }
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tables: DEFAULT_TABLES,
      products: [],
      athletes: [],
      suspendedOrders: [],
      subscriptions: [],
      reconciliations: [],
      settings: DEFAULT_SETTINGS,
      auditLog: [],
      revenueLines: [],
      expenses: [],
      fund: 0,
      cumulativeTotalizer: 0,
      currentOperator: '',
      isAdminUnlocked: false,
      isOwnerUnlocked: false,
      lastActivity: Date.now(),
      closedTableDetails: {},

      setOperator: (name) => set({ currentOperator: name }),

      unlockAdmin: (password) => {
        if (password === get().settings.ownerPassword) {
          set({ isAdminUnlocked: true, lastActivity: Date.now() });
          return true;
        }
        return false;
      },
      lockAdmin: () => set({ isAdminUnlocked: false, isOwnerUnlocked: false }),
      unlockOwner: (password) => {
        if (password === get().settings.ownerPassword) {
          set({ isOwnerUnlocked: true, lastActivity: Date.now() });
          return true;
        }
        return false;
      },
      lockOwner: () => set({ isOwnerUnlocked: false }),

      touch: () => set({ lastActivity: Date.now() }),
      checkAutoLock: () => {
        if (get().isAdminUnlocked && Date.now() - get().lastActivity > 15 * 60 * 1000) {
          set({ isAdminUnlocked: false, isOwnerUnlocked: false });
        }
      },

      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),

      logAudit: (action, value) => {
        const entry: AuditEntry = {
          at: Date.now(),
          action,
          value,
          operator: get().currentOperator || 'Sistema',
        };
        set({ auditLog: [entry, ...get().auditLog].slice(0, 500) });
      },

      addAthlete: (name) => {
        const a: Athlete = { id: uid(), name: name.trim(), debt: 0, documentType: 'Nessuno', socioType: 'Socio Ordinario', phone: '' };
        set({ athletes: [...get().athletes, a] });
        get().logAudit('Atleta aggiunto', name);
      },
      updateAthlete: (id, patch) =>
        set({ athletes: get().athletes.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
      deleteAthlete: (id) => {
        set({ athletes: get().athletes.filter((a) => a.id !== id) });
        get().logAudit('Atleta eliminato', id);
      },

      deleteAuditEntry: (at) => {
        set({ auditLog: get().auditLog.map((a) => a.at === at ? { ...a, deleted: true, deletedAt: Date.now() } : a) });
      },
      deleteAuditEntries: (ats) => {
        const set_ = new Set(ats);
        const now = Date.now();
        set({ auditLog: get().auditLog.map((a) => set_.has(a.at) ? { ...a, deleted: true, deletedAt: now } : a) });
      },
      deleteAllAudit: () => {
        const now = Date.now();
        set({ auditLog: get().auditLog.map((a) => ({ ...a, deleted: true, deletedAt: now })) });
      },
      deleteTableRecord: (id) => {
        set({ tables: get().tables.map((t) => t.id === id ? { ...t, deleted: true, deletedAt: Date.now() } : t) });
        get().logAudit('Record supervisione eliminato', `Tavolo ${id}`);
      },
      deleteTableRecords: (ids) => {
        const set_ = new Set(ids);
        const now = Date.now();
        set({ tables: get().tables.map((t) => set_.has(t.id) ? { ...t, deleted: true, deletedAt: now } : t) });
      },

      addProduct: (p) => {
        const prod: Product = { ...p, id: uid() };
        set({ products: [...get().products, prod] });
        get().logAudit('Prodotto aggiunto', p.name);
      },
      updateProduct: (id, patch) =>
        set({ products: get().products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      deleteProduct: (id) => set({ products: get().products.filter((p) => p.id !== id) }),

      openTable: (id, players) => {
        const now = Date.now();
        const athleteIds = new Set(players.map((p) => p.athleteId));

        const pendingFor = (athleteId: string) =>
          get().suspendedOrders
            .filter((o) => o.athleteId === athleteId && o.source === 'tavolo' && o.status === 'sospeso')
            .reduce((s, o) => s + o.total, 0);

        const barOrdersToMigrate = get().suspendedOrders.filter(
          (o) => athleteIds.has(o.athleteId) && o.status === 'sospeso' && (o.source === 'bar' || !o.source)
        );

        const remainingSuspended = get().suspendedOrders.filter(
          (o) => !barOrdersToMigrate.includes(o)
        );

        const playersWithMigratedItems = players.map((p) => {
          const playerBarItems = barOrdersToMigrate
            .filter((o) => o.athleteId === p.athleteId)
            .flatMap((o) => o.items || []);

          return {
            ...p,
            items: [...(p.items || []), ...playerBarItems],
            pendingTableDebt: pendingFor(p.athleteId),
            joinTime: now,
          };
        });

        set({
          suspendedOrders: remainingSuspended,
          tables: get().tables.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'occupato',
                  players: playersWithMigratedItems,
                  startTime: now,
                  pausedAt: null,
                  totalPausedMs: 0,
                  pauseLogs: [],
                  closedAt: null,
                  operator: get().currentOperator || 'Operatore',
                  finalCost: null,
                  discountsApplied: 0,
                  roundingApplied: 0,
                }
              : t
          ),
        });
        
        if (barOrdersToMigrate.length) {
          get().logAudit('Consumazioni bar agganciate al tavolo', `Tavolo ${id}`);
        }
      },

      addPlayerToTable: (tableId, p) => {
        const now = Date.now();
        const pendingTableDebt = get().suspendedOrders
          .filter((o) => o.athleteId === p.athleteId && o.source === 'tavolo' && o.status === 'sospeso')
          .reduce((s, o) => s + o.total, 0);
        set({
          tables: get().tables.map((t) =>
            t.id === tableId
              ? { ...t, players: [...t.players, { ...p, items: [], pendingTableDebt, joinTime: now }] }
              : t
          ),
        });
        get().logAudit('Giocatore aggiunto al tavolo', `${p.name} al Tavolo ${tableId}`);
      },

      pauseTable: (id) => {
        const now = Date.now();
        set({
          tables: get().tables.map((t) =>
            t.id === id && t.status === 'occupato' && t.pausedAt === null
              ? { ...t, pausedAt: now }
              : t
          ),
        });
        get().logAudit('Pausa tavolo', `Tavolo ${id}`);
      },
      resumeTable: (id) => {
        const now = Date.now();
        set({
          tables: get().tables.map((t) => {
            if (t.id === id && t.pausedAt !== null) {
              const dur = now - t.pausedAt;
              return {
                ...t,
                pausedAt: null,
                totalPausedMs: t.totalPausedMs + dur,
                pauseLogs: [...t.pauseLogs, { at: t.pausedAt, durationMs: dur }],
              };
            }
            return t;
          }),
        });
        get().logAudit('Ripresa tavolo', `Tavolo ${id}`);
      },

      addBarItem: (tableId, athleteId, item) => {
        set({
          tables: get().tables.map((t) => {
            if (t.id !== tableId) return t;
            return {
              ...t,
              players: t.players.map((p) => {
                if (p.athleteId !== athleteId) return p;
                const existing = p.items.find((i) => i.productId === item.productId);
                if (existing) {
                  return {
                    ...p,
                    items: p.items.map((i) =>
                      i.productId === item.productId ? { ...i, qty: i.qty + item.qty } : i
                    ),
                  };
                }
                return { ...p, items: [...p.items, item] };
              }),
            };
          }),
        });
        set({
          products: get().products.map((p) =>
            p.id === item.productId ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p
          ),
        });
      },

      closeTable: (id, mode, checkouts) => {
        const t = get().tables.find((x) => x.id === id);
        if (!t || t.status !== 'occupato') return null;
        const now = Date.now();
        const { baseRate, tableMax } = get().settings;
        const n = t.players.length;

        // Calcolo nolo teorico INDIVIDUALE per ogni giocatore
        const playerNoloMap = new Map<string, number>();
        let noloTheoreticalTotal = 0;
        t.players.forEach((p) => {
          const nolo = calcPlayerNolo(p, t, now, baseRate, tableMax);
          playerNoloMap.set(p.athleteId, Math.round(nolo * 10) / 10);
          noloTheoreticalTotal += nolo;
        });
        noloTheoreticalTotal = Math.round(noloTheoreticalTotal * 10) / 10;

        const barTotal = t.players.reduce(
          (sum, p) => sum + p.items.reduce((s, i) => s + i.price * i.qty, 0),
          0
        );

        let totalFinal = 0;
        let totalNoloDiscount = 0;
        let totalNoloRounding = 0;
        let totalBarDiscount = 0;
        let totalBarRounding = 0;
        const perPlayer: number[] = [];
        const foldedAthleteIds = new Set<string>();
        const foldedSuspensions: SuspendedOrder[] = [];

        checkouts.forEach((c) => {
          const noloTheo = playerNoloMap.get(c.athleteId) ?? 0;
          const noloDisc = noloTheo * (c.noloDiscountPct / 100);
          const noloAfter = noloTheo - noloDisc;
          const noloFinal = noloAfter + c.noloRounding;
          const barDisc = c.barTheoretical * (c.barDiscountPct / 100);
          const barAfter = c.barTheoretical - barDisc;
          const barFinalAmt = barAfter + c.barRounding;
          const pendingTableDebt = t.players.find((p) => p.athleteId === c.athleteId)?.pendingTableDebt ?? 0;
          const playerFinal = Math.round((noloFinal + barFinalAmt + pendingTableDebt) * 10) / 10;
          perPlayer.push(playerFinal);
          foldedAthleteIds.add(c.athleteId);

          if (c.paymentMode === 'insoluto' && playerFinal > 0) {
            set({
              athletes: get().athletes.map((a) =>
                a.id === c.athleteId ? { ...a, debt: a.debt + playerFinal } : a
              ),
            });
            get().logAudit('Insoluto da chiusura tavolo', `${c.name} €${playerFinal.toFixed(2)}`);
          } else if (c.paymentMode === 'sospeso' && playerFinal > 0) {
            foldedSuspensions.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              items: [],
              total: playerFinal,
              createdAt: now,
              status: 'sospeso',
              source: 'tavolo',
            });
            get().logAudit('Sospeso tavolo', `${c.name} €${playerFinal.toFixed(2)}`);
          } else {
            totalFinal += playerFinal;
          }
          totalNoloDiscount += noloDisc;
          totalNoloRounding += c.noloRounding;
          totalBarDiscount += barDisc;
          totalBarRounding += c.barRounding;
        });

        const finalCost = Math.round(totalFinal * 10) / 10;
        const noloRev = noloTheoreticalTotal;
        const barRev = Math.round(barTotal * 10) / 10;
        const totalDiscount = totalNoloDiscount + totalBarDiscount;
        const totalRounding = totalNoloRounding + totalBarRounding;
        const noloDelta = Math.max(0, Math.round((noloTheoreticalTotal - t.noloAlreadyCounted) * 10) / 10);

        const revenueLine: RevenueLine = {
          id: uid(),
          source: 'tavolo',
          description: `${t.name} - ${t.players.map((p) => p.name).join(', ')}${totalDiscount > 0 ? ` (sconto applicato)` : ''}`,
          amount: finalCost,
          at: now,
          operator: get().currentOperator || 'Operatore',
        };

        set({
          closedTableDetails: { ...get().closedTableDetails, [id]: checkouts.map((c, i) => ({ athleteId: c.athleteId, name: c.name, amount: perPlayer[i], paymentMode: c.paymentMode })) },
          revenueLines: [...get().revenueLines, revenueLine],
          suspendedOrders: [
            ...get().suspendedOrders.filter(
              (o) => !(o.source === 'tavolo' && o.status === 'sospeso' && foldedAthleteIds.has(o.athleteId))
            ),
            ...foldedSuspensions,
          ],
          cumulativeTotalizer: Math.round((get().cumulativeTotalizer + noloDelta) * 10) / 10,
          tables: get().tables.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: 'libero',
                  players: [],
                  startTime: null,
                  pausedAt: null,
                  totalPausedMs: 0,
                  pauseLogs: [],
                  closedAt: now,
                  operator: null,
                  finalCost,
                  noloRevenue: noloRev,
                  barRevenue: barRev,
                  discountsApplied: totalDiscount,
                  barDiscountApplied: totalBarDiscount,
                  roundingApplied: totalRounding,
                  lastMatchCost: finalCost,
                  lastMatchPlayers: t.players.map((p) => p.name),
                  lastMatchAt: now,
                  theoreticalCost: noloTheoreticalTotal,
                  discountPercent: 0,
                  discountAmount: totalNoloDiscount,
                  roundingAmount: totalNoloRounding,
                  finalAmount: finalCost,
                  barTheoretical: barRev,
                  barDiscount: totalBarDiscount,
                  barRounding: totalBarRounding,
                  barFinal: Math.round((barRev - totalBarDiscount + totalBarRounding) * 10) / 10,
                  noloAlreadyCounted: 0,
                }
              : x
          ),
        });

        get().logAudit(
          `Chiusura tavolo ${id} (${mode})`,
          `€${finalCost.toFixed(2)} (teorico €${noloTheoreticalTotal.toFixed(2)})`
        );

        return { total: finalCost, perPlayer };
      },

      exitPlayers: (id, checkouts) => {
        const t = get().tables.find((x) => x.id === id);
        if (!t || t.status !== 'occupato') return null;
        const now = Date.now();
        const { baseRate, tableMax } = get().settings;

        const exitingIds = new Set(checkouts.map((c) => c.athleteId));
        const exitingPlayers = t.players.filter((p) => exitingIds.has(p.athleteId));
        const remainingPlayers = t.players.filter((p) => !exitingIds.has(p.athleteId));

        // Calcolo nolo teorico INDIVIDUALE per ogni giocatore in uscita
        const playerNoloMap = new Map<string, number>();
        let exitingNoloTheoretical = 0;
        exitingPlayers.forEach((p) => {
          const nolo = calcPlayerNolo(p, t, now, baseRate, tableMax);
          playerNoloMap.set(p.athleteId, Math.round(nolo * 10) / 10);
          exitingNoloTheoretical += nolo;
        });
        exitingNoloTheoretical = Math.round(exitingNoloTheoretical * 10) / 10;

        const perPlayer: number[] = [];
        const rotatedSuspensions: SuspendedOrder[] = [];
        let totalFinal = 0;
        let totalNoloDiscount = 0;
        let totalNoloRounding = 0;
        let totalBarDiscount = 0;
        let totalBarRounding = 0;
        let exitingBarTotal = 0;

        checkouts.forEach((c) => {
          const noloTheo = playerNoloMap.get(c.athleteId) ?? 0;
          const noloDisc = noloTheo * (c.noloDiscountPct / 100);
          const noloAfter = noloTheo - noloDisc;
          const noloFinal = noloAfter + c.noloRounding;
          const barDisc = c.barTheoretical * (c.barDiscountPct / 100);
          const barAfter = c.barTheoretical - barDisc;
          const barFinalAmt = barAfter + c.barRounding;
          const pendingTableDebt = t.players.find((p) => p.athleteId === c.athleteId)?.pendingTableDebt ?? 0;
          const playerFinal = Math.round((noloFinal + barFinalAmt + pendingTableDebt) * 10) / 10;
          perPlayer.push(playerFinal);
          exitingBarTotal += c.barTheoretical;
          totalNoloDiscount += noloDisc;
          totalNoloRounding += c.noloRounding;
          totalBarDiscount += barDisc;
          totalBarRounding += c.barRounding;

          if (c.paymentMode === 'insoluto' && playerFinal > 0) {
            set({
              athletes: get().athletes.map((a) =>
                a.id === c.athleteId ? { ...a, debt: a.debt + playerFinal } : a
              ),
            });
            get().logAudit('Insoluto da uscita parziale', `${c.name} €${playerFinal.toFixed(2)}`);
          } else if (c.paymentMode === 'sospeso' && playerFinal > 0) {
            rotatedSuspensions.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              items: [],
              total: playerFinal,
              createdAt: now,
              status: 'sospeso',
              source: 'tavolo',
            });
            get().logAudit('Sospeso Nolo (rotazione)', `${c.name} €${playerFinal.toFixed(2)}`);
          }
          totalFinal += playerFinal;
        });

        const totalDiscount = totalNoloDiscount + totalBarDiscount;
        const totalRounding = totalNoloRounding + totalBarRounding;

        set({
          suspendedOrders: [
            ...get().suspendedOrders.filter(
              (o) => !(o.source === 'tavolo' && o.status === 'sospeso' && exitingIds.has(o.athleteId))
            ),
            ...rotatedSuspensions,
          ],
          tables: get().tables.map((x) => {
            if (x.id !== id) return x;
            const stillOccupato = remainingPlayers.length > 0;
            return {
              ...x,
              status: stillOccupato ? 'occupato' : 'libero',
              players: remainingPlayers,
              startTime: stillOccupato ? x.startTime : null,
              pausedAt: stillOccupato ? x.pausedAt : null,
              totalPausedMs: stillOccupato ? x.totalPausedMs : 0,
              pauseLogs: stillOccupato ? x.pauseLogs : [],
              closedAt: stillOccupato ? x.closedAt : now,
              operator: stillOccupato ? x.operator : null,
              noloAlreadyCounted: Math.round((x.noloAlreadyCounted + exitingNoloTheoretical) * 10) / 10,
              discountsApplied: Math.round((x.discountsApplied + totalDiscount) * 10) / 10,
              barDiscountApplied: Math.round((x.barDiscountApplied + totalBarDiscount) * 10) / 10,
              roundingApplied: Math.round((x.roundingApplied + totalRounding) * 10) / 10,
              barTheoretical: Math.round((x.barTheoretical + exitingBarTotal) * 10) / 10,
              barDiscount: Math.round((x.barDiscount + totalBarDiscount) * 10) / 10,
              barRounding: Math.round((x.barRounding + totalBarRounding) * 10) / 10,
            };
          }),
        });

        get().logAudit(
          `Uscita parziale tavolo ${id}`,
          `${exitingPlayers.map((p) => p.name).join(', ')} - €${totalFinal.toFixed(2)} (sospeso rotazione)`
        );

        return { total: totalFinal, perPlayer };
      },

      emergencyUnlockTable: (id: number) => {
        const t = get().tables.find((x) => x.id === id);
        if (!t || t.status !== 'occupato') return;
        const now = Date.now();
        const { baseRate, tableMax } = get().settings;
        
        // Calcolo nolo individuale per ogni giocatore
        let cost = 0;
        t.players.forEach((p) => {
          cost += calcPlayerNolo(p, t, now, baseRate, tableMax);
        });
        cost = Math.round(cost * 10) / 10;

        const revenueLine: RevenueLine = {
          id: uid(),
          source: 'tavolo',
          description: `EMERGENZA ${t.name} - ${t.players.map((p) => p.name).join(', ')}`,
          amount: cost,
          at: now,
          operator: get().currentOperator || 'Admin',
        };

        set({
          revenueLines: [...get().revenueLines, revenueLine],
          cumulativeTotalizer: Math.round((get().cumulativeTotalizer + cost) * 10) / 10,
          tables: get().tables.map((x) => 
            x.id === id ? { 
              ...x, 
              status: 'libero', 
              players: [], 
              startTime: null, 
              pausedAt: null, 
              totalPausedMs: 0, 
              pauseLogs: [], 
              closedAt: now, 
              operator: null, 
              finalCost: cost, 
              lastMatchCost: cost, 
              lastMatchPlayers: t.players.map(p => p.name), 
              lastMatchAt: now 
            } : x
          ),
        });
        get().logAudit('SBLOCCO EMERGENZA', `Tavolo ${id} sbloccato forzatamente. Incasso: €${cost.toFixed(2)}`);
      },

      addSuspendedOrder: (o) => {
        const order: SuspendedOrder = {
          ...o,
          id: uid(),
          createdAt: Date.now(),
          status: 'sospeso',
          source: o.source || 'bar',
        };
        set({ suspendedOrders: [...get().suspendedOrders, order] });
        get().logAudit('Ordine in sospeso', `${o.athleteName} €${o.total.toFixed(2)}`);
      },
      paySuspended: (id) => {
        const o = get().suspendedOrders.find((x) => x.id === id);
        if (!o) return;
        const revenue: RevenueLine = {
          id: uid(),
          source: 'sospeso',
          description: `Sospeso saldato - ${o.athleteName}`,
          amount: o.total,
          at: Date.now(),
          operator: get().currentOperator || 'Operatore',
        };
        set({
          suspendedOrders: get().suspendedOrders.filter((x) => x.id !== id),
          revenueLines: [...get().revenueLines, revenue],
        });
        get().logAudit('Sospeso saldato', `${o.athleteName} €${o.total.toFixed(2)}`);
      },
      markInsoluto: (id) => {
        const o = get().suspendedOrders.find((x) => x.id === id);
        if (!o) return;
        set({
          suspendedOrders: get().suspendedOrders.map((x) =>
            x.id === id ? { ...x, status: 'insoluto' } : x
          ),
          athletes: get().athletes.map((a) =>
            a.id === o.athleteId ? { ...a, debt: a.debt + o.total } : a
          ),
        });
        get().logAudit('Insoluto registrato', `${o.athleteName} €${o.total.toFixed(2)}`);
      },
      deleteSuspended: (id) => {
        set({ suspendedOrders: get().suspendedOrders.filter((x) => x.id !== id) });
        get().logAudit('Ordine sospeso eliminato', id);
      },

      voidInsoluto: (id) => {
        const o = get().suspendedOrders.find((x) => x.id === id);
        if (!o || o.status !== 'insoluto') return;
        const storno: RevenueLine = {
          id: uid(),
          source: 'sospeso',
          description: `STORNO insoluto - ${o.athleteName}`,
          amount: o.total,
          at: Date.now(),
          voided: true,
          operator: get().currentOperator || 'Admin',
        };
        set({
          suspendedOrders: get().suspendedOrders.filter((x) => x.id !== id),
          athletes: get().athletes.map((a) =>
            a.id === o.athleteId ? { ...a, debt: Math.max(0, a.debt - o.total) } : a
          ),
          revenueLines: [...get().revenueLines, storno],
        });
        get().logAudit('STORNO insoluto eliminato', `${o.athleteName} -€${o.total.toFixed(2)}`);
      },

      addSubscription: (s) => {
        const sub: Subscription = { ...s, id: uid() };
        set({ subscriptions: [...get().subscriptions, sub] });
        get().logAudit('Abbonamento creato', `${s.athleteName} €${s.fee}`);
      },
      updateSubscription: (id, patch) =>
        set({ subscriptions: get().subscriptions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      deleteSubscription: (id) => set({ subscriptions: get().subscriptions.filter((s) => s.id !== id) }),
      paySubscription: (id) => {
        const s = get().subscriptions.find((x) => x.id === id);
        if (!s) return;
        const revenue: RevenueLine = {
          id: uid(),
          source: 'abbonamento',
          description: `Abbonamento - ${s.athleteName}`,
          amount: s.fee,
          at: Date.now(),
          operator: get().currentOperator || 'Operatore',
        };
        set({
          subscriptions: get().subscriptions.map((x) =>
            x.id === id ? { ...x, status: 'pagato', paymentDate: new Date().toISOString() } : x
          ),
          revenueLines: [...get().revenueLines, revenue],
        });
        get().logAudit('Abbonamento pagato', `${s.athleteName} €${s.fee}`);
      },

      setFund: (amount) => set({ fund: amount }),
      addExpense: (e) => {
        const exp: Expense = { ...e, id: uid() };
        set({ expenses: [...get().expenses, exp] });
        get().logAudit('Spesa aggiunta', `${e.description} €${e.amount}`);
      },
      deleteExpense: (id) => set({ expenses: get().expenses.filter((x) => x.id !== id) }),

      voidRevenueLine: (id) => {
        const line = get().revenueLines.find((x) => x.id === id);
        if (!line || line.voided) return;
        set({
          revenueLines: get().revenueLines.map((x) => (x.id === id ? { ...x, voided: true } : x)),
        });
        get().logAudit('STORNO incasso', `${line.description} -€${line.amount}`);
      },

      closeReconciliation: () => {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

        const activeRevenue = get().revenueLines.filter((r) => !r.voided);
        const revenue = activeRevenue.reduce((s, r) => s + r.amount, 0);
        const voidedAmount = get().revenueLines.filter((r) => r.voided).reduce((s, r) => s + r.amount, 0);
        const expenses = get().expenses.reduce((s, e) => s + e.amount, 0);
        const fund = get().fund;

        const closedToday = get().tables.filter((t) => t.closedAt && t.closedAt >= startOfDay && !t.deleted);
        const tavoliTheoretical = closedToday.reduce((s, t) => s + (t.theoreticalCost ?? 0), 0);
        const tavoliReal = activeRevenue.filter((r) => r.source === 'tavolo').reduce((s, r) => s + r.amount, 0);
        const tavoliDiscounts = closedToday.reduce((s, t) => s + t.discountAmount, 0);
        const tavoliRounding = closedToday.reduce((s, t) => s + t.roundingAmount, 0);
        const barReal = activeRevenue.filter((r) => r.source === 'bar' || r.source === 'sospeso').reduce((s, r) => s + r.amount, 0);
        const barDiscounts = closedToday.reduce((s, t) => s + t.barDiscount, 0);
        const barRounding = closedToday.reduce((s, t) => s + t.barRounding, 0);
        const abbonamentiReal = activeRevenue.filter((r) => r.source === 'abbonamento').reduce((s, r) => s + r.amount, 0);

        const nominalToday = tavoliTheoretical;

        const rec: Reconciliation = {
          id: uid(),
          date: dateStr,
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          fund,
          revenue,
          expenses,
          net: revenue - expenses,
          nominalTotalizer: nominalToday,
          cumulativeTotalizer: get().cumulativeTotalizer,
          tavoliTheoretical,
          tavoliReal,
          tavoliDiscounts,
          tavoliRounding,
          barReal,
          barDiscounts,
          barRounding,
          abbonamentiReal,
          storni: voidedAmount,
          expensesList: get().expenses,
          revenueLines: get().revenueLines,
          logs: get().auditLog,
          closedAt: Date.now(),
        };
        set({
          reconciliations: [...get().reconciliations, rec],
          revenueLines: [],
          expenses: [],
          auditLog: [],
          fund: fund + revenue - expenses,
        });
        get().logAudit('Chiusura cassa', dateStr);
        return rec;
      },
      deleteReconciliation: (id) => set({ reconciliations: get().reconciliations.filter((r) => r.id !== id) }),
      deleteAllReconciliations: () => set({ reconciliations: [] }),

      resetMagazzino: () => set({ products: [] }),
      resetAtleti: () => set({ athletes: [] }),
      resetStorici: () => set({ reconciliations: [] }),
      resetAbbonamenti: () => set({ subscriptions: [] }),
      resetSospesi: () => set({ suspendedOrders: [] }),
      resetTotal: () =>
        set({
          tables: DEFAULT_TABLES,
          products: [],
          athletes: [],
          suspendedOrders: [],
          subscriptions: [],
          reconciliations: [],
          revenueLines: [],
          expenses: [],
          auditLog: [],
          fund: 0,
          cumulativeTotalizer: get().cumulativeTotalizer,
        }),

      importState: (s) => set({ ...s }),

      setTableTotalizer: (amount) => {
        set({ cumulativeTotalizer: amount });
        get().logAudit('Totalizzatore Tavoli modificato manualmente', `Nuovo valore: €${amount.toFixed(2)}`);
      },

      adjustPlayerPayment: (athleteId, newPaidAmount, reason) => {
        const athlete = get().athletes.find((a) => a.id === athleteId);
        if (!athlete) return;
        
        const currentDebt = athlete.debt || 0;
        const difference = currentDebt - newPaidAmount;
        
        if (difference > 0) {
          set({
            athletes: get().athletes.map((a) =>
              a.id === athleteId ? { ...a, debt: Math.max(0, newPaidAmount) } : a
            ),
          });
          get().logAudit(
            'Pagamento atleta rettificato',
            `${athlete.name}: pagato €${newPaidAmount.toFixed(2)} (differenza €${difference.toFixed(2)} in insoluto). Motivo: ${reason}`
          );
        } else if (difference < 0) {
          set({
            athletes: get().athletes.map((a) =>
              a.id === athleteId ? { ...a, debt: 0 } : a
            ),
          });
          get().logAudit(
            'Pagamento atleta rettificato (eccedenza)',
            `${athlete.name}: pagato €${newPaidAmount.toFixed(2)} (eccedenza €${Math.abs(difference).toFixed(2)}). Motivo: ${reason}`
          );
        } else {
          get().logAudit('Pagamento atleta confermato', `${athlete.name}: €${newPaidAmount.toFixed(2)}`);
        }
      },

      rectifyClosedTablePayment: (tableId, athleteId, newPaidAmount, reason) => {
        const details = get().closedTableDetails[tableId];
        if (!details) return;
        const original = details.find((d) => d.athleteId === athleteId);
        if (!original) return;
        const difference = Math.round((original.amount - newPaidAmount) * 100) / 100;
        if (difference <= 0) return;
        const athlete = get().athletes.find((a) => a.id === athleteId);
        if (!athlete) return;
        set({
          athletes: get().athletes.map((a) =>
            a.id === athleteId ? { ...a, debt: Math.round(((a.debt || 0) + difference) * 100) / 100 } : a
          ),
          closedTableDetails: {
            ...get().closedTableDetails,
            [tableId]: details.map((d) =>
              d.athleteId === athleteId ? { ...d, amount: newPaidAmount, paymentMode: 'insoluto' } : d
            ),
          },
        });
        const storno: RevenueLine = {
          id: uid(),
          source: 'tavolo',
          description: `STORNO rettifica tavolo ${tableId} - ${athlete.name}`,
          amount: difference,
          at: Date.now(),
          voided: true,
          operator: get().currentOperator || 'Admin',
        };
        set({ revenueLines: [...get().revenueLines, storno] });
        get().logAudit(
          'Rettifica pagamento tavolo chiuso',
          `${athlete.name}: da €${original.amount.toFixed(2)} a €${newPaidAmount.toFixed(2)}. Insoluto: €${difference.toFixed(2)}. Motivo: ${reason}`
        );
      },
    }),
    { name: 'cassa-biliardo' }
  )
);