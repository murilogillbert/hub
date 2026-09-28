import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { opendriverAdmin, type Pricing } from '../api';
import { errorText, RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

const FIELDS: { key: keyof Omit<Pricing, 'category' | 'label' | 'active' | 'updatedAt'>; label: string; suffix?: string }[] = [
  { key: 'baseFare', label: 'Tarifa base (R$)' },
  { key: 'perKm', label: 'Por km (R$)' },
  { key: 'perMinute', label: 'Por minuto (R$)' },
  { key: 'minimumFare', label: 'Tarifa mínima (R$)' },
  { key: 'platformFeePercent', label: 'Taxa da plataforma (%)' },
  { key: 'cancellationFee', label: 'Taxa de cancelamento (R$)' },
];

const parse = (v: string) => Number(v.replace(',', '.'));

/** Regras de preço por categoria (RF07). Valem para novas cotações. */
export function OpenDriverPricingPage() {
  const q = useQuery({ queryKey: ['od', 'pricing'], queryFn: () => opendriverAdmin.pricing() });
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Preços das corridas</h2>
          <p className="text-muted">Preço = base + km + minutos, respeitando a mínima. As mudanças valem para as próximas cotações; corridas já pedidas mantêm o preço combinado.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <QueryState loading={q.isLoading} error={q.error} variant="cards">
          <div className="od-pricing">
            {q.data?.map((p) => (
              <PricingCard key={`${p.category}-${p.updatedAt}`} pricing={p} />
            ))}
          </div>
        </QueryState>
      </RequireOpenDriver>
    </div>
  );
}

function PricingCard({ pricing }: { pricing: Pricing }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [label, setLabel] = useState(pricing.label);
  const [active, setActive] = useState(pricing.active);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(pricing[f.key]).replace('.', ',')])));
  const nums = Object.fromEntries(FIELDS.map((f) => [f.key, parse(values[f.key] ?? '')])) as Record<(typeof FIELDS)[number]['key'], number>;
  const invalid = FIELDS.some((f) => !Number.isFinite(nums[f.key]) || nums[f.key] < 0) || label.trim().length < 2;
  // Exemplo para conferência: 8 km e 18 min.
  const example = invalid ? null : Math.max(nums.minimumFare, nums.baseFare + nums.perKm * 8 + nums.perMinute * 18);

  const save = useMutation({
    mutationFn: () => opendriverAdmin.updatePricing(pricing.category, { label: label.trim(), active, ...nums }),
    onSuccess: (list) => {
      qc.setQueryData(['od', 'pricing'], list);
      toast.success('Preços atualizados.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card>
      <div className="stack">
        <div className="row-between">
          <h3>{pricing.category === 'Comfort' ? 'Conforto' : 'Econômico'}</h3>
          <label>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa
          </label>
        </div>
        <Input label="Nome exibido no app" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            inputMode="decimal"
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            error={!Number.isFinite(nums[f.key]) || nums[f.key] < 0 ? 'Valor inválido.' : undefined}
          />
        ))}
        {example !== null ? (
          <p className="text-muted">
            Exemplo (8 km, 18 min): {formatCurrency(example)} · motorista recebe {formatCurrency(example * (1 - nums.platformFeePercent / 100))}
          </p>
        ) : null}
        <small className="text-muted">Última alteração: {formatDateTime(pricing.updatedAt)}</small>
        <Button disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}
