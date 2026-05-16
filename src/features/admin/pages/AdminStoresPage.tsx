import { useQuery } from '@tanstack/react-query';
import { StoresManager } from '@shared/components/StoresManager/StoresManager';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

export function AdminStoresPage() {
  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => adminApi.partners(),
  });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Unidades</h2>
          <p className="text-muted">
            Gerencie os pontos físicos dos parceiros exibidos no mapa público.
          </p>
        </div>
      </header>

      <StoresManager mode="admin" partners={partnersQuery.data ?? []} />
    </div>
  );
}
