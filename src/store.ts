import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Table, Product, Athlete, SuspendedOrder, Subscription,
  Reconciliation, Settings, AuditEntry, RevenueLine, BarItem, Expense, PlayerCheckout, ClosedTableEntry, PendingDebt,
} from '@/types';
import { fmtEuro } from '@/lib/utils';

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
  expenses: Expense[];
  fund: number;
  cumulativeTotalizer: number;
  currentOperator: string;
  isAdminUnlocked: boolean;
  isOwnerUnlocked: boolean;
  lastActivity: number;
  closedTableDetails: ClosedTableEntry[];
  pendingDebts: PendingDebt[];

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
  rectifyClosedTablePayment: (entryId: string, athleteId: string, newPaidAmount: number, newPaymentMode: 'pagato' | 'sospeso' | 'insoluto', reason: string) => void;
  batchRectifyPlayers: (entryId: string, athleteIds: string[], newPaymentMode: 'pagato' | 'sospeso' | 'insoluto', reason: string) => void;
  logAudit: (action: string, value: string) => void;

  addPendingDebt: (debt: Omit<PendingDebt, 'id' | 'createdAt'>) => void;
  assignDebtToTable: (debtId: string, tableId: number) => void;
  assignDebtToAthlete: (debtId: string) => void;
  markDebtAsPaid: (debtId: string) => void;
  deletePendingDebt: (debtId: string) => void;
  convertSuspendedToInsoluto: () => void;
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

const getPlayerHours = (player: { joinTime?: number }, table: Table, now: number) => {
  const joinTime = player.joinTime ?? table.startTime ?? now;
  const elapsedMs = (table.pausedAt ?? now) - joinTime;
  const pauseAfterJoin = table.pauseLogs
    .filter(log => log.at >= joinTime)
    .reduce((sum, log) => sum + log.durationMs, 0);
  return Math.max(0, (elapsedMs - pauseAfterJoin) / 3600000);
};

const hasActiveSubscription = (athleteId: string, subscriptions: Subscription[], now: number): boolean => {
  if (!athleteId || !subscriptions) return false;
  const today = new Date(now);
  return subscriptions.some(sub => 
    sub.athleteId === athleteId && 
    sub.status === 'pagato' &&
    new Date(sub.startDate) <= today &&
    new Date(sub.endDate) >= today
  );
};

const calcPlayerNolo = (player: { isSubscribed: boolean; joinTime?: number; athleteId?: string }, table: Table, now: number, baseRate: number, tableMax: number, subscriptions: Subscription[]) => {
  if (player.isSubscribed) return 0;
  if (player.athleteId && hasActiveSubscription(player.athleteId, subscriptions, now)) {
    return 0;
  }
  const hours = getPlayerHours(player, table, now);
  const n = table.players.length;
  const subscribedCount = table.players.filter(p => {
    if (p.isSubscribed) return true;
    if (p.athleteId && hasActiveSubscription(p.athleteId, subscriptions, now)) return true;
    return false;
  }).length;
  const noloPaying = n - subscribedCount;
  if (n <= 2) {
    return baseRate * hours;
  } else {
    return (tableMax / Math.max(1, noloPaying)) * hours;
  }
};

const recordTableClose = (
  table: Table,
  checkouts: PlayerCheckout[],
  perPlayer: number[],
  now: number
): ClosedTableEntry => {
  return {
    id: uid(),
    tableId: table.id,
    tableName: table.name,
    openTime: table.startTime ?? now,
    closeTime: now,
    players: checkouts.map((c, i) => ({
      athleteId: c.athleteId,
      name: c.name,
      amount: perPlayer[i],
      paymentMode: c.paymentMode,
    })),
    total: perPlayer.reduce((s, a) => s + a, 0),
  };
};

