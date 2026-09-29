import { ClaimType, Decision } from '@prisma/client';
import { AiAnalysis, AnalyzeInput, LlmProvider, ReplyInput } from './llm.types';

/** Keyword classifier. Used by the mock provider AND as the fallback when a real LLM is unavailable. */
export function heuristicAnalyze(input: AnalyzeInput): AiAnalysis {
  const text = input.message.toLowerCase();
  let claimType: ClaimType = ClaimType.CHANGE_OF_MIND;
  if (/(damag|broke|broken|crack|defect|faulty|smashed|torn|scratch)/.test(text)) claimType = ClaimType.DAMAGED;
  else if (/(wrong (item|size|colou?r|product)|incorrect|not what i ordered|different (item|product))/.test(text)) claimType = ClaimType.WRONG_ITEM;
  else if (/(never (arrived|came|received)|not (arrived|received|delivered)|didn'?t (arrive|receive)|haven'?t received|missing)/.test(text)) claimType = ClaimType.NOT_RECEIVED;
  else if (!/(return|refund|money back|don'?t (want|like)|changed my mind|too (big|small))/.test(text)) claimType = ClaimType.OTHER;

  const mentionedSkus = input.items
    .filter((i) => {
      const words = i.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      return text.includes(i.name.toLowerCase()) || (words.length > 0 && words.every((w) => text.includes(w)));
    })
    .map((i) => i.sku);

  return { claimType, mentionedSkus, suspicious: false, suspicionReason: null };
}

export function templateReply(input: ReplyInput): string {
  const amount = `$${(input.refundCents / 100).toFixed(2)}`;
  switch (input.decision) {
    case Decision.APPROVED:
      return `Good news: your refund of ${amount} has been approved. ${input.customerReason} Thank you for your patience.`;
    case Decision.DENIED:
      return `Thanks for getting in touch. Unfortunately we can't approve this refund. ${input.customerReason}`;
    default:
      return `Thanks for your request. ${input.customerReason} We'll be in touch as soon as it has been reviewed.`;
  }
}

export class MockProvider implements LlmProvider {
  readonly name = 'mock';
  async analyze(input: AnalyzeInput) {
    return heuristicAnalyze(input);
  }
  async composeReply(input: ReplyInput) {
    return templateReply(input);
  }
}
