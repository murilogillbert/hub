import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { User, UserRole } from '@shared/types';
import { authApi } from '@shared/api/endpoints';
import { setUnauthorizedHandler, tokenStore } from '@shared/api/client';

export interface RegisterClientInput {
  name: string;
  email: string;
  password: string;
  cpf?: string;
  phone?: string;
}
export interface RegisterPartnerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  storeName: string;
  segment: string;
}

interface AuthContextValue {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterClientInput) => Promise<User>;
  registerPartner: (body: RegisterPartnerInput) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

/** Rota inicial de cada papel após autenticar. */
export function routeForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'partner':
      return '/parceiro/catalogo';
    case 'client':
      return '/';
    default:
      return '/login';
  }
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUserState(null);
    });
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUserState)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStore.set(res.token, res.refreshToken);
    setUserState(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (body: RegisterClientInput) => {
    const res = await authApi.register(body);
    tokenStore.set(res.token, res.refreshToken);
    setUserState(res.user);
    return res.user;
  }, []);

  const registerPartner = useCallback(async (body: RegisterPartnerInput) => {
    const res = await authApi.registerPartner(body);
    tokenStore.set(res.token, res.refreshToken);
    setUserState(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? 'guest',
      isAuthenticated: user !== null,
      loading,
      login,
      register,
      registerPartner,
      logout,
      setUser: setUserState,
    }),
    [user, loading, login, register, registerPartner, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