const getClosedTableDetails = (state: StoreState): ClosedTableEntry[] => {
  const ctd = state.closedTableDetails;
  if (Array.isArray(ctd)) return ctd;
  if (ctd && typeof ctd === 'object') return Object.values(ctd as any);
  return [];
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
      closedTableDetails: [],
      pendingDebts: [],

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
        const subscriptions = get().subscriptions;

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

          const isSub = p.isSubscribed || hasActiveSubscription(p.athleteId, subscriptions, now);

          const pendingDebt = get().pendingDebts
            .filter((d) => d.athleteId === p.athleteId && !d.paidAt)
            .reduce((sum, d) => sum + d.amount, 0);

          return {
            ...p,
            isSubscribed: isSub,
            items: [...(p.items || []), ...playerBarItems],
            pendingTableDebt: pendingFor(p.athleteId) + pendingDebt,
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
        const subscriptions = get().subscriptions;
        const pendingTableDebt = get().suspendedOrders
          .filter((o) => o.athleteId === p.athleteId && o.source === 'tavolo' && o.status === 'sospeso')
          .reduce((s, o) => s + o.total, 0);
        
        const isSub = p.isSubscribed || hasActiveSubscription(p.athleteId, subscriptions, now);
        
        const pendingDebt = get().pendingDebts
          .filter((d) => d.athleteId === p.athleteId && !d.paidAt)
          .reduce((sum, d) => sum + d.amount, 0);
        
        set({
          tables: get().tables.map((t) =>
            t.id === tableId
              ? { ...t, players: [...t.players, { ...p, isSubscribed: isSub, items: [], pendingTableDebt: pendingTableDebt + pendingDebt, joinTime: now }] }
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
        const subscriptions = get().subscriptions;

        const playerNoloMap = new Map<string, number>();
        let noloTheoreticalTotal = 0;
        t.players.forEach((p) => {
          const nolo = calcPlayerNolo(p, t, now, baseRate, tableMax, subscriptions);
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
        const newPendingDebts: PendingDebt[] = [];

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
            newPendingDebts.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              amount: playerFinal,
              type: 'insoluto',
              source: 'tavolo',
              tableId: t.id,
              tableName: t.name,
              createdAt: now,
              reason: `Chiusura tavolo ${t.name} (${mode})`,
            });
            get().logAudit('Insoluto da chiusura tavolo', `${c.name} €${playerFinal.toFixed(2)}`);
          } else if (c.paymentMode === 'sospeso' && playerFinal > 0) {
            newPendingDebts.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              amount: playerFinal,
              type: 'sospeso',
              source: 'tavolo',
              tableId: t.id,
              tableName: t.name,
              createdAt: now,
              reason: `Chiusura tavolo ${t.name} (${mode})`,
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

        const entry = recordTableClose(t, checkouts, perPlayer, now);
        const currentDetails = getClosedTableDetails(get());

        set({
          closedTableDetails: [...currentDetails, entry],
          pendingDebts: [...get().pendingDebts, ...newPendingDebts],
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
        const subscriptions = get().subscriptions;

        const exitingIds = new Set(checkouts.map((c) => c.athleteId));
        const exitingPlayers = t.players.filter((p) => exitingIds.has(p.athleteId));
        const remainingPlayers = t.players.filter((p) => !exitingIds.has(p.athleteId));

        const playerNoloMap = new Map<string, number>();
        let exitingNoloTheoretical = 0;
        exitingPlayers.forEach((p) => {
          const nolo = calcPlayerNolo(p, t, now, baseRate, tableMax, subscriptions);
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
        const newPendingDebts: PendingDebt[] = [];

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
            newPendingDebts.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              amount: playerFinal,
              type: 'insoluto',
              source: 'tavolo',
              tableId: t.id,
              tableName: t.name,
              createdAt: now,
              reason: `Uscita parziale tavolo ${t.name}`,
            });
            get().logAudit('Insoluto da uscita parziale', `${c.name} €${playerFinal.toFixed(2)}`);
          } else if (c.paymentMode === 'sospeso' && playerFinal > 0) {
            newPendingDebts.push({
              id: uid(),
              athleteId: c.athleteId,
              athleteName: c.name,
              amount: playerFinal,
              type: 'sospeso',
              source: 'tavolo',
              tableId: t.id,
              tableName: t.name,
              createdAt: now,
              reason: `Uscita parziale tavolo ${t.name}`,
            });
            get().logAudit('Sospeso Nolo (rotazione)', `${c.name} €${playerFinal.toFixed(2)}`);
          }
          totalFinal += playerFinal;
        });

        const totalDiscount = totalNoloDiscount + totalBarDiscount;
        const totalRounding = totalNoloRounding + totalBarRounding;

        const entry = recordTableClose(t, checkouts, perPlayer, now);
        const currentDetails = getClosedTableDetails(get());

        set({
          closedTableDetails: [...currentDetails, entry],
          pendingDebts: [...get().pendingDebts, ...newPendingDebts],
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
        
        let cost = 0;
        t.players.forEach((p) => {
          cost += calcPlayerNolo(p, t, now, baseRate, tableMax, get().subscriptions);
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
        
        // Crea anche un pendingDebt per mostrarlo nella pagina Insoluti
        const newPendingDebt: PendingDebt = {
          id: uid(),
          athleteId: o.athleteId,
          athleteName: o.athleteName,
          amount: o.total,
          type: 'insoluto',
          source: o.source || 'bar',
          createdAt: Date.now(),
          reason: `Ordine bar insoluto: ${o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}`,
        };
        
        set({
          suspendedOrders: get().suspendedOrders.map((x) =>
            x.id === id ? { ...x, status: 'insoluto' } : x
          ),
          athletes: get().athletes.map((a) =>
            a.id === o.athleteId ? { ...a, debt: a.debt + o.total } : a
          ),
          pendingDebts: [...get().pendingDebts, newPendingDebt],
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

        const activeRevenue = get().revenueLines.filter((r) => !r.voided);
        const revenue = activeRevenue.reduce((s, r) => s + r.amount, 0);
        const voidedAmount = get().revenueLines.filter((r) => r.voided).reduce((s, r) => s + r.amount, 0);
        const expenses = get().expenses.reduce((s, e) => s + e.amount, 0);
        const fund = get().fund;

        const tavoliTheoretical = activeRevenue.filter((r) => r.source === 'tavolo').reduce((s, r) => s + r.amount, 0);
        const tavoliReal = activeRevenue.filter((r) => r.source === 'tavolo').reduce((s, r) => s + r.amount, 0);
        const tavoliDiscounts = 0;
        const tavoliRounding = 0;
        const barReal = activeRevenue.filter((r) => r.source === 'bar' || r.source === 'sospeso').reduce((s, r) => s + r.amount, 0);
        const barDiscounts = 0;
        const barRounding = 0;
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

        const now = Date.now();
        const updatedDebts = get().pendingDebts.map((d) =>
          d.type === 'sospeso' && !d.paidAt ? { ...d, type: 'insoluto' as const } : d
        );

        set({
          reconciliations: [...get().reconciliations, rec],
          revenueLines: [],
          expenses: [],
          auditLog: [],
          fund: fund + revenue - expenses,
          closedTableDetails: [],
          pendingDebts: updatedDebts,
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
          closedTableDetails: [],
          pendingDebts: [],
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

      rectifyClosedTablePayment: (entryId, athleteId, newPaidAmount, newPaymentMode, reason) => {
        const entries = getClosedTableDetails(get());
        const entryIndex = entries.findIndex((e) => e.id === entryId);
        if (entryIndex === -1) return;
        const entry = entries[entryIndex];
        const original = entry.players.find((p) => p.athleteId === athleteId);
        if (!original) return;
        const athlete = get().athletes.find((a) => a.id === athleteId);
        if (!athlete) return;
        
        const difference = Math.round((newPaidAmount - original.amount) * 100) / 100;
        
        const updatedPlayers = entry.players.map((p) =>
          p.athleteId === athleteId ? { ...p, amount: newPaidAmount, paymentMode: newPaymentMode } : p
        );
        const newTotal = Math.round(updatedPlayers.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
        
        const updatedEntries = [...entries];
        updatedEntries[entryIndex] = {
          ...entry,
          players: updatedPlayers,
          total: newTotal,
        };
        
        let updatedDebts = [...get().pendingDebts];
        
        if (newPaymentMode === 'insoluto' && newPaidAmount < original.amount) {
          const debtIncrease = Math.round((original.amount - newPaidAmount) * 100) / 100;
          const existingDebtIndex = updatedDebts.findIndex(
            (d) => d.athleteId === athleteId && d.type === 'insoluto' && !d.paidAt && d.tableId === entry.tableId
          );
          if (existingDebtIndex !== -1) {
            updatedDebts[existingDebtIndex] = {
              ...updatedDebts[existingDebtIndex],
              amount: Math.round((updatedDebts[existingDebtIndex].amount + debtIncrease) * 100) / 100,
            };
          } else {
            updatedDebts.push({
              id: uid(),
              athleteId: athleteId,
              athleteName: athlete.name,
              amount: debtIncrease,
              type: 'insoluto',
              source: 'rettifica',
              tableId: entry.tableId,
              tableName: entry.tableName,
              createdAt: Date.now(),
              reason: reason,
            });
          }
          set({
            athletes: get().athletes.map((a) =>
              a.id === athleteId ? { ...a, debt: Math.round(((a.debt || 0) + debtIncrease) * 100) / 100 } : a
            ),
            closedTableDetails: updatedEntries,
            pendingDebts: updatedDebts,
          });
          get().logAudit(
            'Rettifica: riduzione importo',
            `${athlete.name}: da €${original.amount.toFixed(2)} a €${newPaidAmount.toFixed(2)}. Insoluto: €${debtIncrease.toFixed(2)}. Motivo: ${reason}`
          );
        } else if (newPaymentMode === 'pagato' && newPaidAmount > original.amount) {
          const debtReduction = Math.min(athlete.debt || 0, difference);
          set({
            athletes: get().athletes.map((a) =>
              a.id === athleteId ? { ...a, debt: Math.max(0, Math.round(((a.debt || 0) - debtReduction) * 100) / 100) } : a
            ),
            closedTableDetails: updatedEntries,
          });
          get().logAudit(
            'Rettifica: aumento importo',
            `${athlete.name}: da €${original.amount.toFixed(2)} a €${newPaidAmount.toFixed(2)}. Ridotto debito: €${debtReduction.toFixed(2)}. Motivo: ${reason}`
          );
        } else if (newPaymentMode === 'sospeso') {
          const existingDebtIndex = updatedDebts.findIndex(
            (d) => d.athleteId === athleteId && d.type === 'sospeso' && !d.paidAt && d.tableId === entry.tableId
          );
          if (existingDebtIndex !== -1) {
            updatedDebts[existingDebtIndex] = {
              ...updatedDebts[existingDebtIndex],
              amount: newPaidAmount,
            };
          } else {
            updatedDebts.push({
              id: uid(),
              athleteId: athleteId,
              athleteName: athlete.name,
              amount: newPaidAmount,
              type: 'sospeso',
              source: 'rettifica',
              tableId: entry.tableId,
              tableName: entry.tableName,
              createdAt: Date.now(),
              reason: reason,
            });
          }
          set({ closedTableDetails: updatedEntries, pendingDebts: updatedDebts });
          get().logAudit(
            'Rettifica: messo in sospeso',
            `${athlete.name}: €${newPaidAmount.toFixed(2)}. Motivo: ${reason}`
          );
        } else {
          set({ closedTableDetails: updatedEntries });
          get().logAudit(
            'Rettifica pagamento',
            `${athlete.name}: €${newPaidAmount.toFixed(2)} (${newPaymentMode}). Motivo: ${reason}`
          );
        }
        
        if (difference !== 0) {
          const revenueLine: RevenueLine = {
            id: uid(),
            source: 'tavolo',
            description: `RETTIFICA ${entry.tableName} - ${athlete.name}: ${difference > 0 ? '+' : ''}${fmtEuro(difference)}`,
            amount: Math.abs(difference),
            at: Date.now(),
            voided: difference < 0,
            operator: get().currentOperator || 'Admin',
          };
          set({ revenueLines: [...get().revenueLines, revenueLine] });
        }
      },

      batchRectifyPlayers: (entryId, athleteIds, newPaymentMode, reason) => {
        const entries = getClosedTableDetails(get());
        const entryIndex = entries.findIndex((e) => e.id === entryId);
        if (entryIndex === -1) return;
        const entry = entries[entryIndex];
        const idSet = new Set(athleteIds);
        
        const updatedPlayers = entry.players.map((p) => {
          if (!idSet.has(p.athleteId)) return p;
          if (newPaymentMode === 'insoluto') {
            return { ...p, amount: 0, paymentMode: 'insoluto' };
          }
          return { ...p, paymentMode: newPaymentMode };
        });
        
        const newTotal = Math.round(updatedPlayers.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
        
        const updatedEntries = [...entries];
        updatedEntries[entryIndex] = {
          ...entry,
          players: updatedPlayers,
          total: newTotal,
        };
        
        let updatedDebts = [...get().pendingDebts];
        
        if (newPaymentMode === 'insoluto') {
          const affectedPlayers = entry.players.filter((p) => idSet.has(p.athleteId));
          let athletesUpdate = [...get().athletes];
          affectedPlayers.forEach((p) => {
            if (p.amount > 0) {
              const idx = athletesUpdate.findIndex((a) => a.id === p.athleteId);
              if (idx !== -1) {
                athletesUpdate[idx] = { 
                  ...athletesUpdate[idx], 
                  debt: Math.round(((athletesUpdate[idx].debt || 0) + p.amount) * 100) / 100 
                };
              }
              updatedDebts.push({
                id: uid(),
                athleteId: p.athleteId,
                athleteName: p.name,
                amount: p.amount,
                type: 'insoluto',
                source: 'rettifica',
                tableId: entry.tableId,
                tableName: entry.tableName,
                createdAt: Date.now(),
                reason: `Rettifica batch: ${reason}`,
              });
            }
          });
          set({ athletes: athletesUpdate, closedTableDetails: updatedEntries, pendingDebts: updatedDebts });
        } else if (newPaymentMode === 'sospeso') {
          const affectedPlayers = entry.players.filter((p) => idSet.has(p.athleteId));
          affectedPlayers.forEach((p) => {
            if (p.amount > 0) {
              updatedDebts.push({
                id: uid(),
                athleteId: p.athleteId,
                athleteName: p.name,
                amount: p.amount,
                type: 'sospeso',
                source: 'rettifica',
                tableId: entry.tableId,
                tableName: entry.tableName,
                createdAt: Date.now(),
                reason: `Rettifica batch: ${reason}`,
              });
            }
          });
          set({ closedTableDetails: updatedEntries, pendingDebts: updatedDebts });
        } else {
          set({ closedTableDetails: updatedEntries });
        }
        
        const names = entry.players.filter((p) => idSet.has(p.athleteId)).map((p) => p.name).join(', ');
        get().logAudit(
          `Rettifica batch: ${newPaymentMode}`,
          `${names}. Motivo: ${reason}`
        );
      },

      addPendingDebt: (debt) => {
        const newDebt: PendingDebt = {
          ...debt,
          id: uid(),
          createdAt: Date.now(),
        };
        set({ pendingDebts: [...get().pendingDebts, newDebt] });
        get().logAudit('Debito aggiunto', `${debt.athleteName} €${debt.amount.toFixed(2)} (${debt.type})`);
      },

      assignDebtToTable: (debtId, tableId) => {
        const debt = get().pendingDebts.find((d) => d.id === debtId);
        if (!debt || debt.paidAt) return;
        
        const table = get().tables.find((t) => t.id === tableId && t.status === 'occupato');
        if (!table) {
          alert('Tavolo non trovato o non occupato');
          return;
        }
        
        const playerIndex = table.players.findIndex((p) => p.athleteId === debt.athleteId);
        if (playerIndex === -1) {
          alert('Il socio non è presente in questo tavolo');
          return;
        }
        
        const updatedTables = get().tables.map((t) => {
          if (t.id !== tableId) return t;
          const updatedPlayers = [...t.players];
          updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            pendingTableDebt: (updatedPlayers[playerIndex].pendingTableDebt || 0) + debt.amount,
          };
          return { ...t, players: updatedPlayers };
        });
        
        const updatedDebts = get().pendingDebts.map((d) =>
          d.id === debtId ? { ...d, paidAt: Date.now() } : d
        );
        
        set({ tables: updatedTables, pendingDebts: updatedDebts });
        get().logAudit('Debito assegnato a tavolo', `${debt.athleteName} €${debt.amount.toFixed(2)} → Tavolo ${tableId}`);
      },

      assignDebtToAthlete: (debtId) => {
        const debt = get().pendingDebts.find((d) => d.id === debtId);
        if (!debt || debt.paidAt) return;
        
        const updatedAthletes = get().athletes.map((a) =>
          a.id === debt.athleteId ? { ...a, debt: Math.round((a.debt + debt.amount) * 100) / 100 } : a
        );
        
        const updatedDebts = get().pendingDebts.map((d) =>
          d.id === debtId ? { ...d, paidAt: Date.now() } : d
        );
        
        set({ athletes: updatedAthletes, pendingDebts: updatedDebts });
        get().logAudit('Debito assegnato a socio', `${debt.athleteName} €${debt.amount.toFixed(2)} → Debito personale`);
      },

      markDebtAsPaid: (debtId) => {
        const debt = get().pendingDebts.find((d) => d.id === debtId);
        if (!debt || debt.paidAt) return;
        
        const revenueLine: RevenueLine = {
          id: uid(),
          source: debt.type === 'sospeso' ? 'sospeso' : 'insoluto_saldato',
          description: `${debt.type === 'sospeso' ? 'Sospeso' : 'Insoluto'} saldato - ${debt.athleteName}${debt.tableName ? ` (${debt.tableName})` : ''}`,
          amount: debt.amount,
          at: Date.now(),
          operator: get().currentOperator || 'Operatore',
        };
        
        const updatedDebts = get().pendingDebts.map((d) =>
          d.id === debtId ? { ...d, paidAt: Date.now() } : d
        );
        
        set({
          revenueLines: [...get().revenueLines, revenueLine],
          pendingDebts: updatedDebts,
        });
        get().logAudit('Debito saldato', `${debt.athleteName} €${debt.amount.toFixed(2)} (${debt.type})`);
      },

      deletePendingDebt: (debtId) => {
        const debt = get().pendingDebts.find((d) => d.id === debtId);
        if (!debt) return;
        if (debt.type === 'insoluto') {
          alert('Non è possibile eliminare un insoluto. Può essere solo saldato.');
          return;
        }
        set({ pendingDebts: get().pendingDebts.filter((d) => d.id !== debtId) });
        get().logAudit('Debito sospeso eliminato', `${debt.athleteName} €${debt.amount.toFixed(2)}`);
      },

      convertSuspendedToInsoluto: () => {
        const now = Date.now();
        const updatedDebts = get().pendingDebts.map((d) =>
          d.type === 'sospeso' && !d.paidAt ? { ...d, type: 'insoluto' as const } : d
        );
        set({ pendingDebts: updatedDebts });
        get().logAudit('Sospesi convertiti in insoluti', `${updatedDebts.filter((d) => d.type === 'insoluto').length} debiti`);
      },
    }),
    { name: 'cassa-biliardo' }
  )
);