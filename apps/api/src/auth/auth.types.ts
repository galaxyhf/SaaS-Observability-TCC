export interface AuthenticatedUser {
  email: string;
  id: string;
  name: string;
}

export interface AccessTokenPayload {
  email: string;
  name: string;
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sid: string;
  sub: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
