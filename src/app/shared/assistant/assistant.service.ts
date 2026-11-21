import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../../services/api.service';
import type { AppLanguage } from '../../services/app-i18n.service';

/**
 * App assistant (Ask panel, Ctrl+K), phase A0 of the workspace assessment
 * `docs/handoffs/2026-11-21-app-ai-assistant-assessment.md`. The API answers from product
 * knowledge only and scopes every conversation to the signed-in user in the active tenant; this
 * service only calls `/assistant/*`. Links are App routes built by the API.
 */
export type AssistantLink = {
  kind: 'screen' | 'article';
  title: string;
  route: string | null;
  menuPath: string | null;
};

export type AssistantMessage = {
  messageUUID: string;
  role: 'user' | 'assistant';
  text: string;
  links: AssistantLink[];
  outcome: string | null;
  followUps?: string[];
  createdAt?: string | null;
};

export type AssistantConversation = {
  conversationUUID: string;
  title: string;
  route: string | null;
  messageCount: number;
  lastMessageAt: string | null;
};

type Envelope<T> = { data: T };

export function assistantLocale(language: AppLanguage): 'pt-BR' | 'en' | 'es' {
  if (language === 'en-US') return 'en';
  if (language === 'es-ES') return 'es';
  return 'pt-BR';
}

/** Internal App path only; anything else is never navigated to. */
export function safeAssistantRoute(route: string | null | undefined): string | null {
  if (typeof route !== 'string') return null;
  const value = route.trim();
  return value.startsWith('/') && !value.startsWith('//') && !/[\s\\]/.test(value) ? value : null;
}

/** Error code of a failed ask (problem+json `code`, HTTP status otherwise). */
export function assistantErrorCode(error: unknown): string {
  const err = error as { status?: number; error?: { code?: string } } | null;
  if (err?.error?.code) return String(err.error.code);
  if (err?.status === 409) return 'AI_ASSISTANT_CONVERSATION_FULL';
  if (err?.status === 404) return 'AI_ASSISTANT_NOT_FOUND';
  return 'AI_PROVIDER_ERROR';
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly api = inject(ApiService);

  /** null = not checked yet. */
  readonly available = signal<boolean | null>(null);

  async refreshStatus(): Promise<boolean> {
    try {
      const response = await this.api.get<Envelope<{ available: boolean }>>('assistant/status', {
        silent: true,
      });
      this.available.set(Boolean(response?.data?.available));
    } catch {
      this.available.set(false);
    }
    return Boolean(this.available());
  }

  async conversations(): Promise<AssistantConversation[]> {
    const response = await this.api.get<Envelope<{ items: AssistantConversation[] }>>(
      'assistant/conversations?limit=20&offset=0',
      { silent: true },
    );
    return response?.data?.items ?? [];
  }

  async conversation(uuid: string) {
    const response = await this.api.get<
      Envelope<{ conversation: AssistantConversation; messages: AssistantMessage[] }>
    >(`assistant/conversations/${encodeURIComponent(uuid)}`, { silent: true });
    return response.data;
  }

  async start(question: string, route: string | null, language: AppLanguage) {
    const response = await this.api.post<
      Envelope<{
        conversation: AssistantConversation;
        question: AssistantMessage;
        answer: AssistantMessage;
      }>
    >(
      'assistant/conversations',
      { question, route: safeAssistantRoute(route), locale: assistantLocale(language) },
      { silent: true },
    );
    return response.data;
  }

  async ask(uuid: string, question: string, route: string | null, language: AppLanguage) {
    const response = await this.api.post<
      Envelope<{ question: AssistantMessage; answer: AssistantMessage }>
    >(
      `assistant/conversations/${encodeURIComponent(uuid)}/messages`,
      { question, route: safeAssistantRoute(route), locale: assistantLocale(language) },
      { silent: true },
    );
    return response.data;
  }

  async remove(uuid: string): Promise<void> {
    await this.api.delete(`assistant/conversations/${encodeURIComponent(uuid)}`);
  }
}
