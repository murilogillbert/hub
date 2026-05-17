import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { Modal } from '@shared/components/Modal/Modal';
import { formatCurrency } from '@shared/utils/formatters';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { coordinateError, formatMoneyInput, isValidCnpj, isValidPhone, maskCnpj, maskCoordinate, maskPhone, parseMoneyInput } from '@shared/utils/masks';
import { adminApi } from '@shared/api/endpoints';
import { User, Partner } from '@shared/types';
import './AdminPages.css';

type Role = 'client' | 'partner' | 'admin';

interface EditState {
  id: string;
  isNew: boolean;
  password: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  cashbackBalance: number;
  partnerId: string;
  // dados do parceiro vinculado (F4)
  pCnpj: string;
  pCity: string;
  pState: string;
  pLat: number;
  pLng: number;
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users', query, page],
    queryFn: () => adminApi.users({ q: query || undefined, page, pageSize: 20 }),
  });
  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => adminApi.partners({ page: 1, pageSize: 100 }),
  });
  const users = usersQuery.data?.items ?? [];
  const usersPage = usersQuery.data;
  const partners = partnersQuery.data?.items ?? [];

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (e.isNew) {
        await adminApi.createUser({
          name: e.name,
          email: e.email,
          password: e.password,
          phone: e.phone || undefined,
          role: e.role,
          cashbackBalance: Number(e.cashbackBalance) || 0,
          partnerId: e.role === 'partner' ? e.partnerId || null : null,
        });
        return;
      }
      await adminApi.updateUser(e.id, {
        name: e.name,
        email: e.email,
        phone: e.phone || undefined,
        role: e.role,
        cashbackBalance: Number(e.cashbackBalance) || 0,
        partnerId: e.role === 'partner' ? e.partnerId || null : null,
      });
      // F4: edita também os dados do parceiro vinculado.
      if (e.role === 'partner' && e.partnerId) {
        const p = partners.find((x) => x.id === e.partnerId);
        if (p) {
          await adminApi.updatePartner(p.id, {
            name: p.name,
            segment: p.segment,
            logoUrl: p.logoUrl,
            feePercent: p.feePercent,
            active: p.active,
            cnpj: e.pCnpj,
            city: e.pCity,
            state: e.pState,
            lat: Number(e.pLat) || 0,
            lng: Number(e.pLng) || 0,
          });
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      setEdit(null);
      setError(null);
      toast.success(vars.isNew ? 'Usuário criado.' : 'Usuário salvo.');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Falha ao salvar.';
      setError(message);
      toast.error(message);
    },
  });

  const openEdit = (u: User) => {
    const p: Partner | undefined = u.partnerId
      ? partners.find((x) => x.id === u.partnerId)
      : undefined;
    setError(null);
    setEdit({
      id: u.id,
      isNew: false,
      password: '',
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      role: (u.role as Role) ?? 'client',
      cashbackBalance: u.cashbackBalance,
      partnerId: u.partnerId ?? '',
      pCnpj: p?.cnpj ?? '',
      pCity: p?.city ?? '',
      pState: p?.state ?? '',
      pLat: p?.lat ?? 0,
      pLng: p?.lng ?? 0,
    });
  };

  const openCreate = () => {
    setError(null);
    setEdit({
      id: '',
      isNew: true,
      password: '',
      name: '',
      email: '',
      phone: '',
      role: 'client',
      cashbackBalance: 0,
      partnerId: '',
      pCnpj: '',
      pCity: '',
      pState: '',
      pLat: 0,
      pLng: 0,
    });
  };

  const set = <K extends keyof EditState>(k: K, v: EditState[K]) =>
    setEdit((e) => (e ? { ...e, [k]: v } : e));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (edit?.phone && !isValidPhone(edit.phone)) {
      setError('Telefone incompleto.');
      return;
    }
    if (edit?.pCnpj && !isValidCnpj(edit.pCnpj)) {
      setError('CNPJ incompleto.');
      return;
    }
    if (edit?.isNew && (!edit.password || edit.password.length < 6)) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (edit?.role === 'partner' && !edit.partnerId) {
      setError('Selecione o parceiro a vincular.');
      return;
    }
    if (edit) save.mutate(edit);
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Usuários</h2>
          <p className="text-muted">
            Gestão de contas. O admin pode criar e editar qualquer usuário e,
            se for parceiro, também os dados do parceiro (CNPJ, local).
          </p>
        </div>
        <Button onClick={openCreate}>+ Novo usuário</Button>
      </header>

      <Card>
        <Input
          label="Buscar usuário"
          placeholder="Nome ou e-mail"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </Card>

      <Card padded={false}>
        <QueryState
          loading={usersQuery.isLoading}
          error={usersQuery.error}
          empty={filtered.length === 0}
          variant="list"
          emptyLabel="Nenhum usuário."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Saldo cashback</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="admin-partners__cell">
                      <div className="admin-users__avatar">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge badge-primary">{u.role}</span>
                  </td>
                  <td className="text-accent">
                    {formatCurrency(u.cashbackBalance)}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(u)}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      {usersPage && (
        <div className="admin-pagination">
          <span>
            Pagina {usersPage.page} de {usersPage.totalPages} - {usersPage.total} usuario(s)
          </span>
          <div className="row">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= usersPage.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proxima
            </button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(edit)}
        title={edit?.isNew ? 'Novo usuário' : 'Editar usuário'}
        onClose={() => setEdit(null)}
        closeDisabled={save.isPending}
      >
        {edit && (
          <form className="stack" onSubmit={submit}>

            <>
              <Input
                label="Nome"
                value={edit.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={edit.email}
                onChange={(e) => set('email', e.target.value)}
                required
              />
              <Input
                label="Telefone"
                value={edit.phone}
                onChange={(e) => set('phone', maskPhone(e.target.value))}
                error={edit.phone && !isValidPhone(edit.phone) ? 'Telefone incompleto.' : undefined}
              />
              {edit.isNew && (
                <Input
                  label="Senha"
                  type="password"
                  value={edit.password}
                  onChange={(e) => set('password', e.target.value)}
                  hint="Mínimo 6 caracteres."
                  required
                />
              )}
              <div className="row">
                <div className="input-field">
                  <label className="input-field__label">Perfil</label>
                  <div className="input-field__box">
                    <select
                      className="input-field__el"
                      value={edit.role}
                      onChange={(e) => set('role', e.target.value as Role)}
                    >
                      <option value="client">Cliente</option>
                      <option value="partner">Parceiro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <Input
                  label="Saldo cashback (R$)"
                  inputMode="decimal"
                  value={formatMoneyInput(edit.cashbackBalance)}
                  onChange={(e) =>
                    set('cashbackBalance', parseMoneyInput(e.target.value))
                  }
                />
              </div>

              {edit.role === 'partner' && (
                <>
                  <div className="input-field">
                    <label className="input-field__label">
                      Parceiro vinculado
                    </label>
                    <div className="input-field__box">
                      <select
                        className="input-field__el"
                        value={edit.partnerId}
                        onChange={(e) => set('partnerId', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {edit.isNew ? (
                    <small className="text-muted">
                      Os dados do parceiro (CNPJ, local) podem ser editados
                      depois, abrindo este usuário novamente.
                    </small>
                  ) : (
                    <>
                      <h4 style={{ marginTop: 'var(--space-2)' }}>
                        Dados do parceiro
                      </h4>
                      <Input
                        label="CNPJ"
                        value={edit.pCnpj}
                        onChange={(e) => set('pCnpj', maskCnpj(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        error={edit.pCnpj && !isValidCnpj(edit.pCnpj) ? 'CNPJ incompleto.' : undefined}
                      />
                      <div className="row">
                        <Input
                          label="Cidade"
                          value={edit.pCity}
                          onChange={(e) => set('pCity', e.target.value)}
                        />
                        <Input
                          label="Estado"
                          value={edit.pState}
                          onChange={(e) => set('pState', e.target.value)}
                        />
                      </div>
                      <div className="row">
                        <Input
                          label="Latitude"
                          inputMode="decimal"
                          value={String(edit.pLat)}
                          onChange={(e) => set('pLat', Number(maskCoordinate(e.target.value)))}
                          error={coordinateError(String(edit.pLat), 'lat')}
                        />
                        <Input
                          label="Longitude"
                          inputMode="decimal"
                          value={String(edit.pLng)}
                          onChange={(e) => set('pLng', Number(maskCoordinate(e.target.value)))}
                          error={coordinateError(String(edit.pLng), 'lng')}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {error && <small className="input-field__error">{error}</small>}
              <div className="row">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEdit(null)}
                  disabled={save.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </>
          </form>
        )}
      </Modal>
    </div>
  );
}
