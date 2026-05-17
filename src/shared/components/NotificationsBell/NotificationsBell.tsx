import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@shared/api/endpoints';
import { formatDateTime } from '@shared/utils/formatters';
import './NotificationsBell.css';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['me-notifications'],
    queryFn: () => authApi.notifications(),
    refetchInterval: 60_000,
  });
  const items = q.data ?? [];
  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="notifications-bell">
      <button
        type="button"
        className="notifications-bell__button"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">!</span>
        {unread > 0 && <strong>{unread > 9 ? '9+' : unread}</strong>}
      </button>
      {open && (
        <div className="notifications-bell__dropdown">
          <header>
            <strong>Notificações</strong>
            <small className="text-soft">{items.length} recente(s)</small>
          </header>
          {items.length === 0 ? (
            <p className="text-muted">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.read ? '' : 'is-unread'}>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small className="text-soft">{formatDateTime(item.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
