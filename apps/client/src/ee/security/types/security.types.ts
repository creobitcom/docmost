import { SSO_PROVIDER } from "@/ee/security/contants.ts";

export interface IAuthProvider {
  id: string;
  name: string;
  type: SSO_PROVIDER;
  samlUrl: string;
  samlCertificate: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  allowSignup: boolean;
  isEnabled: boolean;
  creator_id: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  providerId: string;
}
