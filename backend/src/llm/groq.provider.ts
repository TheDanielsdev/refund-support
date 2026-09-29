import { AiAnalysis, AnalyzeInput, LlmProvider, ReplyInput } from './llm.types';
import { ANALYZE_SYSTEM, REPLY_SYSTEM, analyzeUserContent, replyUserContent } from './prompts';
import { validateAnalysis, validateReply } from './validate';
import { postJson } from './http';

/** Groq exposes an OpenAI-compatible API, so this also works for other OpenAI-style free endpoints. */
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  constructor(private readonly apiKey: string, private readonly model: string, private readonly timeoutMs: number) {}

  private async generate(system: string, user: string): Promise<string> {
    const data = await postJson(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { Authorization: `Bearer ${this.apiKey}` },
      this.timeoutMs,
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq returned no content');
    return text;
  }

  async analyze(input: AnalyzeInput): Promise<AiAnalysis> {
    const raw = await this.generate(ANALYZE_SYSTEM, analyzeUserContent(input));
    return validateAnalysis(raw, input.items.map((i) => i.sku));
  }

  async composeReply(input: ReplyInput): Promise<string> {
    return validateReply(await this.generate(REPLY_SYSTEM, replyUserContent(input)));
  }
}
