import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { useToast } from '@shared/components/Toaster/ToastContext';
import {
  NotificationsCard,
  PasswordCard,
  ProfileBasicsCard,
} from '@shared/components/AccountSettings/AccountSettingsCards';
import { coordinateError, isValidDocument, maskDocument, maskCoordinate, DocumentType } from '@shared/utils/masks';
import { resolveImageUrl } from '@shared/api/client';
import { affiliateApi, catalogApi, partnerApi, uploadsApi, PixKeyType } from '@shared/api/endpoints';
import './PartnerPages.css';

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'Email', label: 'E-mail' },
  { value: 'Phone', label: 'Telefone' },
  { value: 'Random', label: 'Chave aleatória' },
];

/** "Dados da loja" — nome, segmento, CNPJ, logo, localização — só pra
 * Partner.kind = Marketplace. Autoatendimento via PUT /partner/profile
 * (antes só o Admin editava isso, em AdminPartnersPage). */
function StoreProfileCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const segmentsQuery = useQuery({ queryKey: ['categories', 'store'], queryFn: () => catalogApi.categories('store') });
  const [form, setForm] = useState({
    name: '',
    segment: '',
    cnpj: '',
    documentType: 'CNPJ' as DocumentType,
    city: '',
    state: '',
    lat: '',
    lng: '',
  });
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!meQuery.data) return;
    setForm({
      name: meQuery.data.name,
      segment: meQuery.data.segment ?? '',
      cnpj: meQuery.data.cnpj ?? '',
      documentType: meQuery.data.documentType ?? 'CNPJ',
      city: meQuery.data.city ?? '',
      state: meQuery.data.state ?? '',
      lat: meQuery.data.lat ? String(meQuery.data.lat) : '',
      lng: meQuery.data.lng ? String(meQuery.data.lng) : '',
    });
  }, [meQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['affiliate-me'] });

  const saveMutation = useMutation({
    mutationFn: () =>
      partnerApi.updateProfile({
        name: form.name,
        segment: form.segment,
        cnpj: form.cnpj,
        documentType: form.documentType,
        city: form.city,
        state: form.state,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
      }),
    onSuccess: () => {
      toast.success('Dados da loja atualizados.');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar.'),
  });

  const save = () => {
    if (
      (form.cnpj && !isValidDocument(form.cnpj, form.documentType)) ||
      coordinateError(form.lat, 'lat') ||
      coordinateError(form.lng, 'lng')
    ) {
      toast.error('Revise os campos destacados antes de salvar.');
      return;
    }
    saveMutation.mutate();
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    try {
      const url = await uploadsApi.image(file);
      await partnerApi.updateProfile({ logoUrl: url });
      toast.success('Logo atualizado.');
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar o logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <Card>
      <h3>Dados da loja</h3>
      <div className="profile__top" style={{ marginBottom: 16 }}>
        <img
          src={resolveImageUrl(meQuery.data?.logoUrl) || meQuery.data?.logoUrl}
          alt={meQuery.data?.name}
          className="profile__avatar"
        />
        <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer', width: 'fit-content' }}>
          {logoBusy ? 'Enviando...' : '🖼️ Trocar logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            disabled={logoBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadLogo(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className="profile__form">
        <Input label="Nome da loja" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <div className="input-field">
          <label className="input-field__label">Segmento</label>
          <div className="input-field__box">
            <select
              className="input-field__el"
              value={form.segment}
              onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
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
        <div className="row">
          <div className="input-field" style={{ maxWidth: 160 }}>
            <label className="input-field__label">Tipo de documento</label>
            <div className="input-field__box">
              <select
                className="input-field__el"
                value={form.documentType}
                onChange={(e) => {
                  const documentType = e.target.value as DocumentType;
                  setForm((f) => ({ ...f, documentType, cnpj: maskDocument(f.cnpj, documentType) }));
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
            onChange={(e) => setForm((f) => ({ ...f, cnpj: maskDocument(e.target.value, f.documentType) }))}
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
          <Input label="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <Input label="Estado" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="UF" />
        </div>
        <div className="row">
          <Input
            label="Latitude"
            inputMode="decimal"
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: maskCoordinate(e.target.value) }))}
            error={coordinateError(form.lat, 'lat')}
          />
          <Input
            label="Longitude"
            inputMode="decimal"
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: maskCoordinate(e.target.value) }))}
            error={coordinateError(form.lng, 'lng')}
          />
        </div>
        <Button onClick={save} disabled={saveMutation.isPending}>
          Salvar dados da loja
        </Button>
      </div>
    </Card>
  );
}

