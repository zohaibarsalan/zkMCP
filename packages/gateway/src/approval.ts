import { createHash, timingSafeEqual } from "node:crypto";

export const ZKMCP_APPROVAL_META_KEY = "io.zkmcp/approval-token";

export interface ApprovalRequest {
  token?: string;
  tool: string;
}

export interface ApprovalVerifier {
  isApproved: (request: ApprovalRequest) => boolean | Promise<boolean>;
}

export class DenyAllApprovalVerifier implements ApprovalVerifier {
  isApproved(): boolean {
    return false;
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export class FixedTokenApprovalVerifier implements ApprovalVerifier {
  private readonly expectedDigest: Buffer;

  constructor(token: string) {
    this.expectedDigest = digest(token);
  }

  isApproved(request: ApprovalRequest): boolean {
    if (!request.token) {
      return false;
    }
    return timingSafeEqual(this.expectedDigest, digest(request.token));
  }
}

export function approvalTokenFromMeta(
  meta: Record<string, unknown> | undefined
): string | undefined {
  const value = meta?.[ZKMCP_APPROVAL_META_KEY];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
