import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { useAuth } from '@shared/hooks/useAuth';
import { routeForRole } from '@shared/context/AuthContext';
import { catalogApi } from '@shared/api/endpoints';
import { isValidPhone, maskPhone } from '@shared/utils/masks';
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
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
