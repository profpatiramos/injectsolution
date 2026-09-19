-- Existing photos remain unclassified; they are not evidence of both stages.
ALTER TABLE `order_photos` ADD COLUMN `kind` enum('CAIXA_ABERTA','CAIXA_FECHADA','LEGADO') NOT NULL DEFAULT 'LEGADO';
