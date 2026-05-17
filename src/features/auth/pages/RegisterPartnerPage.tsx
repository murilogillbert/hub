import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { useAuth } from '@shared/hooks/useAuth';
import { routeForRole } from '@shared/context/AuthContext';
import { catalogApi } from '@shared/api/endpoints';
import {
  isValidPhone,
  maskPhone,
  maskCnpj,
  isValidCnpj,
} from '@shared/utils/masks';
import './AuthPages.css';

export function RegisterPartnerPage() {
  const navigate = useNavigate();
  const { registerPartner } = useAuth();
  const storeCats = useQuery({
    queryKey: ['categories', 'store'],
    queryFn: () => catalogApi.categories('store'),
  });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    storeName: '',
    segment: '',
    cnpj: '',
    city: '',
    state: '',
    lat: '',
    lng: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const geocode = async () => {
    const q = [form.city, form.state, 'Brasil']
      .map((v) => v.trim())
      .filter(Boolean)
      .join(', ');
    if (!q) {
      setGeo('Preencha cidade e estado antes de localizar.');
      return;
    }
    setGeo('Buscando coordenadas...');
    try {
      const params = new URLSearchParams({ format: 'json', limit: '1', q });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!res.ok || !data.length) {
        setGeo('Não encontrei coordenadas para essa cidade/estado.');
        return;
      }
      setForm((p) => ({
        ...p,
        lat: Number(data[0].lat).toFixed(6),
        lng: Number(data[0].lon).toFixed(6),
      }));
      setGeo('Coordenadas encontradas.');
    } catch {
      setGeo('Falha ao buscar coordenadas.');
    }
  };

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Telefone incompleto.');
      return;
    }
    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      setError('CNPJ incompleto.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const user = await registerPartner({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        storeName: form.storeName,
        segment: form.segment,
        cnpj: form.cnpj || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
      });
      navigate(routeForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <Link to="/cadastro" className="auth-page__back">
          ← Voltar
        </Link>
        <h2>Cadastro de parceiro</h2>
        <p className="text-muted">
          Crie sua loja e comece a vender para a base de clientes.
        </p>
        <form
          onSubmit={handleSubmit}
          className="stack"
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Input
            label="Nome do responsável"
            value={form.name}
            onChange={update('name')}
            required
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={update('email')}
            required
          />
          <Input
            label="Telefone"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: maskPhone(e.target.value) }))
            }
            placeholder="(11) 99999-0000"
            error={form.phone && !isValidPhone(form.phone) ? 'Telefone incompleto.' : undefined}
          />
          <Input
            label="Nome da loja / parceiro"
            value={form.storeName}
            onChange={update('storeName')}
            required
          />
          <div className="input-field">
            <label className="input-field__label">Segmento da loja</label>
            <div className="input-field__box">
              <select
                className="input-field__el"
                value={form.segment}
                onChange={(e) =>
                  setForm((p) => ({ ...p, segment: e.target.value }))
                }
                required
              >
                <option value="">Selecione o segmento...</option>
                {(storeCats.data ?? []).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="CNPJ"
            value={form.cnpj}
            onChange={(e) =>
              setForm((p) => ({ ...p, cnpj: maskCnpj(e.target.value) }))
            }
            placeholder="00.000.000/0000-00"
            error={
              form.cnpj && !isValidCnpj(form.cnpj) ? 'CNPJ incompleto.' : undefined
            }
          />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Cidade"
                value={form.city}
                onChange={update('city')}
              />
            </div>
            <div style={{ width: 110 }}>
              <Input
                label="UF"
                value={form.state}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    state: e.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                placeholder="SP"
              />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: 1 }}>
              <Input
                label="Latitude"
                value={form.lat}
                onChange={update('lat')}
                placeholder="-23.5505"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Longitude"
                value={form.lng}
                onChange={update('lng')}
                placeholder="-46.6333"
              />
            </div>
            <Button type="button" variant="secondary" onClick={geocode}>
              Localizar
            </Button>
          </div>
          {geo && <small className="text-muted">{geo}</small>}
          <Input
            label="Senha"
            type="password"
            value={form.password}
            onChange={update('password')}
            required
          />
          {error && <small className="input-field__error">{error}</small>}
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Criando...' : 'Criar conta de parceiro'}
          </Button>
        </form>
        <p className="auth-page__alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
