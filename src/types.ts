export type Player = {
  athleteId: string;
  name: string;
  isSubscribed: boolean;
  items: BarItem[];
  pendingTableDebt?: number;
  joinTime?: number;
};

export type BarItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
};

export type PauseLog = {
  at: number;
  durationMs: number;
};

export type TableStatus = 'libero' | 'occupato';

export type Table = {
  id: number;
  name: string;
  status: TableStatus;
  players: Player[];
  startTime: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  pauseLogs: PauseLog[];
  closedAt: number | null;
  operator: string | null;
  lastMatchCost: number | null;
  lastMatchPlayers: string[];
  lastMatchAt: number | null;
  finalCost: number | null;
  noloRevenue: number | null;
  barRevenue: number | null;
  discountsApplied: number;
  barDiscountApplied: number;
  roundingApplied: number;
  deleted?: boolean;
  deletedAt?: number | null;
  theoreticalCost: number | null;
  discountPercent: number;
  discountAmount: number;
  roundingAmount: number;
  finalAmount: number | null;
  barTheoretical: number;
  barDiscount: number;
  barRounding: number;
  barFinal: number;
  noloAlreadyCounted: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
};

export type Athlete = {
  id: string;
  name: string;
  debt: number;
  documentType: DocumentType;
  socioType: SocioType;
  phone: string;
};

export type DocumentType = 'Patente' | 'Carta d\'identità' | 'Passaporto' | 'Nessuno';
export type SocioType = 'Socio Ordinario' | 'Dilettante' | 'Atleta';

export type SuspendedOrder = {
  id: string;
  athleteId: string;
  athleteName: string;
  items: BarItem[];
  total: number;
  createdAt: number;
  status: 'sospeso' | 'insoluto';
  voided?: boolean;
  source?: 'tavolo' | 'bar';
};

export type Subscription = {
  id: string;
  athleteId: string;
  athleteName: string;
  fee: number;
  startDate: string;
  endDate: string;
  status: 'attivo' | 'scaduto' | 'pagato';
  paymentDate: string | null;
};

export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  at: number;
};

export type RevenueLine = {
  id: string;
  source: 'tavolo' | 'sospeso' | 'abbonamento' | 'bar' | 'insoluto_saldato';
  description: string;
  amount: number;
  at: number;
  voided?: boolean;
  operator?: string;
};

export type AuditEntry = {
  at: number;
  action: string;
  value: string;
  operator: string;
  deleted?: boolean;
  deletedAt?: number | null;
};

export type Reconciliation = {
  id: string;
  date: string;
  year: number;
  month: number;
  fund: number;
  revenue: number;
  expenses: number;
  net: number;
  nominalTotalizer: number;
  cumulativeTotalizer: number;
  tavoliTheoretical: number;
  tavoliReal: number;
  tavoliDiscounts: number;
  tavoliRounding: number;
  barReal: number;
  barDiscounts: number;
  barRounding: number;
  abbonamentiReal: number;
  storni: number;
  expensesList: Expense[];
  revenueLines: RevenueLine[];
  logs: AuditEntry[];
  closedAt: number;
};

export type Settings = {
  ownerPassword: string;
  baseRate: number;
  tableMax: number;
  email: string;
  generalTotalizerOverride: number | null;
  generalTotalizerOverrideDate: string | null;
};

export type PageKey =
  | 'tavoli'
  | 'pos'
  | 'magazzino'
  | 'atleti'
  | 'abbonamenti'
  | 'cassa'
  | 'statistiche'
  | 'storico'
  | 'supervisione'
  | 'insoluti'
  | 'rettifiche'
  | 'impostazioni';

export type DialogResult = { proceed: boolean; discountPct?: number; rounding?: number };

export type PlayerCheckout = {
  athleteId: string;
  name: string;
  noloTheoretical: number;
  noloDiscountPct: number;
  noloRounding: number;
  barTheoretical: number;
  barDiscountPct: number;
  barRounding: number;
  paymentMode: 'pagato' | 'sospeso' | 'insoluto';
};

export type ClosedTableEntry = {
  id: string;
  tableId: number;
  tableName: string;
  openTime: number;
  closeTime: number;
  players: {
    athleteId: string;
    name: string;
    amount: number;
    paymentMode: 'pagato' | 'sospeso' | 'insoluto';
  }[];
  total: number;
};

// NUOVO TIPO: Debiti pendenti (sospesi e insoluti)
export type PendingDebt = {
  id: string;
  athleteId: string;
  athleteName: string;
  amount: number;
  type: 'sospeso' | 'insoluto';
  source: 'tavolo' | 'rettifica';
  tableId?: number;
  tableName?: string;
  createdAt: number;
  reason?: string;
  paidAt?: number | null;
};