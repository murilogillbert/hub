-- DataMigration
-- Só linhas com role = 'Client' são tocadas; Partner/Admin/Financeiro ficam
-- intactas. Decisão explícita do usuário: todo cadastro Client existente
-- vira Motorista (Driver) neste split de papéis.
--
-- IMPORTANTE: aplicar em produção só DEPOIS que o código que já entende
-- Passenger/Driver (backend + frontend) estiver no ar — ver plano da fase.
UPDATE "users" SET "role" = 'Driver' WHERE "role" = 'Client';
