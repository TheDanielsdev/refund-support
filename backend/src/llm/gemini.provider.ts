import { AiAnalysis, AnalyzeInput, LlmProvider, ReplyInput } from './llm.types';
import { ANALYZE_SYSTEM, REPLY_SYSTEM, analyzeUserContent, replyUserContent } from './prompts';
import { validateAnalysis, validateReply } from './validate';
import { postJson } from './http';

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  constructor(private readonly apiKey: string, private readonly model: string, private readonly timeoutMs: number) {}

  private async generate(system: string, user: string, schema: object): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const data = await postJson(
      url,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      },
      { 'x-goog-api-key': this.apiKey },
      this.timeoutMs,
    );
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('');
    if (!text) throw new Error('Gemini returned no content');
    return text;
  }

  async analyze(input: AnalyzeInput): Promise<AiAnalysis> {
    const raw = await this.generate(ANALYZE_SYSTEM, analyzeUserContent(input), {
      type: 'OBJECT',
      properties: {
        claimType: { type: 'STRING', enum: ['CHANGE_OF_MIND', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'OTHER'] },
        mentionedSkus: { type: 'ARRAY', items: { type: 'STRING' } },
        suspicious: { type: 'BOOLEAN' },
        suspicionReason: { type: 'STRING', nullable: true },
      },
      required: ['claimType', 'mentionedSkus', 'suspicious'],
    });
    return validateAnalysis(raw, input.items.map((i) => i.sku));
  }

  async composeReply(input: ReplyInput): Promise<string> {
    const raw = await this.generate(REPLY_SYSTEM, replyUserContent(input), {
      type: 'OBJECT',
      properties: { reply: { type: 'STRING' } },
      required: ['reply'],
    });
    return validateReply(raw);
  }
}
