import { prisma } from '../config/database';
import { decrypt } from './crypto';
import { IntegrationProvider } from '@prisma/client';

export async function getIntegrationKeys(provider: IntegrationProvider, environment: string = 'production') {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider_environment: { provider, environment } },
  });

  if (!config) return null;

  return {
    publicKey: config.public_key_enc ? decrypt(config.public_key_enc) : null,
    secretKey: config.secret_key_enc ? decrypt(config.secret_key_enc) : null,
    extraConfig: config.extra_config_enc ? JSON.parse(decrypt(config.extra_config_enc)) : {},
  };
}
