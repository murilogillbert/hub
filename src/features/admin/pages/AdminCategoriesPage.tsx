import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { adminApi } from '@shared/api/endpoints';
import { Category } from '@shared/types';
import './AdminPages.css';

/** Sugestões de segmento mandadas pela opção "Outro" no cadastro de
 * parceiro — o Admin decide se vira uma categoria de loja de verdade. */
function CategorySuggestionsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['admin-category-suggestions'],
    queryFn: () => adminApi.categorySuggestions('pending'),
  });
  const suggestions = q.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-category-suggestions'] });
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    qc.invalidateQueries({ queryKey: ['catalog-filters'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };
  const approveMut = useMutation({
    mutationFn: (id: string) => adminApi.approveCategorySuggestion(id),
    onSuccess: () => {
      toast.success('Sugestão aprovada — já virou categoria de loja.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao aprovar.'),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => adminApi.rejectCategorySuggestion(id),
    onSuccess: () => {
      toast.success('Sugestão rejeitada.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao rejeitar.'),
  });

  if (!q.isLoading && suggestions.length === 0) return null;

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
        <h3>Sugestões de segmento pendentes</h3>
        <p className="text-muted">
          Parceiros que escolheram "Outro" no cadastro e sugeriram um novo
          segmento de loja. Aprovar cria a categoria; rejeitar só descarta a
          sugestão (a loja continua com o segmento que ela sugeriu).
        </p>
      </div>
      <QueryState
        loading={q.isLoading}
        error={q.error}
        empty={suggestions.length === 0}
        emptyLabel="Nenhuma sugestão pendente."
        variant="list"
      >
        <table className="history__table">
          <thead>
            <tr>
              <th>Sugestão</th>
              <th>Loja</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.partnerName ?? '—'}</td>
                <td>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                  <div className="row">
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate(s.id)}
                      disabled={approveMut.isPending || rejectMut.isPending}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rejectMut.mutate(s.id)}
                      disabled={approveMut.isPending || rejectMut.isPending}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueryState>
    </Card>
  );
}

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
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
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao atualizar categoria.'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao remover categoria.'),
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

      <CategorySuggestionsCard />

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
