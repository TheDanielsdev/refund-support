/**
 * First line of defence against prompt injection / policy-bypass attempts.
 * This is heuristic on purpose: it is NOT the only safeguard. Even if a message
 * slips past, the LLM cannot change a decision (the rules engine is the authority).
 */

const MAX_MESSAGE_LENGTH = 1000;

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'ignore_instructions', regex: /(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the)\b[^.\n]{0,40}\b(instructions?|rules?|polic(y|ies)|prompts?|guidelines?)/i },
  { name: 'reveal_prompt', regex: /(reveal|show|print|repeat|output)\b[^.\n]{0,30}\b(system|hidden|initial)\b[^.\n]{0,20}\b(prompt|instructions?|message)/i },
  { name: 'role_reassignment', regex: /\b(you are now|from now on you|act as|pretend (to be|you are)|new role|developer mode|jailbreak|DAN mode)\b/i },
  { name: 'forced_decision', regex: /\b(approve|refund|authori[sz]e)\b[^.\n]{0,30}\b(regardless|no matter what|without (any )?(checks?|review|verification)|immediately|automatically)\b/i },
  { name: 'fake_authority', regex: /\b(i am|i'm|this is)\b[^.\n]{0,20}\b(admin(istrator)?|manager|developer|system|supervisor|the ceo|support agent)\b/i },
  { name: 'markup_or_delimiter', regex: /(<\/?\s*(system|assistant|user|customer_message|instructions?)\s*>|\[\/?INST\]|###\s*(system|instruction))/i },
  { name: 'policy_override_claim', regex: /\b(policy|rule|threshold|limit)\b[^.\n]{0,30}\b(does(n't| not) apply|is (void|suspended|waived)|has been (changed|updated|waived))/i },
];

export interface InjectionScan {
  flagged: boolean;
  matches: string[];
}

export function scanForInjection(text: string): InjectionScan {
  const matches = PATTERNS.filter((p) => p.regex.test(text)).map((p) => p.name);
  return { flagged: matches.length > 0, matches };
}

/** Normalise untrusted input: strip control chars, neutralise our own delimiters, cap length. */
export function sanitizeMessage(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\/?\s*customer_message\s*>/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}
