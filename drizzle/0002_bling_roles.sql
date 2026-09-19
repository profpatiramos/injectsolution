ALTER TABLE `users`
  ADD COLUMN `workspaceOwnerId` int NULL AFTER `role`;

CREATE INDEX `users_workspace_owner_idx` ON `users` (`workspaceOwnerId`);

ALTER TABLE `orders`
  ADD COLUMN `blingOrderId` varchar(120) NULL AFTER `blingOrderNumber`;

CREATE INDEX `orders_bling_id_idx` ON `orders` (`ownerId`, `blingOrderId`);

ALTER TABLE `bling_integrations`
  ADD COLUMN `accessToken` text NULL AFTER `externalAccountId`,
  ADD COLUMN `refreshToken` text NULL AFTER `accessToken`,
  ADD COLUMN `accessTokenExpiresAt` timestamp NULL AFTER `refreshToken`,
  ADD COLUMN `oauthState` varchar(160) NULL AFTER `accessTokenExpiresAt`;
