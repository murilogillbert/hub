import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { StoreMap } from '@shared/components/StoreMap/StoreMap';
import { adminApi, catalogApi, partnerApi, StoreUpsert } from '@shared/api/endpoints';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { coordinateError, maskCoordinate } from '@shared/utils/masks';
import { Partner, PartnerStore } from '@shared/types';
import './StoresManager.css';

interface StoreForm {
  partnerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: string;
  lng: string;
  category: string;
}

interface StoresManagerProps {
  mode: 'admin' | 'partner';
  partners?: Partner[];
}

const EMPTY: StoreForm = {
  partnerId: '',
  name: '',
  address: '',
  city: '',
  state: '',
  lat: '',
  lng: '',
  category: '',
};

const hasCoords = (lat: number, lng: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

function toForm(store: PartnerStore): StoreForm {
  return {
    partnerId: store.partnerId,
    name: store.name,
    address: store.address,
    city: store.city,
    state: store.state,
    lat: String(store.lat),
    lng: String(store.lng),
    category: store.category,
  };
}

export function StoresManager({ mode, partners = [] }: StoresManagerProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerStore | null>(null);
  const [form, setForm] = useState<StoreForm>({ ...EMPTY });
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = mode === 'admin';
  const queryKey = isAdmin
    ? ['admin-stores', selectedPartnerId || 'all']
    : ['partner-stores'];

  const storesQuery = useQuery({
    queryKey,
    queryFn: () =>
      isAdmin
        ? adminApi.stores(selectedPartnerId || undefined)
        : partnerApi.stores(),
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'store'],
    queryFn: () => catalogApi.categories('store'),
  });

  const stores = storesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const latError = coordinateError(form.lat, 'lat', formOpen);
  const lngError = coordinateError(form.lng, 'lng', formOpen);

  const mapStores = useMemo(() => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const preview =
      form.name.trim() && hasCoords(lat, lng)
        ? [{
            id: editing?.id ?? 'preview',
            partnerId: form.partnerId || editing?.partnerId || '',
            name: form.name.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            lat,
            lng,
            category: form.category.trim(),
          }]
        : [];
    return preview.length ? preview : stores;
  }, [editing?.id, editing?.partnerId, form, stores]);

  const invalidate = (message?: string) => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ['stores'] });
    qc.invalidateQueries({ queryKey: ['catalog-filters'] });
    setEditing(null);
    setFormOpen(false);
    setForm({ ...EMPTY });
    setMessage(null);
    if (message) toast.success(message);
  };

  const createMut = useMutation({
    mutationFn: (body: StoreUpsert) =>
      isAdmin ? adminApi.createStore(body) : partnerApi.createStore(body),
    onSuccess: () => invalidate('Unidade cadastrada.'),
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Falha ao salvar unidade.';
      setMessage(message);
      toast.error(message);
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: StoreUpsert }) =>
      isAdmin
        ? adminApi.updateStore(id, body)
        : partnerApi.updateStore(id, body),
    onSuccess: () => invalidate('Unidade salva.'),
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Falha ao salvar unidade.';
      setMessage(message);
      toast.error(message);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      isAdmin ? adminApi.deleteStore(id) : partnerApi.deleteStore(id),
    onSuccess: () => invalidate('Unidade removida.'),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao remover unidade.'),
  });

  const set = <K extends keyof StoreForm>(key: K, value: StoreForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
    setMessage(null);
    setForm({
      ...EMPTY,
      partnerId: isAdmin ? selectedPartnerId : '',
    });
  };

  const openEdit = (store: PartnerStore) => {
    setEditing(store);
    setFormOpen(true);
    setMessage(null);
    setForm(toForm(store));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (latError || lngError) return;
    const body: StoreUpsert = {
      partnerId: isAdmin ? form.partnerId : undefined,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      category: form.category.trim(),
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  };

  const geocode = async () => {
    const q = [form.address, form.city, form.state, 'Brasil']
      .map((v) => v.trim())
      .filter(Boolean)
      .join(', ');
    if (!q) {
      setMessage('Preencha o endereço antes de buscar coordenadas.');
      return;
    }
    setMessage('Buscando coordenadas...');
    try {
      const params = new URLSearchParams({
        format: 'json',
        limit: '1',
        q,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!res.ok || !data.length) {
        setMessage('Não encontrei coordenadas para esse endereço.');
        return;
      }
      setForm((current) => ({
        ...current,
        lat: String(Number(data[0].lat).toFixed(6)),
        lng: String(Number(data[0].lon).toFixed(6)),
      }));
      setMessage('Coordenadas encontradas. Confira o ponto no mapa.');
    } catch {
      setMessage('Falha ao buscar coordenadas.');
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Geolocalização indisponível neste navegador.');
      return;
    }
    setMessage('Obtendo localização...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((current) => ({
          ...current,
          lat: String(Number(pos.coords.latitude).toFixed(6)),
          lng: String(Number(pos.coords.longitude).toFixed(6)),
        }));
        setMessage('Localização aplicada. Confira o ponto no mapa.');
      },
      () => setMessage('Não foi possível obter a localização.'),
    );
  };

  const partnerName = (id: string) =>
    partners.find((partner) => partner.id === id)?.name ?? 'Parceiro';

  return (
    <div className="stores-manager">
      {isAdmin && (
        <Card>
          <div className="stores-manager__filter">
            <div className="input-field">
              <label className="input-field__label">Parceiro</label>
              <div className="input-field__box">
                <select
                  className="input-field__el"
                  value={selectedPartnerId}
                  onChange={(e) => {
                    setSelectedPartnerId(e.target.value);
                    setForm({ ...EMPTY, partnerId: e.target.value });
                    setEditing(null);
                  }}
                >
                  <option value="">Todos os parceiros</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={openCreate}>Nova unidade</Button>
          </div>
        </Card>
      )}

      {!isAdmin && (
        <div className="row">
          <Button onClick={openCreate}>Nova unidade</Button>
        </div>
      )}

      {formOpen && (
        <Card>
          <form className="stores-manager__form" onSubmit={submit}>
            <div className="row-between">
              <h3>{editing ? 'Editar unidade' : 'Nova unidade'}</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(false);
                  setForm({ ...EMPTY });
                  setMessage(null);
                }}
              >
                Fechar
              </Button>
            </div>

            {isAdmin && (
              <div className="input-field">
                <label className="input-field__label">Parceiro</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.partnerId}
                    onChange={(e) => set('partnerId', e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="stores-manager__grid">
              <Input
                label="Nome da unidade"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
              <div className="input-field">
                <label className="input-field__label">Categoria</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Endereço"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                required
              />
              <Input
                label="Cidade"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                required
              />
              <Input
                label="Estado"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                maxLength={2}
                required
              />
              <Input
                label="Latitude"
                type="number"
                step="0.000001"
                value={form.lat}
                onChange={(e) => set('lat', maskCoordinate(e.target.value))}
                error={latError}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="0.000001"
                value={form.lng}
                onChange={(e) => set('lng', maskCoordinate(e.target.value))}
                error={lngError}
                required
              />
            </div>

            <div className="row">
              <Button type="button" variant="secondary" onClick={geocode}>
                Buscar coordenadas
              </Button>
              <Button type="button" variant="ghost" onClick={useCurrentLocation}>
                Usar localização atual
              </Button>
            </div>

            {message && <small className="input-field__hint">{message}</small>}

            <StoreMap stores={mapStores} height={280} />

            <div className="row">
              <Button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editing ? 'Salvar unidade' : 'Cadastrar unidade'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(false);
                  setForm({ ...EMPTY });
                  setMessage(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padded={false}>
        <QueryState
          loading={storesQuery.isLoading}
          error={storesQuery.error}
          empty={stores.length === 0}
          emptyLabel="Nenhuma unidade cadastrada."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Unidade</th>
                {isAdmin && <th>Parceiro</th>}
                <th>Local</th>
                <th>Coordenadas</th>
                <th>Categoria</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <strong>{store.name}</strong>
                    <small className="text-muted stores-manager__address">
                      {store.address}
                    </small>
                  </td>
                  {isAdmin && <td>{partnerName(store.partnerId)}</td>}
                  <td>{store.city}/{store.state}</td>
                  <td>{store.lat.toFixed(5)}, {store.lng.toFixed(5)}</td>
                  <td>
                    <span className="badge badge-primary">{store.category}</span>
                  </td>
                  <td>
                    <div className="row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(store)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMut.mutate(store.id)}
                      >
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
