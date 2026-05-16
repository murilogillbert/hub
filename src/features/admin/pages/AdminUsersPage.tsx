import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';

import './AdminPages.css';

export function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
  });
  const users = usersQuery.data ?? [];

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
          <p className="text-muted">Gestão de contas de clientes e equipe.</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
