import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import { User, Partner } from '@shared/types';
import './AdminPages.css';

type Role = 'client' | 'partner' | 'admin';

interface EditState {
  id: string;
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
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
  });
  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => adminApi.partners(),
  });
  const users = usersQuery.data ?? [];
  const partners = partnersQuery.data ?? [];

  const save = useMutation({
    mutationFn: async (e: EditState) => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      setEdit(null);
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Falha ao salvar.'),
  });

  const openEdit = (u: User) => {
    const p: Partner | undefined = u.partnerId
      ? partners.find((x) => x.id === u.partnerId)
      : undefined;
    setError(null);
    setEdit({
      id: u.id,
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

  const set = <K extends keyof EditState>(k: K, v: EditState[K]) =>
    setEdit((e) => (e ? { ...e, [k]: v } : e));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
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
            Gestão de contas. O admin pode editar qualquer usuário e, se for
            parceiro, também os dados do parceiro (CNPJ, local).
          </p>
        </div>
      </header>

      <Card>
        <Input
          label="Buscar usuário"
          placeholder="Nome ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      <Card padded={false}>
        <QueryState
          loading={usersQuery.isLoading}
          error={usersQuery.error}
          empty={filtered.length === 0}
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

      {edit && (
        <div
          className="sidebar-user__overlay"
          onClick={() => !save.isPending && setEdit(null)}
        >
          <form
            className="sidebar-user__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
          >
            <div className="sidebar-user__modal-head">
              <h3>Editar usuário</h3>
              <button
                type="button"
                className="sidebar-user__close"
                onClick={() => setEdit(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="stack">
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
                onChange={(e) => set('phone', e.target.value)}
              />
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
                  type="number"
                  value={String(edit.cashbackBalance)}
                  onChange={(e) =>
                    set('cashbackBalance', Number(e.target.value))
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

                  <h4 style={{ marginTop: 'var(--space-2)' }}>
                    Dados do parceiro
                  </h4>
                  <Input
                    label="CNPJ"
                    value={edit.pCnpj}
                    onChange={(e) => set('pCnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
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
                      type="number"
                      value={String(edit.pLat)}
                      onChange={(e) => set('pLat', Number(e.target.value))}
                    />
                    <Input
                      label="Longitude"
                      type="number"
                      value={String(edit.pLng)}
                      onChange={(e) => set('pLng', Number(e.target.value))}
                    />
                  </div>
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
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
