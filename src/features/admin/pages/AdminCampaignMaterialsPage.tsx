import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

const EMPTY = { title: '', description: '', fileUrl: '' };

export function AdminCampaignMaterialsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  const q = useQuery({
    queryKey: ['admin-campaign-materials'],
    queryFn: () => adminApi.campaignMaterials(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-campaign-materials'] });

  const create = useMutation({
    mutationFn: () => adminApi.createCampaignMaterial(form),
    onSuccess: () => {
      setForm(EMPTY);
      invalidate();
      toast.success('Material adicionado.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao adicionar.'),
  });
  const toggleActive = useMutation({
    mutationFn: (m: { id: string; title: string; description: string; fileUrl: string; active: boolean }) =>
      adminApi.updateCampaignMaterial(m.id, m),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao atualizar material.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteCampaignMaterial(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao remover material.'),
  });

  const items = q.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.fileUrl.trim()) return;
    create.mutate();
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Materiais de campanha</h2>
          <p className="text-muted">
            Arquivos que ficam disponíveis para todo afiliado ativo (banners,
            catálogos de kits, scripts de venda...). Informe a URL onde o
            arquivo já está hospedado.
          </p>
        </div>
      </header>

      <Card>
        <form className="stack" onSubmit={submit}>
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex.: Catálogo de kits solares"
          />
          <Input
            label="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="URL do arquivo"
            value={form.fileUrl}
            onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
            placeholder="https://..."
          />
          <Button type="submit" disabled={create.isPending || !form.title.trim() || !form.fileUrl.trim()}>
            {create.isPending ? 'Adicionando...' : 'Adicionar material'}
          </Button>
        </form>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhum material cadastrado."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Arquivo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    {m.description && (
                      <>
                        <br />
                        <small className="text-muted">{m.description}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <a href={m.fileUrl} target="_blank" rel="noreferrer">
                      Abrir link
                    </a>
                  </td>
                  <td>
                    <span className={`badge ${m.active ? 'badge-accent' : 'badge-danger'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleActive.mutate({ ...m, active: !m.active })}
                      >
                        {m.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)}>
                        Remover
                      </Button>
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
