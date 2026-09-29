import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { LLM_PROVIDER, LlmProvider } from './llm.types';
import { MockProvider } from './mock.provider';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmProvider => {
        const logger = new Logger('LlmModule');
        const choice = (config.get<string>('LLM_PROVIDER') ?? 'mock').toLowerCase();
        const timeout = Number(config.get('LLM_TIMEOUT_MS') ?? 10000);

        if (choice === 'gemini') {
          const key = config.get<string>('GEMINI_API_KEY');
          if (key) return new GeminiProvider(key, config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash', timeout);
          logger.warn('LLM_PROVIDER=gemini but GEMINI_API_KEY is empty; falling back to mock provider');
        } else if (choice === 'groq') {
          const key = config.get<string>('GROQ_API_KEY');
          if (key) return new GroqProvider(key, config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b', timeout);
          logger.warn('LLM_PROVIDER=groq but GROQ_API_KEY is empty; falling back to mock provider');
        }
        logger.log('Using mock LLM provider');
        return new MockProvider();
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
