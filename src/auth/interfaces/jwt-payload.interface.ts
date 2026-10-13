export interface JwtPayload {
  sub: number;
  sid: string;
  jti: string;
  tokenUse: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
