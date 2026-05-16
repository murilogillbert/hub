import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { adminApi } from '@shared/api/endpoints';
import { Category } from '@shared/types';
import './AdminPages.css';

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminApi.categories(),
  });
  const [name, setName] = useState('');
  const [type, setType] = useState<'product' | 'store'>('product');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    qc.invalidateQueries({ queryKey: ['catalog-filters'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const createMut = useMutation({
    mutationFn: (n: string) => adminApi.createCategory(n, type),
    onSuccess: () => {
      setName('');
      setError(null);
      invalidate();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Falha ao criar.'),
  });
  const updateMut = useMutation({
    mutationFn: (c: Category) =>
      adminApi.updateCategory(c.id, c.name, c.active),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: invalidate,
  });

  const cats = q.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) createMut.mutate(name.trim());
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Categorias</h2>
          <p className="text-muted">
            As categorias aqui aparecem no catálogo do cliente e no dropdown do
            parceiro ao cadastrar produtos.
          </p>
        </div>
      </header>

      <Card>
        <form className="row" onSubmit={submit}>
          <Input
            label="Nova categoria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Pet Shop"
          />
          <div className="input-field" style={{ maxWidth: 200 }}>
            <label className="input-field__label">Tipo</label>
            <div className="input-field__box">
              <select
                className="input-field__el"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'product' | 'store')
                }
              >
                <option value="product">Categoria de produto</option>
                <option value="store">Categoria de loja (segmento)</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={createMut.isPending || !name.trim()}>
            Adicionar
          </Button>
        </form>
        {error && <small className="input-field__error">{error}</small>}
      </Card>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={cats.length === 0}
          emptyLabel="Nenhuma categoria cadastrada."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      className="admin-cat__name"
                      defaultValue={c.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== c.name)
                          updateMut.mutate({ ...c, name: v });
                      }}
                    />
                  </td>
                  <td>
                    <span className="badge badge-primary">
                      {c.type === 'store' ? 'Loja' : 'Produto'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${c.active ? 'badge-accent' : 'badge-danger'}`}
                    >
                      {c.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateMut.mutate({ ...c, active: !c.active })
                        }
                      >
                        {c.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      {c.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(c.id)}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
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
