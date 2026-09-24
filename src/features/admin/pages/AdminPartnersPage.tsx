import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatPercent } from '@shared/utils/formatters';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { coordinateError, isValidDocument, maskDocument, maskCoordinate, DocumentType } from '@shared/utils/masks';
import { adminApi, catalogApi, PartnerUpsert } from '@shared/api/endpoints';
import { Partner } from '@shared/types';
import './AdminPages.css';

interface PartnerForm {
  name: string;
  segment: string;
  logoUrl: string;
  feePercent: string;
  active: boolean;
  cnpj: string;
  documentType: DocumentType;
  city: string;
  state: string;
  lat: string;
  lng: string;
  asaasWalletId: string;
  evolutionInstance: string;
}
const EMPTY: PartnerForm = {
  name: '',
  segment: '',
  logoUrl: '',
  feePercent: '10',
  active: true,
  cnpj: '',
  documentType: 'CNPJ',
  city: '',
  state: '',
  lat: '0',
  lng: '0',
  asaasWalletId: '',
  evolutionInstance: '',
};

export function AdminPartnersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const partnersQuery = useQuery({
    queryKey: ['admin-partners', page],
    queryFn: () => adminApi.partners({ page, pageSize: 20 }),
  });
  const segmentsQuery = useQuery({
    queryKey: ['categories', 'store'],
    queryFn: () => catalogApi.categories('store'),
  });
  const partners = partnersQuery.data?.items ?? [];
  const partnersPage = partnersQuery.data;

  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
    qc.invalidateQueries({ queryKey: ['partners'] });
    setForm(null);
    setEditing(null);
  };
  const createMut = useMutation({
    mutationFn: (b: PartnerUpsert) => adminApi.createPartner(b),
    onSuccess: () => {
      invalidate();
      toast.success('Parceiro criado.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Falha ao criar parceiro.'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, b }: { id: string; b: PartnerUpsert }) =>
      adminApi.updatePartner(id, b),
    onSuccess: () => {
      invalidate();
      toast.success('Parceiro salvo.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar parceiro.'),
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
        documentType: p.documentType,
        city: p.city,
        state: p.state,
        lat: p.lat,
        lng: p.lng,
        asaasWalletId: p.asaasWalletId ?? undefined,
        evolutionInstance: p.evolutionInstance ?? undefined,
      }),
    onSuccess: invalidate,
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Falha ao pausar/reativar parceiro.'),
  });

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      segment: p.segment,
      logoUrl: p.logoUrl,
      feePercent: String(p.feePercent),
      active: p.active,
      cnpj: p.cnpj ?? '',
      documentType: p.documentType ?? 'CNPJ',
      city: p.city ?? '',
      state: p.state ?? '',
      lat: String(p.lat ?? 0),
      lng: String(p.lng ?? 0),
      asaasWalletId: p.asaasWalletId ?? '',
      evolutionInstance: p.evolutionInstance ?? '',
    });
  };

  const submit = () => {
    if (!form) return;
    if (
      (form.cnpj && !isValidDocument(form.cnpj, form.documentType)) ||
      coordinateError(form.lat, 'lat') ||
      coordinateError(form.lng, 'lng')
    ) {
      toast.error('Revise os campos destacados antes de salvar.');
      return;
    }
    const body: PartnerUpsert = {
      ...form,
      feePercent: Number(form.feePercent) || 0,
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
    };
    if (editing) updateMut.mutate({ id: editing.id, b: body });
    else createMut.mutate(body);
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
                inputMode="decimal"
                value={form.feePercent}
                onChange={(e) => set('feePercent', maskCoordinate(e.target.value))}
              />
            </div>
            <div className="row">
              <div className="input-field" style={{ maxWidth: 160 }}>
                <label className="input-field__label">Tipo de documento</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.documentType}
                    onChange={(e) => {
                      const documentType = e.target.value as DocumentType;
                      setForm((f) =>
                        f ? { ...f, documentType, cnpj: maskDocument(f.cnpj, documentType) } : f,
                      );
                    }}
                  >
                    <option value="CNPJ">CNPJ</option>
                    <option value="CPF">CPF</option>
                  </select>
                </div>
              </div>
              <Input
                label={form.documentType}
                value={form.cnpj}
                onChange={(e) => set('cnpj', maskDocument(e.target.value, form.documentType))}
                placeholder={form.documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                error={
                  form.cnpj && !isValidDocument(form.cnpj, form.documentType)
                    ? form.documentType === 'CPF'
                      ? 'CPF incompleto.'
                      : 'CNPJ incompleto.'
                    : undefined
                }
              />
            </div>
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
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => set('lat', maskCoordinate(e.target.value))}
                error={coordinateError(form.lat, 'lat')}
              />
              <Input
                label="Longitude"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => set('lng', maskCoordinate(e.target.value))}
                error={coordinateError(form.lng, 'lng')}
              />
            </div>
            <Input
              label="URL do logo (opcional)"
              value={form.logoUrl}
              onChange={(e) => set('logoUrl', e.target.value)}
            />
            <Input
              label="Asaas Wallet ID (split automático)"
              value={form.asaasWalletId}
              onChange={(e) => set('asaasWalletId', e.target.value)}
              placeholder="UUID da carteira do parceiro no Asaas (opcional)"
              hint="Com a carteira preenchida e o provider Asaas ativo, o líquido do parceiro cai direto na conta dele a cada venda. Vazio = repasse manual."
            />
            <Input
              label="Instância Evolution API (WhatsApp do afiliado)"
              value={form.evolutionInstance}
              onChange={(e) => set('evolutionInstance', e.target.value)}
              placeholder="Nome da instância pareada no Evolution API (opcional)"
              hint="Só pra afiliados do programa solar — preencha depois que o consultor parear o próprio WhatsApp no painel do Evolution API. É de lá que o energia-solar-api manda a proposta em PDF."
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
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Segmento</th>
                <th>Documento</th>
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
                  <td>{p.cnpj ? `${p.documentType}: ${p.cnpj}` : '—'}</td>
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

      {partnersPage && (
        <div className="admin-pagination">
          <span>
            Pagina {partnersPage.page} de {partnersPage.totalPages} - {partnersPage.total} parceiro(s)
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
              disabled={page >= partnersPage.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
