import { Navigate, Route, Routes } from 'react-router-dom';
import { ClientLayout } from '@shared/components/Layouts/ClientLayout';
import { PartnerLayout, PartnerIndexRedirect } from '@shared/components/Layouts/PartnerLayout';
import { AdminLayout } from '@shared/components/Layouts/AdminLayout';
import { FinanceiroLayout } from '@shared/components/Layouts/FinanceiroLayout';
import { RequireRole, RedirectIfAuthenticated } from '@shared/components/RouteGuards';
import { StepUpGuard } from '@shared/components/StepUpGuard/StepUpGuard';
import { lazyPage } from '@shared/components/LazyPage/LazyPage';

import { HomePage } from '@features/client/pages/HomePage';
import { CatalogPage } from '@features/client/pages/CatalogPage';
import { ProductPage } from '@features/client/pages/ProductPage';
import { CartPage } from '@features/client/pages/CartPage';
import { CheckoutPage } from '@features/client/pages/CheckoutPage';
import { PurchaseConfirmationPage } from '@features/client/pages/PurchaseConfirmationPage';
import { MyItemsPage } from '@features/client/pages/MyItemsPage';
import { HistoryPage } from '@features/client/pages/HistoryPage';
import { ProfilePage } from '@features/client/pages/ProfilePage';
import { OrderDetailPage } from '@features/client/pages/OrderDetailPage';
import { CashbackPage } from '@features/client/pages/CashbackPage';
import { LucroRealPage } from '@features/client/pages/LucroRealPage';
import { AffiliateLandingPage } from '@features/affiliate/pages/AffiliateLandingPage';

import { LoginPage } from '@features/auth/pages/LoginPage';
import { RegisterChoicePage } from '@features/auth/pages/RegisterChoicePage';
import { RegisterClientPage } from '@features/auth/pages/RegisterClientPage';
import { RegisterPartnerPage } from '@features/auth/pages/RegisterPartnerPage';
import { ForgotPasswordPage } from '@features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@features/auth/pages/VerifyEmailPage';

const PartnerCatalogPage = lazyPage(() => import('@features/partner/pages/PartnerCatalogPage'), 'PartnerCatalogPage');
const PartnerDriverAffiliatesPage = lazyPage(() => import('@features/partner/pages/PartnerDriverAffiliatesPage'), 'PartnerDriverAffiliatesPage');
const PartnerRedeemPage = lazyPage(() => import('@features/partner/pages/PartnerRedeemPage'), 'PartnerRedeemPage');
const PartnerMetricsPage = lazyPage(() => import('@features/partner/pages/PartnerMetricsPage'), 'PartnerMetricsPage');
const PartnerStoresPage = lazyPage(() => import('@features/partner/pages/PartnerStoresPage'), 'PartnerStoresPage');
const PartnerProfilePage = lazyPage(() => import('@features/partner/pages/PartnerProfilePage'), 'PartnerProfilePage');
const AffiliateWalletPage = lazyPage(() => import('@features/partner/pages/affiliate/AffiliateWalletPage'), 'AffiliateWalletPage');
const AffiliateWithdrawalsPage = lazyPage(() => import('@features/partner/pages/affiliate/AffiliateWithdrawalsPage'), 'AffiliateWithdrawalsPage');
const AffiliateMaterialsPage = lazyPage(() => import('@features/partner/pages/affiliate/AffiliateMaterialsPage'), 'AffiliateMaterialsPage');
const AffiliateLinkPage = lazyPage(() => import('@features/partner/pages/affiliate/AffiliateLinkPage'), 'AffiliateLinkPage');

