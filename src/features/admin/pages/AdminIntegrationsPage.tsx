import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
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

  return (
    <div className="admin-integrations__field">
      <div className="row-between">
        <label className="input-field__label">{field.label}</label>
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
    </div>
  );
}

export function AdminIntegrationsPage() {
  const qc = useQueryClient();
  const groupsQuery = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => adminApi.integrations(),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      adminApi.updateIntegration(key, value),
    onSuccess: (data) => qc.setQueryData(['admin-integrations'], data),
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
