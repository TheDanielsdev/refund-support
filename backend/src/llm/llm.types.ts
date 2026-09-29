import { ClaimType, Decision } from '@prisma/client';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface AnalyzeInput {
  message: string;
  items: { sku: string; name: string }[];
}

export interface AiAnalysis {
  claimType: ClaimType;
  mentionedSkus: string[];
  suspicious: boolean;
  suspicionReason: string | null;
}

export interface ReplyInput {
  decision: Decision;
  refundCents: number;
  customerReason: string;
  message: string;
}

export interface LlmProvider {
  readonly name: string;
  analyze(input: AnalyzeInput): Promise<AiAnalysis>;
  composeReply(input: ReplyInput): Promise<string>;
}
