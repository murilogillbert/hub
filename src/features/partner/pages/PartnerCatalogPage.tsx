import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency, formatPercent } from '@shared/utils/formatters';
import {
  partnerApi,
  catalogApi,
  authApi,
  ProductUpsert,
  uploadsApi,
} from '@shared/api/endpoints';
import { resolveImageUrl } from '@shared/api/client';
import { useAuth } from '@shared/hooks/useAuth';
import { Product } from '@shared/types';
import './PartnerPages.css';

const EMPTY: ProductUpsert = {
  title: '',
  description: '',
  price: 0,
  cashbackPercent: 5,
  kind: 'voucher',
  imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
  category: '',
  stock: 10,
};

export function PartnerCatalogPage() {
  const qc = useQueryClient();
  const productsQuery = useQuery({
    queryKey: ['partner-products'],
    queryFn: () => partnerApi.products(),
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories(),
  });
  const products = productsQuery.data ?? [];

  const { user } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductUpsert | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modo vitrine (somente visualização) — persiste no sessionStorage.
  const [showcase, setShowcase] = useState(
    () => sessionStorage.getItem('odh.showcase') === '1',
  );
  const [exitOpen, setExitOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const enterShowcase = () => {
    sessionStorage.setItem('odh.showcase', '1');
    setForm(null);
    setEditing(null);
    setShowcase(true);
  };

  const confirmExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPwdErr(null);
    setPwdBusy(true);
    try {
      await authApi.login(user.email, pwd); // valida sem alterar a sessão
      sessionStorage.removeItem('odh.showcase');
      setShowcase(false);
      setExitOpen(false);
      setPwd('');
    } catch {
      setPwdErr('Senha incorreta.');
    } finally {
      setPwdBusy(false);
    }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-products'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const createMut = useMutation({
    mutationFn: (body: ProductUpsert) => partnerApi.createProduct(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductUpsert }) =>
      partnerApi.updateProduct(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
      setEditing(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => partnerApi.deleteProduct(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      price: p.price,
      cashbackPercent: p.cashbackPercent,
      kind: p.kind,
      imageUrl: p.imageUrl,
      category: p.category,
      stock: p.stock,
    });
  };

  const submit = () => {
    if (!form) return;
    if (editing) updateMut.mutate({ id: editing.id, body: form });
    else createMut.mutate(form);
  };

  const set = <K extends keyof ProductUpsert>(k: K, v: ProductUpsert[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Catálogo do parceiro</h2>
          <p className="text-muted">
            {showcase
              ? 'Modo vitrine ativo — somente visualização.'
              : 'CRUD completo. Cada item tem QR de aquisição rápida para o balcão.'}
          </p>
        </div>
        {showcase ? (
          <span className="badge badge-primary">👁️ Modo vitrine</span>
        ) : (
          <div className="row">
            <Button variant="secondary" onClick={enterShowcase}>
              👁️ Modo vitrine
            </Button>
            <Button onClick={openCreate}>+ Novo produto</Button>
          </div>
        )}
      </header>

      {!showcase && form && (
        <Card>
          <h3>{editing ? 'Editar produto' : 'Novo produto'}</h3>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <Input
              label="Título"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
            <Input
              label="Descrição"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
            <div className="row">
              <Input
                label="Preço (R$)"
                type="number"
                value={String(form.price)}
                onChange={(e) => set('price', Number(e.target.value))}
              />
              <Input
                label="Cashback (%)"
                type="number"
                value={String(form.cashbackPercent)}
                onChange={(e) =>
                  set('cashbackPercent', Number(e.target.value))
                }
              />
              <Input
                label="Estoque"
                type="number"
                value={String(form.stock)}
                onChange={(e) => set('stock', Number(e.target.value))}
              />
            </div>
            <div className="row">
              <div className="input-field">
                <label className="input-field__label">Categoria</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {(categoriesQuery.data ?? []).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-field">
                <label className="input-field__label">Tipo</label>
                <div className="input-field__box">
                  <select
                    className="input-field__el"
                    value={form.kind}
                    onChange={(e) => set('kind', e.target.value)}
                  >
                    <option value="voucher">Voucher</option>
                    <option value="physical">Físico</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>
              </div>
            </div>
            <Input
              label="URL da imagem (ou envie um arquivo abaixo)"
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
            />
            <div className="row">
              <label className="partner-catalog__upload">
                {uploading ? 'Enviando...' : '📷 Enviar imagem'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadError(null);
                    setUploading(true);
                    try {
                      const url = await uploadsApi.image(f);
                      set('imageUrl', url);
                    } catch (err) {
                      setUploadError(
                        err instanceof Error ? err.message : 'Falha no upload.',
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {form.imageUrl && (
                <img
                  className="partner-catalog__thumb"
                  src={resolveImageUrl(form.imageUrl)}
                  alt="pré-visualização"
                />
              )}
            </div>
            {uploadError && (
              <small className="input-field__error">{uploadError}</small>
            )}
            <div className="row">
              <Button
                onClick={submit}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editing ? 'Salvar' : 'Criar'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(null);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <QueryState
        loading={productsQuery.isLoading}
        error={productsQuery.error}
        empty={products.length === 0}
        emptyLabel="Você ainda não possui produtos cadastrados."
      >
        <div className="partner-catalog">
          {products.map((p) => (
            <Card key={p.id} className="partner-catalog__item">
              <div className="partner-catalog__media">
                <img src={resolveImageUrl(p.imageUrl)} alt={p.title} />
              </div>
              <div className="partner-catalog__info">
                <small className="text-soft">{p.category}</small>
                <h3>{p.title}</h3>
                <p className="text-muted">{p.description}</p>
                <div className="partner-catalog__pricing">
                  <div>
                    <small className="text-soft">Preço</small>
                    <strong>{formatCurrency(p.price)}</strong>
                  </div>
                  <div>
                    <small className="text-soft">Cashback</small>
                    <strong className="text-accent">
                      {formatPercent(p.cashbackPercent)}
                    </strong>
                  </div>
                  <div>
                    <small className="text-soft">Estoque</small>
                    <strong>{p.stock}</strong>
                  </div>
                </div>
                {!showcase && (
                  <div className="row">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMut.mutate(p.id)}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>
              <div className="partner-catalog__qr">
                <QrCode
                  value={`opendriverhub://buy?productId=${p.id}`}
                  size={140}
                  label="Aponte para comprar"
                />
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      {showcase && (
        <div className="catalog-showcase__exit">
          <Button variant="secondary" onClick={() => setExitOpen(true)}>
            🔒 Sair do modo vitrine
          </Button>
        </div>
      )}

      {exitOpen && (
        <div
          className="sidebar-user__overlay"
          onClick={() => !pwdBusy && setExitOpen(false)}
        >
          <form
            className="sidebar-user__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={confirmExit}
          >
            <div className="sidebar-user__modal-head">
              <h3>Sair do modo vitrine</h3>
              <button
                type="button"
                className="sidebar-user__close"
                onClick={() => setExitOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="stack">
              <p className="text-muted">
                Confirme sua senha para voltar ao modo de edição.
              </p>
              <Input
                label={`Senha de ${user?.email ?? ''}`}
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoFocus
                required
              />
              {pwdErr && (
                <small className="input-field__error">{pwdErr}</small>
              )}
              <div className="row">
                <Button type="submit" disabled={pwdBusy || !pwd}>
                  {pwdBusy ? 'Verificando...' : 'Confirmar e sair'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setExitOpen(false)}
                  disabled={pwdBusy}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
