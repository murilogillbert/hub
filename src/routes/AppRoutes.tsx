import { Navigate, Route, Routes } from 'react-router-dom';
import { ClientLayout } from '@shared/components/Layouts/ClientLayout';
import { PartnerLayout, PartnerIndexRedirect } from '@shared/components/Layouts/PartnerLayout';
import { AdminLayout } from '@shared/components/Layouts/AdminLayout';
import { FinanceiroLayout } from '@shared/components/Layouts/FinanceiroLayout';
import { RequireRole, RedirectIfAuthenticated } from '@shared/components/RouteGuards';
import { StepUpGuard } from '@shared/components/StepUpGuard/StepUpGuard';

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

import { PartnerCatalogPage } from '@features/partner/pages/PartnerCatalogPage';
import { PartnerRedeemPage } from '@features/partner/pages/PartnerRedeemPage';
import { PartnerMetricsPage } from '@features/partner/pages/PartnerMetricsPage';
import { PartnerStoresPage } from '@features/partner/pages/PartnerStoresPage';
import { PartnerProfilePage } from '@features/partner/pages/PartnerProfilePage';
import { AffiliateWalletPage } from '@features/partner/pages/affiliate/AffiliateWalletPage';
import { AffiliateWithdrawalsPage } from '@features/partner/pages/affiliate/AffiliateWithdrawalsPage';
import { AffiliateMaterialsPage } from '@features/partner/pages/affiliate/AffiliateMaterialsPage';
import { AffiliateLinkPage } from '@features/partner/pages/affiliate/AffiliateLinkPage';

import { AdminDashboardPage } from '@features/admin/pages/AdminDashboardPage';
import { AdminSalesPage } from '@features/admin/pages/AdminSalesPage';
import { AdminPartnersPage } from '@features/admin/pages/AdminPartnersPage';
import { AdminPayoutsPage } from '@features/admin/pages/AdminPayoutsPage';
import { AdminStoresPage } from '@features/admin/pages/AdminStoresPage';
import { AdminUsersPage } from '@features/admin/pages/AdminUsersPage';
import { AdminIntegrationsPage } from '@features/admin/pages/AdminIntegrationsPage';
import { AdminCategoriesPage } from '@features/admin/pages/AdminCategoriesPage';
import { AdminAuditPage } from '@features/admin/pages/AdminAuditPage';
import { AdminAffiliateApplicationsPage } from '@features/admin/pages/AdminAffiliateApplicationsPage';
import { AdminCampaignMaterialsPage } from '@features/admin/pages/AdminCampaignMaterialsPage';
import { AdminApiKeysPage } from '@features/admin/pages/AdminApiKeysPage';
import { AdminProfilePage } from '@features/admin/pages/AdminProfilePage';

import { FinanceiroWithdrawalsPage } from '@features/financeiro/pages/FinanceiroWithdrawalsPage';
import { FinanceiroAffiliatesPage } from '@features/financeiro/pages/FinanceiroAffiliatesPage';
import { FinanceiroProfilePage } from '@features/financeiro/pages/FinanceiroProfilePage';

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
          path="/cadastro/cliente"
          element={
            <RedirectIfAuthenticated>
              <RegisterClientPage />
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

        {/* Compra exige login — sem sessão, vai para /login e volta */}
        <Route element={<RequireRole roles={['client', 'admin']} />}>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/:id" element={<CheckoutPage />} />
          <Route path="/compra/confirmacao/:id" element={<PurchaseConfirmationPage />} />
          <Route path="/conta/itens" element={<MyItemsPage />} />
          <Route path="/meus-itens/:id" element={<OrderDetailPage />} />
          <Route path="/conta/historico" element={<HistoryPage />} />
          <Route path="/conta/cashback" element={<CashbackPage />} />
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
          <Route path="unidades" element={<AdminStoresPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="categorias" element={<AdminCategoriesPage />} />
          <Route path="integracoes" element={<AdminIntegrationsPage />} />
          <Route path="auditoria" element={<AdminAuditPage />} />
          <Route path="afiliados/solicitacoes" element={<AdminAffiliateApplicationsPage />} />
          <Route path="afiliados/materiais" element={<AdminCampaignMaterialsPage />} />
          <Route path="afiliados/chaves-api" element={<AdminApiKeysPage />} />
          <Route path="perfil" element={<AdminProfilePage />} />
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
