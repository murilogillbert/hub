-- CreateIndex
-- Suporta o filtro do job de reconciliação de Pix (paymentService.reconcilePending).
CREATE INDEX "orders_status_payment_method_created_at_idx" ON "orders"("status", "payment_method", "created_at");

-- CreateIndex
-- Todo webhook de pagamento busca por um destes dois campos.
CREATE INDEX "orders_external_payment_id_idx" ON "orders"("external_payment_id");

-- CreateIndex
CREATE INDEX "orders_payment_reference_idx" ON "orders"("payment_reference");

-- CreateIndex
-- paymentService.approve() consulta 2x por orderId dentro da mesma transação.
CREATE INDEX "cashback_entries_order_id_idx" ON "cashback_entries"("order_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
-- Reforça no banco a idempotência que já existe em código (1 lançamento por
-- parceiro por pedido) e acelera a checagem em paymentService.approve().
CREATE UNIQUE INDEX "driver_commission_entries_order_id_partner_id_key" ON "driver_commission_entries"("order_id", "partner_id");
