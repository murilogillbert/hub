export const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export const formatPercent = (value: number): string =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCode = (code: string): string =>
  code.replace(/(.{4})/g, '$1-').replace(/-$/, '');

export const generateOrderCode = (): string => {
  const segment = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${segment()}${segment()}${segment()}${segment()}`;
};
