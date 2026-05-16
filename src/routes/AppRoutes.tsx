import { Navigate, Route, Routes } from 'react-router-dom';
import { ClientLayout } from '@shared/components/Layouts/ClientLayout';
import { PartnerLayout } from '@shared/components/Layouts/PartnerLayout';
import { AdminLayout } from '@shared/components/Layouts/AdminLayout';
import { RequireRole, RedirectIfAuthenticated } from '@shared/components/RouteGuards';
import { StepUpGuard } from '@shared/components/StepUpGuard/StepUpGuard';

import { HomePage } from '@features/client/pages/HomePage';
import { ProductPage } from '@features/client/pages/ProductPage';
import { CheckoutPage } from '@features/client/pages/CheckoutPage';
import { PurchaseConfirmationPage } from '@features/client/pages/PurchaseConfirmationPage';
import { MyItemsPage } from '@features/client/pages/MyItemsPage';
import { HistoryPage } from '@features/client/pages/HistoryPage';
import { ProfilePage } from '@features/client/pages/ProfilePage';

import { LoginPage } from '@features/auth/pages/LoginPage';
import { RegisterChoicePage } from '@features/auth/pages/RegisterChoicePage';
import { RegisterClientPage } from '@features/auth/pages/RegisterClientPage';
import { RegisterPartnerPage } from '@features/auth/pages/RegisterPartnerPage';

import { PartnerCatalogPage } from '@features/partner/pages/PartnerCatalogPage';
import { PartnerRedeemPage } from '@features/partner/pages/PartnerRedeemPage';
import { PartnerMetricsPage } from '@features/partner/pages/PartnerMetricsPage';

import { AdminDashboardPage } from '@features/admin/pages/AdminDashboardPage';
import { AdminSalesPage } from '@features/admin/pages/AdminSalesPage';
import { AdminPartnersPage } from '@features/admin/pages/AdminPartnersPage';
import { AdminUsersPage } from '@features/admin/pages/AdminUsersPage';
import { AdminIntegrationsPage } from '@features/admin/pages/AdminIntegrationsPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Client area + auth (header/footer público) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/produtos" element={<HomePage />} />

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

        <Route path="/produto/:id" element={<ProductPage />} />

        {/* Compra exige login — sem sessão, vai para /login e volta */}
        <Route element={<RequireRole roles={['client', 'admin']} />}>
          <Route path="/checkout/:id" element={<CheckoutPage />} />
          <Route
            path="/compra/confirmacao"
            element={<PurchaseConfirmationPage />}
          />
          <Route path="/conta/itens" element={<MyItemsPage />} />
          <Route path="/conta/historico" element={<HistoryPage />} />
          <Route path="/conta/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Partner area */}
      <Route element={<RequireRole roles={['partner', 'admin']} />}>
        <Route path="/parceiro" element={<PartnerLayout />}>
          <Route index element={<Navigate to="catalogo" replace />} />
          <Route path="catalogo" element={<PartnerCatalogPage />} />
          <Route path="venda" element={<PartnerRedeemPage />} />
          <Route
            path="metricas"
            element={
              <StepUpGuard reason="As métricas contêm dados financeiros. Confirme sua senha para continuar.">
                <PartnerMetricsPage />
              </StepUpGuard>
            }
          />
        </Route>
      </Route>

      {/* Admin area */}
      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="vendas" element={<AdminSalesPage />} />
          <Route path="parceiros" element={<AdminPartnersPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="integracoes" element={<AdminIntegrationsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
