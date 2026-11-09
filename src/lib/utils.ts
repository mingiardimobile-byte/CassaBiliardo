export const fmtEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);

export const fmtTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const sortByNameIT = <T extends { name: string }>(list: T[]): T[] =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'it'));

export const sortByCategoryThenNameIT = <T extends { category: string; name: string }>(list: T[]): T[] =>
  [...list].sort(
    (a, b) =>
      a.category.localeCompare(b.category, 'it') || a.name.localeCompare(b.name, 'it')
  );

export const downloadJSON = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (filename: string, text: string, type = 'text/plain') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
