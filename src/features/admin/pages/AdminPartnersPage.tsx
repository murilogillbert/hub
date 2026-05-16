import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatPercent } from '@shared/utils/formatters';
import { adminApi, catalogApi } from '@shared/api/endpoints';
import { Partner } from '@shared/types';
import './AdminPages.css';

interface PartnerForm {
  name: string;
  segment: string;
  logoUrl: string;
  feePercent: number;
  active: boolean;
  cnpj: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}
const EMPTY: PartnerForm = {
  name: '',
  segment: '',
  logoUrl: '',
  feePercent: 10,
  active: true,
  cnpj: '',
  city: '',
  state: '',
  lat: 0,
  lng: 0,
};

export function AdminPartnersPage() {
  const qc = useQueryClient();
  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => adminApi.partners(),
  });
  const segmentsQuery = useQuery({
    queryKey: ['categories', 'store'],
    queryFn: () => catalogApi.categories('store'),
  });
  const partners = partnersQuery.data ?? [];

  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
    qc.invalidateQueries({ queryKey: ['partners'] });
    setForm(null);
    setEditing(null);
  };
  const createMut = useMutation({
    mutationFn: (b: PartnerForm) => adminApi.createPartner(b),
    onSuccess: invalidate,
  });
  const updateMut = useMutation({
    mutationFn: ({ id, b }: { id: string; b: PartnerForm }) =>
      adminApi.updatePartner(id, b),
    onSuccess: invalidate,
  });
  const toggleMut = useMutation({
    mutationFn: (p: Partner) =>
      adminApi.updatePartner(p.id, {
        name: p.name,
        segment: p.segment,
        logoUrl: p.logoUrl,
        feePercent: p.feePercent,
        active: !p.active,
        cnpj: p.cnpj,
        city: p.city,
        state: p.state,
        lat: p.lat,
        lng: p.lng,
      }),
    onSuccess: invalidate,
  });

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      segment: p.segment,
      logoUrl: p.logoUrl,
      feePercent: p.feePercent,
      active: p.active,
      cnpj: p.cnpj ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      lat: p.lat ?? 0,
      lng: p.lng ?? 0,
    });
  };

  const submit = () => {
    if (!form) return;
    if (editing) updateMut.mutate({ id: editing.id, b: form });
    else createMut.mutate(form);
  };

  const set = <K extends keyof PartnerForm>(k: K, v: PartnerForm[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Parceiros</h2>
          <p className="text-muted">
            Aprovar cadastros, ajustar taxas e pausar contas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm({ ...EMPTY });
          }}
        >
          + Novo parceiro
        </Button>
      </header>

      {form && (
        <Card>
          <h3>{editing ? 'Editar parceiro' : 'Novo parceiro'}</h3>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <div className="row">
              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <div className="input-field">
                <label className="input-field__label">Segmento</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.segment}
                    onChange={(e) => set('segment', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {(segmentsQuery.data ?? []).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Taxa (%)"
                type="number"
                value={String(form.feePercent)}
                onChange={(e) => set('feePercent', Number(e.target.value))}
              />
            </div>
            <Input
              label="CNPJ"
              value={form.cnpj}
              onChange={(e) => set('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <div className="row">
              <Input
                label="Cidade"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
              <Input
                label="Estado"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="UF"
              />
            </div>
            <div className="row">
              <Input
                label="Latitude"
                type="number"
                value={String(form.lat)}
                onChange={(e) => set('lat', Number(e.target.value))}
              />
              <Input
                label="Longitude"
                type="number"
                value={String(form.lng)}
                onChange={(e) => set('lng', Number(e.target.value))}
              />
            </div>
            <Input
              label="URL do logo (opcional)"
              value={form.logoUrl}
              onChange={(e) => set('logoUrl', e.target.value)}
            />
            <div className="row">
              <Button
                onClick={submit}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editing ? 'Salvar' : 'Criar'}
              </Button>
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <QueryState
          loading={partnersQuery.isLoading}
          error={partnersQuery.error}
          empty={partners.length === 0}
          emptyLabel="Nenhum parceiro."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Segmento</th>
                <th>CNPJ</th>
                <th>Local</th>
                <th>Taxa</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="admin-partners__cell">
                      <img src={p.logoUrl} alt={p.name} />
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td>{p.segment}</td>
                  <td>{p.cnpj || '—'}</td>
                  <td>
                    {p.city ? `${p.city}/${p.state}` : 'Digital'}
                  </td>
                  <td>{formatPercent(p.feePercent)}</td>
                  <td>
                    <span
                      className={`badge ${p.active ? 'badge-accent' : 'badge-danger'}`}
                    >
                      {p.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(p)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleMut.mutate(p)}
                      >
                        {p.active ? 'Pausar' : 'Reativar'}
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
