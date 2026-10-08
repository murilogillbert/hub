import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import {
  adminApi,
  IntegrationField,
  IntegrationGroup,
} from '@shared/api/endpoints';
import './AdminPages.css';

function FieldRow({
  field,
  onSave,
  saving,
}: {
  field: IntegrationField;
  onSave: (key: string, value: string | null) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);

  const sourceBadge =
    field.source === 'db'
      ? { cls: 'badge-accent', label: 'personalizado' }
      : field.source === 'env'
        ? { cls: 'badge-primary', label: '.env' }
        : { cls: 'badge-danger', label: 'não definido' };

  const inputId = useId();

  /**
   * Campo com opções é um seletor, não caixa de texto.
   *
   * O motivo é o provedor de pagamento: digitado à mão, `asas` não daria erro nenhum — a
   * seleção do gateway não reconheceria, cairia no padrão `mock`, e o sistema voltaria a
   * fingir que cobra. O servidor também recusa valor fora da lista; o seletor é para o
   * operador não precisar descobrir isso por erro.
   */
  if (field.options?.length) {
    const atual = field.hasValue ? field.preview : '';
    return (
      <div className="admin-integrations__field">
        <div className="row-between">
          <label htmlFor={inputId} className="input-field__label">{field.label}</label>
          <span className={`badge ${sourceBadge.cls}`}>{sourceBadge.label}</span>
        </div>
        <div className="row">
          <div className="admin-filters__select">
            <select
              id={inputId}
              value={atual}
              disabled={saving}
              onChange={(e) => onSave(field.key, e.target.value || null)}
            >
              <option value="">— usar o padrão —</option>
              {field.options.map((o) => (
                <option key={o} value={o}>
                  {o === 'mock' ? 'mock (simulado — não cobra)' : o}
                </option>
              ))}
            </select>
          </div>
          {atual === 'mock' ? <span className="badge badge-danger">simulado</span> : null}
        </div>
        {field.hint ? <small className="text-muted">{field.hint}</small> : null}
      </div>
    );
  }

  return (
    <div className="admin-integrations__field">
      <div className="row-between">
        <label htmlFor={inputId} className="input-field__label">{field.label}</label>
        <span className={`badge ${sourceBadge.cls}`}>{sourceBadge.label}</span>
      </div>

      {!editing ? (
        <div className="row">
          <code className="admin-integrations__preview">
            {field.hasValue ? field.preview : '— vazio —'}
          </code>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Alterar
          </Button>
          {field.source === 'db' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => onSave(field.key, null)}
            >
              Limpar (voltar ao .env)
            </Button>
          )}
        </div>
      ) : (
        <div className="row">
          <Input
            id={inputId}
            type={field.secret ? 'password' : 'text'}
            placeholder={field.secret ? 'Cole o novo valor' : ''}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <Button
            size="sm"
            disabled={saving || !value.trim()}
            onClick={() => {
              onSave(field.key, value.trim());
              setValue('');
              setEditing(false);
            }}
          >
            Salvar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setValue('');
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
      {field.hint ? <small className="text-muted">{field.hint}</small> : null}
    </div>
  );
}

export function AdminIntegrationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const groupsQuery = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => adminApi.integrations(),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      adminApi.updateIntegration(key, value),
    onSuccess: (data) => {
      qc.setQueryData(['admin-integrations'], data);
      // A faixa de "pagamento simulado" vive no layout e tem cache próprio. Sem invalidar,
      // trocar o provedor aqui deixaria a faixa na tela por até 5 minutos, como se a mudança
      // não tivesse valido.
      void qc.invalidateQueries({ queryKey: ['admin-payment-mode'] });
      toast.success('Configuração salva.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  });

  const groups = groupsQuery.data ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Integrações</h2>
          <p className="text-muted">
            As credenciais usam o <code>.env</code>/<code>appsettings</code>{' '}
            como padrão. O valor salvo aqui é guardado no banco e{' '}
            <strong>sobrepõe</strong> o <code>.env</code> em runtime. Limpar um
            campo volta a usar o <code>.env</code>.
          </p>
        </div>
      </header>

      <QueryState
        loading={groupsQuery.isLoading}
        error={groupsQuery.error}
        empty={groups.length === 0}
      >
        <div className="admin-integrations">
          {groups.map((g: IntegrationGroup) => (
            <Card key={g.id} className="admin-integrations__card">
              <header className="row-between">
                <div className="row">
                  <span className="admin-integrations__icon">{g.icon}</span>
                  <div>
                    <strong>{g.name}</strong>
                    <small className="text-muted">{g.description}</small>
                  </div>
                </div>
                <span
                  className={`badge ${g.connected ? 'badge-accent' : 'badge-danger'}`}
                >
                  {g.connected ? 'Configurado' : 'Incompleto'}
                </span>
              </header>

              {g.warning ? (
                <p className="admin-integrations__warning" role="alert">
                  {g.warning}
                </p>
              ) : null}

              {g.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  saving={updateMut.isPending}
                  onSave={(key, value) => updateMut.mutate({ key, value })}
                />
              ))}
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
