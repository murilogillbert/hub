const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const maskCpf = (value: string) =>
  onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const maskCnpj = (value: string) =>
  onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');

export const maskPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const maskCoordinate = (value: string) =>
  value.replace(',', '.').replace(/[^\d.-]/g, '').replace(/(?!^)-/g, '');

export const formatMoneyInput = (value: number | string) => {
  const number = typeof value === 'number' ? value : parseMoneyInput(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const parseMoneyInput = (value: string) => {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(normalized) || 0;
};

export const isValidCpf = (value: string) => onlyDigits(value).length === 11;
export const isValidCnpj = (value: string) => onlyDigits(value).length === 14;
export const isValidPhone = (value: string) => {
  const len = onlyDigits(value).length;
  return len === 10 || len === 11;
};

export const coordinateError = (
  value: string,
  type: 'lat' | 'lng',
  required = false,
) => {
  if (!value.trim()) return required ? 'Obrigatório.' : undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Número inválido.';
  if (type === 'lat' && (number < -90 || number > 90))
    return 'Latitude deve estar entre -90 e 90.';
  if (type === 'lng' && (number < -180 || number > 180))
    return 'Longitude deve estar entre -180 e 180.';
  return undefined;
};
