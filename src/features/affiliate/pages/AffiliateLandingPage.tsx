import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { affiliateApplicationApi } from '@shared/api/endpoints';
import { Icon } from '@shared/components/Icon/Icon';
import { usePageMeta } from '@shared/hooks/usePageMeta';
import './AffiliateLandingPage.css';

/**
 * Landing pública do programa de afiliados (consultores de energia solar).
 * /afiliados — sem login. Hero + "como funciona" + formulário de inscrição.
 */
export function AffiliateLandingPage() {
  usePageMeta(
    'Programa de Afiliados · Energia Solar',
    'Vire consultor parceiro de energia solar: link próprio, materiais de campanha e comissão por cada negócio fechado.',
  );
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    message: '',
  });
  const [sent, setSent] = useState(false);

  const apply = useMutation({
    mutationFn: () => affiliateApplicationApi.apply(form),
    onSuccess: () => setSent(true),
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    apply.mutate();
  };

  return (
    <div className="affiliate-page">
      <section className="affiliate-page__hero">
        <div className="affiliate-page__hero-copy">
          <span className="eyebrow">Programa de afiliados · energia solar</span>
          <h1>
            Venda energia solar e <span className="text-lime-affiliate">ganhe comissão</span> em cada negócio fechado
          </h1>
          <p>
            Vire consultor parceiro: acompanhe seus clientes, receba materiais
            de campanha prontos e tenha um link próprio para enviar às pessoas
            interessadas em economizar na conta de luz.
          </p>
        </div>
        <aside className="affiliate-page__hero-side">
          <ul>
            <li><Icon name="check" size={14} /> Link de indicação só seu</li>
            <li><Icon name="check" size={14} /> Materiais de campanha prontos</li>
            <li><Icon name="check" size={14} /> Saldo e extrato de comissão em tempo real</li>
            <li><Icon name="check" size={14} /> Saque quando quiser (sujeito a aprovação)</li>
          </ul>
        </aside>
      </section>

      <section className="affiliate-page__form-card">
        <header>
          <h2>Quero ser afiliado</h2>
          <p className="text-muted">
            Preencha seus dados. Depois de avaliarmos sua inscrição, você
            recebe por e-mail o acesso à plataforma com login e senha.
          </p>
        </header>

        {sent ? (
          <div className="affiliate-page__success">
            <strong>Inscrição enviada!</strong>
            <p className="text-muted">
              Vamos avaliar seu cadastro e te avisar por e-mail assim que for
              aprovado.
            </p>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <Input
              label="Nome completo"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
            <div className="row">
              <Input
                label="WhatsApp"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
              <Input
                label="Cidade"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
              <Input
                label="Estado"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="SP"
              />
            </div>
            <div className="input-field">
              <label className="input-field__label">
                Conte um pouco sobre você (opcional)
              </label>
              <div className="input-field__box">
                <textarea
                  className="input-field__el"
                  rows={3}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Já vende algo hoje? Tem experiência com energia solar?"
                />
              </div>
            </div>

            {apply.isError && (
              <small className="input-field__error">
                {apply.error instanceof Error
                  ? apply.error.message
                  : 'Falha ao enviar sua inscrição.'}
              </small>
            )}

            <Button type="submit" disabled={apply.isPending} fullWidth>
              {apply.isPending ? 'Enviando...' : 'Quero me tornar afiliado'}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