const AdminDashboardPage = lazyPage(() => import('@features/admin/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminSalesPage = lazyPage(() => import('@features/admin/pages/AdminSalesPage'), 'AdminSalesPage');
const AdminPartnersPage = lazyPage(() => import('@features/admin/pages/AdminPartnersPage'), 'AdminPartnersPage');
const AdminPayoutsPage = lazyPage(() => import('@features/admin/pages/AdminPayoutsPage'), 'AdminPayoutsPage');
const AdminDriverPayoutsPage = lazyPage(() => import('@features/admin/pages/AdminDriverPayoutsPage'), 'AdminDriverPayoutsPage');
const AdminStoresPage = lazyPage(() => import('@features/admin/pages/AdminStoresPage'), 'AdminStoresPage');
const AdminUsersPage = lazyPage(() => import('@features/admin/pages/AdminUsersPage'), 'AdminUsersPage');
const AdminIntegrationsPage = lazyPage(() => import('@features/admin/pages/AdminIntegrationsPage'), 'AdminIntegrationsPage');
const AdminCategoriesPage = lazyPage(() => import('@features/admin/pages/AdminCategoriesPage'), 'AdminCategoriesPage');
const AdminAuditPage = lazyPage(() => import('@features/admin/pages/AdminAuditPage'), 'AdminAuditPage');
const AdminAffiliateApplicationsPage = lazyPage(() => import('@features/admin/pages/AdminAffiliateApplicationsPage'), 'AdminAffiliateApplicationsPage');
const AdminCampaignMaterialsPage = lazyPage(() => import('@features/admin/pages/AdminCampaignMaterialsPage'), 'AdminCampaignMaterialsPage');
const AdminApiKeysPage = lazyPage(() => import('@features/admin/pages/AdminApiKeysPage'), 'AdminApiKeysPage');
const AdminProfilePage = lazyPage(() => import('@features/admin/pages/AdminProfilePage'), 'AdminProfilePage');
const OpenDriverDashboardPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverDashboardPage'), 'OpenDriverDashboardPage');
const OpenDriverDriversPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverDriversPage'), 'OpenDriverDriversPage');
const OpenDriverPayoutsPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverPayoutsPage'), 'OpenDriverPayoutsPage');
const OpenDriverPricingPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverPricingPage'), 'OpenDriverPricingPage');
const OpenDriverRidesPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverRidesPage'), 'OpenDriverRidesPage');
const OpenDriverSafetyPage = lazyPage(() => import('@features/opendriver/pages/OpenDriverSafetyPage'), 'OpenDriverSafetyPage');
const OpenDriverVehicleCategoriesPage = lazyPage(
  () => import('@features/opendriver/pages/OpenDriverVehicleCategoriesPage'),
  'OpenDriverVehicleCategoriesPage',
);
const AdminSurveyPage = lazyPage(() => import('@features/admin/pages/AdminSurveyPage'), 'AdminSurveyPage');

// Painel de crédito do anunciante (OpenAd). Carregado sob demanda: a maioria dos usuários do
// hub nunca é anunciante, e a página traz o gerador de QR consigo.
const CreditoDeAnuncioPage = lazyPage(
  () => import('@features/anunciante/pages/CreditoDeAnuncioPage'),
  'CreditoDeAnuncioPage',
);

const FinanceiroWithdrawalsPage = lazyPage(() => import('@features/financeiro/pages/FinanceiroWithdrawalsPage'), 'FinanceiroWithdrawalsPage');
const FinanceiroAffiliatesPage = lazyPage(() => import('@features/financeiro/pages/FinanceiroAffiliatesPage'), 'FinanceiroAffiliatesPage');
const FinanceiroProfilePage = lazyPage(() => import('@features/financeiro/pages/FinanceiroProfilePage'), 'FinanceiroProfilePage');

export function AppRoutes() {
  return (
    <Routes>
      {/* Client area + auth (header/footer público) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/produtos" element={<CatalogPage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
        <Route path="/lucro-real-motorista" element={<LucroRealPage />} />
        <Route path="/afiliados" element={<AffiliateLandingPage />} />

        {/* Auth: 1 tela de login, cadastro com seletor + 2 telas */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/cadastro"
          element={
            <RedirectIfAuthenticated>
              <RegisterChoicePage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/cadastro/passageiro"
          element={
            <RedirectIfAuthenticated>
              <RegisterClientPage role="Passenger" />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/cadastro/motorista"
          element={
            <RedirectIfAuthenticated>
              <RegisterClientPage role="Driver" />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/cadastro/parceiro"
          element={
            <RedirectIfAuthenticated>
              <RegisterPartnerPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/esqueci-senha"
          element={
            <RedirectIfAuthenticated>
              <ForgotPasswordPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/verificar-email" element={<VerifyEmailPage />} />

        <Route path="/produto/:id" element={<ProductPage />} />
        <Route path="/carrinho" element={<CartPage />} />

        {/* Compra exige login — sem sessão, vai para /login e volta.
            Partner também compra (loja pode ser comprador, programa de
            afiliação loja↔motorista). */}
        <Route element={<RequireRole roles={['client', 'passenger', 'driver', 'partner', 'admin']} />}>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/:id" element={<CheckoutPage />} />
          <Route path="/compra/confirmacao/:id" element={<PurchaseConfirmationPage />} />
          <Route path="/conta/itens" element={<MyItemsPage />} />
          <Route path="/meus-itens/:id" element={<OrderDetailPage />} />
          <Route path="/conta/historico" element={<HistoryPage />} />
          <Route path="/conta/cashback" element={<CashbackPage />} />
          {/*
            Compra de crédito de veiculação do OpenAd.
            Vive na área do cliente, e não numa área própria, porque "ser anunciante" não é um
            papel do hub: é a existência de uma linha em `openad.ad_advertisers` para este
            `users.id`. Criar um papel só para isto exigiria migration no enum e deixaria dois
            lugares a manter em sincronia; a própria tela resolve a adesão.
          */}
          <Route path="/conta/credito-de-anuncio" element={<CreditoDeAnuncioPage />} />
          <Route path="/conta/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Partner area */}
      <Route element={<RequireRole roles={['partner', 'admin']} />}>
        <Route path="/parceiro" element={<PartnerLayout />}>
          <Route index element={<PartnerIndexRedirect />} />
          <Route path="catalogo" element={<PartnerCatalogPage />} />
          <Route path="unidades" element={<PartnerStoresPage />} />
          <Route path="venda" element={<PartnerRedeemPage />} />
          <Route path="afiliados-motoristas" element={<PartnerDriverAffiliatesPage />} />
          <Route
            path="metricas"
            element={
              <StepUpGuard reason="As métricas contêm dados financeiros. Confirme sua senha para continuar.">
                <PartnerMetricsPage />
              </StepUpGuard>
            }
          />
          {/* Programa de afiliados solar (Partner.kind = solar_affiliate) */}
          <Route path="afiliado/carteira" element={<AffiliateWalletPage />} />
          <Route path="afiliado/saque" element={<AffiliateWithdrawalsPage />} />
          <Route path="afiliado/materiais" element={<AffiliateMaterialsPage />} />
          <Route path="afiliado/link" element={<AffiliateLinkPage />} />
          <Route path="perfil" element={<PartnerProfilePage />} />
        </Route>
      </Route>

      {/* Admin area */}
      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="vendas" element={<AdminSalesPage />} />
          <Route path="parceiros" element={<AdminPartnersPage />} />
          <Route path="repasses" element={<AdminPayoutsPage />} />
          <Route path="pagamentos-motoristas" element={<AdminDriverPayoutsPage />} />
          <Route path="unidades" element={<AdminStoresPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="categorias" element={<AdminCategoriesPage />} />
          <Route path="integracoes" element={<AdminIntegrationsPage />} />
          <Route path="auditoria" element={<AdminAuditPage />} />
          <Route path="afiliados/solicitacoes" element={<AdminAffiliateApplicationsPage />} />
          <Route path="afiliados/materiais" element={<AdminCampaignMaterialsPage />} />
          <Route path="afiliados/chaves-api" element={<AdminApiKeysPage />} />
          <Route path="pesquisa" element={<AdminSurveyPage />} />
          <Route path="perfil" element={<AdminProfilePage />} />
          {/* OpenDriver (app de corridas) — API própria, mesmo login */}
          <Route path="opendriver" element={<OpenDriverDashboardPage />} />
          <Route path="opendriver/motoristas" element={<OpenDriverDriversPage />} />
          <Route path="opendriver/corridas" element={<OpenDriverRidesPage />} />
          <Route path="opendriver/saques" element={<OpenDriverPayoutsPage />} />
          <Route path="opendriver/precos" element={<OpenDriverPricingPage />} />
          <Route path="opendriver/categorias-veiculos" element={<OpenDriverVehicleCategoriesPage />} />
          <Route path="opendriver/seguranca" element={<OpenDriverSafetyPage />} />
        </Route>
      </Route>

      {/* Financeiro area */}
      <Route element={<RequireRole roles={['financeiro', 'admin']} />}>
        <Route path="/financeiro" element={<FinanceiroLayout />}>
          <Route index element={<FinanceiroWithdrawalsPage />} />
          <Route path="afiliados" element={<FinanceiroAffiliatesPage />} />
          <Route path="perfil" element={<FinanceiroProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
