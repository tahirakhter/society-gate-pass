import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiClientService extends OpenAI {
  constructor(config: ConfigService) {
    super({ apiKey: config.get<string>('OPENAI_API_KEY') });
  }
}