/** Cidade/estado do afiliado (Partner.kind = SolarAffiliate) — mais simples
 * que a loja, sem CNPJ/logo/coordenadas. */
function AffiliateLocationCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const [form, setForm] = useState({ city: '', state: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meQuery.data) return;
    setForm({ city: meQuery.data.city ?? '', state: meQuery.data.state ?? '' });
  }, [meQuery.data]);

  const save = async () => {
    setBusy(true);
    try {
      await partnerApi.updateProfile({ city: form.city, state: form.state });
      toast.success('Localização atualizada.');
      queryClient.invalidateQueries({ queryKey: ['affiliate-me'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3>Localização</h3>
      <div className="profile__form">
        <div className="row">
          <Input label="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <Input label="Estado" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="UF" />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </Card>
  );
}

/** Chave Pix padrão do afiliado (Partner.kind = SolarAffiliate), usada em
 * todo saque — movida de AffiliateWalletPage pra cá, junto do resto do
 * perfil. */
function PixKeyCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const [editing, setEditing] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');

  useEffect(() => {
    if (meQuery.data?.pixKey) {
      setPixKey(meQuery.data.pixKey);
      setPixKeyType(meQuery.data.pixKeyType ?? 'CPF');
    }
  }, [meQuery.data]);

  const mutation = useMutation({
    mutationFn: () => affiliateApi.updatePixKey(pixKey.trim(), pixKeyType),
    onSuccess: () => {
      toast.success('Chave Pix salva.');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['affiliate-me'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar chave Pix.'),
  });

  const hasSavedKey = !!meQuery.data?.pixKey;

  return (
    <Card>
      <h3>Dados de pagamento</h3>
      <p className="text-muted">
        Chave Pix usada por padrão em todo saque. Dá pra usar outra só numa
        solicitação específica na hora de pedir o saque.
      </p>
      {!editing ? (
        <div className="row-between" style={{ marginTop: 12 }}>
          <span>
            {hasSavedKey ? (
              <>
                <strong>{meQuery.data?.pixKeyType}:</strong> {meQuery.data?.pixKey}
              </>
            ) : (
              'Nenhuma chave Pix cadastrada ainda.'
            )}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {hasSavedKey ? 'Alterar' : 'Cadastrar'}
          </Button>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="input-field" style={{ maxWidth: 200 }}>
              <label className="input-field__label">Tipo de chave</label>
              <div className="input-field__box">
                <select
                  className="input-field__el"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
                >
                  {PIX_KEY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Input label="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required />
          </div>
          <div className="row">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !pixKey.trim()}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function PartnerProfilePage() {
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const isAffiliate = meQuery.data?.kind === 'solar_affiliate';

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Meu perfil</h2>
          <p className="text-muted">
            {isAffiliate
              ? 'Seus dados pessoais, localização e chave Pix para saques.'
              : 'Seus dados pessoais e os dados da sua loja.'}
          </p>
        </div>
      </header>

      <div className="profile">
        <ProfileBasicsCard />
        <PasswordCard />
        <NotificationsCard />
        {meQuery.data && (isAffiliate ? (
          <>
            <AffiliateLocationCard />
            <PixKeyCard />
          </>
        ) : (
          <StoreProfileCard />
        ))}
      </div>
    </div>
  );
}
