import jwt from 'jsonwebtoken';

export function signJwt(payload: any): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });
}
