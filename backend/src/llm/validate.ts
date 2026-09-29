import { ClaimType } from '@prisma/client';
import { AiAnalysis } from './llm.types';

const CLAIM_TYPES = new Set<string>(Object.values(ClaimType));

function parseJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

/** Never trust model output: validate shape and constrain values to known ones. */
export function validateAnalysis(raw: string, allowedSkus: string[]): AiAnalysis {
  const data = parseJson(raw);
  const claimType = CLAIM_TYPES.has(data?.claimType) ? (data.claimType as ClaimType) : ClaimType.OTHER;
  const mentionedSkus = Array.isArray(data?.mentionedSkus)
    ? data.mentionedSkus.filter((s: unknown): s is string => typeof s === 'string' && allowedSkus.includes(s))
    : [];
  return {
    claimType,
    mentionedSkus,
    suspicious: data?.suspicious === true,
    suspicionReason: typeof data?.suspicionReason === 'string' ? data.suspicionReason.slice(0, 300) : null,
  };
}

export function validateReply(raw: string): string {
  const data = parseJson(raw);
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  if (!reply) throw new Error('Empty reply from model');
  if (/https?:\/\/|www\./i.test(reply)) throw new Error('Reply contained a link');
  return reply.slice(0, 800);
}
