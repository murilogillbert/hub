import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface CartLine {
  productId: string;
  title: string;
  category: string;
  imageUrl: string;
  price: number;
  cashbackPercent: number;
  partnerId: string;
  partnerName: string;
  quantity: number;
}

interface CartContextValue {
  items: CartLine[];
  count: number;
  subtotal: number;
  cashbackTotal: number;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'odh.cart';
const CartContext = createContext<CartContextValue | null>(null);

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback(
    (line: Omit<CartLine, 'quantity'>, quantity = 1) =>
      setItems((cur) => {
        const found = cur.find((l) => l.productId === line.productId);
        if (found)
          return cur.map((l) =>
            l.productId === line.productId
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          );
        return [...cur, { ...line, quantity }];
      }),
    [],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      setItems((cur) =>
        quantity <= 0
          ? cur.filter((l) => l.productId !== productId)
          : cur.map((l) =>
              l.productId === productId ? { ...l, quantity } : l,
            ),
      ),
    [],
  );

  const remove = useCallback(
    (productId: string) =>
      setItems((cur) => cur.filter((l) => l.productId !== productId)),
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((s, l) => s + l.price * l.quantity, 0);
    const cashbackTotal = items.reduce(
      (s, l) => s + (l.price * l.quantity * l.cashbackPercent) / 100,
      0,
    );
    const count = items.reduce((s, l) => s + l.quantity, 0);
    return {
      items,
      count,
      subtotal,
      cashbackTotal,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [items, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
