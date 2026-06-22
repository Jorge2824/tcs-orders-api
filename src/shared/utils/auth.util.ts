import { envConfig } from '../../config/env.config';

export function isValidBearerToken(token: string): boolean {
  return token === envConfig.auth.bearerToken;
}
