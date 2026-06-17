# 第三方 API Provider 功能完善实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已有的"第三方 API provider"骨架真正跑通——用户在设置里选 provider(OpenAI/DeepSeek/Anthropic/OpenRouter/Qwen/Kimi/Custom)、填 key、用其模型发消息,完全替代现有 OpenAI-compatible 模式。

**Architecture:** `thirdPartyApi` 成为 active provider 配置的唯一真相。发送层按 `provider.protocol` 分流(openai-compatible 复用现有发送函数,anthropic 新写适配器)。UI 用新 `ThirdPartyApiSettingsPanel` 替换现有面板,复用 ApiKeyInput/ModelListEditor/ApiConnectionTester 组件。

**Tech Stack:** TypeScript + React + fetch + SSE 手动解析(无第三方依赖)。

**参照代码(spec):** `docs/superpowers/specs/2026-06-14-third-party-api-provider-design.md`

---

## File Structure

| 文件                                                                         | 操作 | 责任                                                        |
| ---------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `src/utils/thirdPartyApiActive.ts`                                           | 新建 | `isThirdPartyApiActive()` 判断                              |
| `src/services/api/anthropicUrls.ts`                                          | 新建 | URL 构建(messages/models)                                   |
| `src/services/api/anthropicTypes.ts`                                         | 新建 | 类型 + usage 映射                                           |
| `src/services/api/anthropicMessages.ts`                                      | 新建 | 请求体构建(history→Anthropic messages)                      |
| `src/services/api/anthropicResponses.ts`                                     | 新建 | 响应/错误解析                                               |
| `src/services/api/anthropicStream.ts`                                        | 新建 | SSE 流解析                                                  |
| `src/services/api/anthropicApi.ts`                                           | 新建 | sendAnthropicMessageStream/NonStream + fetchAnthropicModels |
| `src/features/message-sender/standardChatApiCall.ts`                         | 修改 | 按 provider.protocol 分流                                   |
| `src/hooks/app/useApp.ts`                                                    | 修改 | 用 buildProviderAwareModelList                              |
| `src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx` | 新建 | 替换 OpenAICompatibleApiSettingsPanel                       |
| `src/components/settings/SettingsContent.tsx`                                | 修改 | apiMode/thirdParty 切换                                     |
| `src/hooks/settings/useSettingsLogic.ts`                                     | 修改 | 测试连接按 protocol 分流                                    |
| `src/stores/settingsStore.ts`                                                | 修改 | sanitize apiMode 归一                                       |
| `src/i18n/translations/settings/api.ts`                                      | 修改 | provider 名称 + 文案                                        |

**任务依赖顺序:** Task 1(判断函数) → Task 2-8(Anthropic 适配器,逐模块) → **Task 8b(key 解析接入,关键)** → Task 9(发送分流) → Task 10(模型列表) → Task 11(sanitize) → Task 13(UI 面板) → Task 14(SettingsContent 接线) → Task 15(连接测试) → Task 16(全量验证)。

> **关键前置发现:** `getKeyForRequest()`(在 `src/utils/apiKeySelection.ts`)通过 `resolveApiKeyRequestMode()` + `getActiveApiConfig()` 解析 API key——它们目前用 `isOpenAICompatibleApiActive()` 读 `openaiCompatibleApiKey`。第三方模式必须让这条链路读 `activeProvider.apiKey`,否则 `keyToUse` 会拿错 key(或直接报 "API Key not configured")。这是 Task 8b,必须在 Task 9(发送分流)之前完成。

---

## Task 1: isThirdPartyApiActive 判断函数

**Files:**

- Create: `src/utils/thirdPartyApiActive.ts`
- Test: `src/utils/thirdPartyApiActive.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/utils/thirdPartyApiActive.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { isThirdPartyApiActive } from './thirdPartyApiActive';
import { createAppSettings } from '@/test/data/factories';

describe('isThirdPartyApiActive', () => {
  it('returns true when third-party mode is enabled and active', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'third-party' });
    expect(isThirdPartyApiActive(settings)).toBe(true);
  });

  it('returns false when enabled but apiMode is gemini-native', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'gemini-native' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });

  it('returns false when apiMode is third-party but not enabled', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: false, apiMode: 'third-party' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });

  it('returns false for legacy openai-compatible apiMode', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'openai-compatible' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/utils/thirdPartyApiActive.test.ts`
Expected: FAIL — `isThirdPartyApiActive is not a function`

- [ ] **Step 3: 实现**

新建 `src/utils/thirdPartyApiActive.ts`:

```typescript
import type { AppSettings } from '@/types';

type ThirdPartyApiActiveSettings = Pick<AppSettings, 'apiMode' | 'isThirdPartyApiEnabled'>;

export const isThirdPartyApiActive = (settings: ThirdPartyApiActiveSettings): boolean =>
  settings.isThirdPartyApiEnabled === true && settings.apiMode === 'third-party';
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/utils/thirdPartyApiActive.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 提交**

```bash
git add src/utils/thirdPartyApiActive.ts src/utils/thirdPartyApiActive.test.ts
git commit -m "feat(third-party): add isThirdPartyApiActive helper"
```

---

## Task 2: Anthropic URL 构建

**Files:**

- Create: `src/services/api/anthropicUrls.ts`
- Test: `src/services/api/anthropicUrls.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicUrls.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildAnthropicMessagesUrl, buildAnthropicModelsUrl, normalizeAnthropicBaseUrl } from './anthropicUrls';

describe('anthropicUrls', () => {
  it('normalizes by trimming trailing slashes', () => {
    expect(normalizeAnthropicBaseUrl('https://api.anthropic.com/')).toBe('https://api.anthropic.com');
  });

  it('falls back to default base url when empty', () => {
    expect(normalizeAnthropicBaseUrl(null)).toBe('https://api.anthropic.com');
    expect(normalizeAnthropicBaseUrl('  ')).toBe('https://api.anthropic.com');
  });

  it('builds messages url with /v1/messages', () => {
    expect(buildAnthropicMessagesUrl('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/messages');
  });

  it('builds models url with /v1/models', () => {
    expect(buildAnthropicModelsUrl('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/models');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicUrls.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicUrls.ts`:

```typescript
export const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export const normalizeAnthropicBaseUrl = (baseUrl?: string | null): string =>
  (baseUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL).replace(/\/+$/, '');

export const buildAnthropicMessagesUrl = (baseUrl?: string | null): string =>
  `${normalizeAnthropicBaseUrl(baseUrl)}/v1/messages`;

export const buildAnthropicModelsUrl = (baseUrl?: string | null): string =>
  `${normalizeAnthropicBaseUrl(baseUrl)}/v1/models`;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicUrls.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicUrls.ts src/services/api/anthropicUrls.test.ts
git commit -m "feat(anthropic): add URL builders"
```

---

## Task 3: Anthropic 类型 + usage 映射

**Files:**

- Create: `src/services/api/anthropicTypes.ts`
- Test: `src/services/api/anthropicTypes.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicTypes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { asAnthropicChatConfig, mapAnthropicUsage } from './anthropicTypes';

describe('anthropicTypes', () => {
  it('extracts config from unknown, defaulting to empty', () => {
    expect(asAnthropicChatConfig(null)).toEqual({});
    expect(asAnthropicChatConfig({ baseUrl: 'https://x' })).toEqual({ baseUrl: 'https://x' });
  });

  it('maps usage input/output tokens to Gemini-style usage', () => {
    const usage = mapAnthropicUsage({ input_tokens: 10, output_tokens: 5 });
    expect(usage).toEqual({
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    });
  });

  it('returns undefined when usage missing', () => {
    expect(mapAnthropicUsage(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicTypes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicTypes.ts`:

```typescript
import type { UsageMetadata } from '@google/genai';

export interface AnthropicChatConfig {
  baseUrl?: string | null;
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

// Non-stream response
export type AnthropicResponsePayload = {
  id?: string;
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  usage?: AnthropicUsage;
  error?: { message?: string };
};

// SSE stream event payload (the `message_start` / `content_block_delta` / `message_delta` etc.)
export type AnthropicStreamEvent = {
  type: string;
  message?: AnthropicResponsePayload;
  delta?: { type?: string; text?: string };
  usage?: AnthropicUsage;
};

export type AnthropicModelsResponsePayload = {
  data?: Array<{ id?: unknown }>;
  error?: { message?: string };
};

export const asAnthropicChatConfig = (config: unknown): AnthropicChatConfig =>
  typeof config === 'object' && config !== null ? (config as AnthropicChatConfig) : {};

export const mapAnthropicUsage = (usage?: AnthropicUsage): UsageMetadata | undefined => {
  if (!usage) {
    return undefined;
  }
  const prompt = usage.input_tokens ?? 0;
  const completion = usage.output_tokens ?? 0;
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: completion,
    totalTokenCount: prompt + completion,
  } as UsageMetadata;
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicTypes.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicTypes.ts src/services/api/anthropicTypes.test.ts
git commit -m "feat(anthropic): add types and usage mapping"
```

---

## Task 4: Anthropic 请求体构建

**Files:**

- Create: `src/services/api/anthropicMessages.ts`
- Test: `src/services/api/anthropicMessages.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicMessages.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ChatHistoryItem } from '@/types';
import type { Part } from '@google/genai';
import { buildAnthropicRequestBody } from './anthropicMessages';

const history: ChatHistoryItem[] = [
  { role: 'user', parts: [{ text: 'Hello' }] },
  { role: 'model', parts: [{ text: 'Hi there' }] },
];

describe('buildAnthropicRequestBody', () => {
  it('extracts system instruction to top-level system field', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      { systemInstruction: 'Be helpful', temperature: 0.5 },
      'user',
      false,
    );
    expect(body.system).toBe('Be helpful');
    expect(body.temperature).toBe(0.5);
  });

  it('maps history roles: model->assistant, user stays user', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      {},
      'user',
      false,
    ) as { messages: Array<{ role: string }> };
    const roles = body.messages.map((m) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });

  it('omits system field when no system instruction', () => {
    const body = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(body.system).toBeUndefined();
  });

  it('includes stream flag and max_tokens', () => {
    const bodyStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', true);
    expect(bodyStream.stream).toBe(true);
    expect(bodyStream.max_tokens).toBeGreaterThan(0);
    const bodyNoStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(bodyNoStream.stream).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicMessages.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicMessages.ts`:

```typescript
import type { Part } from '@google/genai';
import type { ChatHistoryItem } from '@/types';
import { isImageMimeType } from '@/utils/fileTypeClassification';
import type { AnthropicChatConfig, AnthropicContentBlock, AnthropicMessage } from './anthropicTypes';

const ANTHROPIC_FILE_DATA_ERROR = 'Anthropic mode cannot send Gemini Files API file references.';

const partToAnthropicContentItems = (part: Part): AnthropicContentBlock[] => {
  const partWithMedia = part as Part & {
    inlineData?: { mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
  };

  if (typeof part.text === 'string') {
    return part.text ? [{ type: 'text', text: part.text }] : [];
  }

  if (partWithMedia.fileData) {
    throw new Error(ANTHROPIC_FILE_DATA_ERROR);
  }

  const inlineData = partWithMedia.inlineData;
  const mimeType = inlineData?.mimeType;
  if (inlineData?.data && mimeType && isImageMimeType(mimeType)) {
    return [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: inlineData.data },
      },
    ];
  }

  if (inlineData?.data) {
    throw new Error(`Anthropic mode cannot send inline ${mimeType || 'media'} attachments.`);
  }

  return [];
};

const partsToAnthropicContent = (parts: Part[]): string | AnthropicContentBlock[] => {
  const items = parts.flatMap(partToAnthropicContentItems);
  const hasOnlyText = items.every((item) => item.type === 'text');
  if (hasOnlyText) {
    return items
      .map((item) => (item.type === 'text' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return items;
};

const hasAnthropicContent = (content: string | AnthropicContentBlock[]) =>
  typeof content === 'string' ? content.trim().length > 0 : content.length > 0;

const buildAnthropicMessages = (
  history: ChatHistoryItem[],
  parts: Part[],
  role: 'user' | 'model',
): AnthropicMessage[] => {
  const messages: AnthropicMessage[] = [];
  for (const item of history) {
    const content = partsToAnthropicContent(item.parts);
    if (!hasAnthropicContent(content)) continue;
    messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content });
  }
  const currentContent = partsToAnthropicContent(parts);
  if (hasAnthropicContent(currentContent)) {
    messages.push({ role: role === 'model' ? 'assistant' : 'user', content: currentContent });
  }
  return messages;
};

export const buildAnthropicRequestBody = (
  modelId: string,
  history: ChatHistoryItem[],
  parts: Part[],
  config: AnthropicChatConfig,
  role: 'user' | 'model',
  stream: boolean,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: buildAnthropicMessages(history, parts, role),
    stream,
    max_tokens: 8192,
  };

  const systemInstruction = config.systemInstruction?.trim();
  if (systemInstruction) {
    body.system = systemInstruction;
  }
  if (typeof config.temperature === 'number') {
    body.temperature = config.temperature;
  }
  if (typeof config.topP === 'number') {
    body['top_p'] = config.topP;
  }
  return body;
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicMessages.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicMessages.ts src/services/api/anthropicMessages.test.ts
git commit -m "feat(anthropic): add request body builder"
```

---

## Task 5: Anthropic 响应/错误解析

**Files:**

- Create: `src/services/api/anthropicResponses.ts`
- Test: `src/services/api/anthropicResponses.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicResponses.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { extractAnthropicMessageText, readAnthropicErrorMessage } from './anthropicResponses';
import type { AnthropicResponsePayload } from './anthropicTypes';

describe('anthropicResponses', () => {
  it('joins text content blocks', () => {
    const payload: AnthropicResponsePayload = {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractAnthropicMessageText(payload)).toBe('Hello world');
  });

  it('returns empty string when no content blocks', () => {
    expect(extractAnthropicMessageText({})).toBe('');
  });

  it('reads error message from JSON body', async () => {
    const response = new Response(JSON.stringify({ error: { message: 'Invalid key' } }), { status: 401 });
    expect(await readAnthropicErrorMessage(response)).toBe('Invalid key');
  });

  it('falls back to status text when body empty', async () => {
    const response = new Response('', { status: 500 });
    const msg = await readAnthropicErrorMessage(response);
    expect(msg).toContain('500');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicResponses.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicResponses.ts`:

```typescript
import type { AnthropicResponsePayload } from './anthropicTypes';

export const readAnthropicErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text) {
    return `Anthropic request failed with status ${response.status}`;
  }
  try {
    const parsed = JSON.parse(text) as AnthropicResponsePayload;
    return parsed.error?.message || text;
  } catch {
    return text;
  }
};

export const extractAnthropicMessageText = (payload: AnthropicResponsePayload): string => {
  if (!Array.isArray(payload.content)) {
    return '';
  }
  return payload.content
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('');
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicResponses.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicResponses.ts src/services/api/anthropicResponses.test.ts
git commit -m "feat(anthropic): add response and error parsing"
```

---

## Task 6: Anthropic SSE 流解析

**Files:**

- Create: `src/services/api/anthropicStream.ts`
- Test: `src/services/api/anthropicStream.test.ts`

> Anthropic SSE 与 OpenAI 不同:每个事件有 `event:` 行和 `data:` 行。需解析 `event` 类型 + `data` JSON。本轮只消费 `content_block_delta`(文本增量)和 `message_delta`(usage),`message_start`/`message_stop` 用于流程控制。

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicStream.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { parseAnthropicSseEvents } from './anthropicStream';

describe('parseAnthropicSseEvents', () => {
  it('parses event + data pairs into typed events', () => {
    const buffer = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      '',
      '',
    ].join('\n');
    const { events, rest } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hi' },
    });
    expect(rest).toBe('');
  });

  it('keeps partial event in rest buffer', () => {
    const buffer = 'event: content_block_delta\ndata: {"type":"content_block_delta"';
    const { events, rest } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(0);
    expect(rest).toBe(buffer);
  });

  it('handles multiple events in one buffer', () => {
    const buffer = [
      'event: ping',
      'data: {"type":"ping"}',
      '',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n');
    const { events } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('ping');
    expect(events[1].type).toBe('message_stop');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicStream.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicStream.ts`:

```typescript
import type { AnthropicStreamEvent } from './anthropicTypes';

export const parseAnthropicSseEvents = (buffer: string): { events: AnthropicStreamEvent[]; rest: string } => {
  const events: AnthropicStreamEvent[] = [];
  let searchStart = 0;
  let boundaryIndex = buffer.indexOf('\n\n', searchStart);

  while (boundaryIndex !== -1) {
    const rawEvent = buffer.slice(searchStart, boundaryIndex);
    const dataLines = rawEvent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (dataLines && dataLines !== '[DONE]') {
      try {
        events.push(JSON.parse(dataLines) as AnthropicStreamEvent);
      } catch {
        // skip malformed
      }
    }

    searchStart = boundaryIndex + 2;
    boundaryIndex = buffer.indexOf('\n\n', searchStart);
  }

  return { events, rest: buffer.slice(searchStart) };
};

export const readAnthropicStreamEvents = async (
  response: Response,
  abortSignal: AbortSignal,
  onEvent: (event: AnthropicStreamEvent) => void,
): Promise<void> => {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done || abortSignal.aborted) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const parsed = parseAnthropicSseEvents(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === 'message_stop') {
        return;
      }
    }
  }

  const tail = decoder.decode();
  if (tail) {
    buffer += tail.replace(/\r\n/g, '\n');
  }
  const parsed = parseAnthropicSseEvents(`${buffer}\n\n`);
  for (const event of parsed.events) {
    onEvent(event);
  }
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicStream.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicStream.ts src/services/api/anthropicStream.test.ts
git commit -m "feat(anthropic): add SSE stream parser"
```

---

## Task 7: Anthropic 发送函数 + fetchAnthropicModels

**Files:**

- Create: `src/services/api/anthropicApi.ts`
- Test: `src/services/api/anthropicApi.test.ts`

> 头部:`x-api-key: <key>` + `anthropic-version: 2023-06-01` + `content-type: application/json`。流式:消费 `content_block_delta` 的 `delta.text`,`message_delta`/`message_start` 的 `usage`。

- [ ] **Step 1: 写失败测试**

新建 `src/services/api/anthropicApi.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendAnthropicMessageNonStream, sendAnthropicMessageStream, fetchAnthropicModels } from './anthropicApi';

const mockResponse = (body: BodyInit, init?: ResponseInit) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/json' }, ...init });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendAnthropicMessageNonStream', () => {
  it('sends POST with x-api-key header and returns text on complete', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ content: [{ type: 'text', text: 'Hello' }] })),
    );
    const onComplete = vi.fn();
    await sendAnthropicMessageNonStream(
      'sk-key',
      'claude-sonnet-4-6',
      [],
      [{ text: 'hi' }],
      { baseUrl: 'https://api.anthropic.com' },
      new AbortController().signal,
      vi.fn(),
      onComplete,
      'user',
    );
    expect(onComplete).toHaveBeenCalled();
    const parts = onComplete.mock.calls[0][0];
    expect(parts).toEqual([{ text: 'Hello' }]);
    // verify x-api-key header
    const callInit = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((callInit.headers as Record<string, string>)['x-api-key']).toBe('sk-key');
  });

  it('calls onError on non-ok response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ error: { message: 'bad' } }), { status: 401 }),
    );
    const onError = vi.fn();
    await sendAnthropicMessageNonStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      onError,
      vi.fn(),
    );
    expect(onError).toHaveBeenCalled();
    expect((onError.mock.calls[0][0] as Error).message).toBe('bad');
  });
});

describe('sendAnthropicMessageStream', () => {
  it('streams text deltas via onPart', async () => {
    const sseBody = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi "}}',
      '',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}',
      '',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(sseBody, { status: 200 }));
    const onPart = vi.fn();
    await sendAnthropicMessageStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      onPart,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    expect(onPart).toHaveBeenCalledTimes(2);
    expect(onPart.mock.calls[0][0]).toEqual({ text: 'Hi ' });
    expect(onPart.mock.calls[1][0]).toEqual({ text: 'there' });
  });
});

describe('fetchAnthropicModels', () => {
  it('returns deduped model options', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ data: [{ id: 'claude-a' }, { id: 'claude-a' }, { id: 'claude-b' }] })),
    );
    const models = await fetchAnthropicModels('k', 'https://api.anthropic.com', new AbortController().signal);
    expect(models).toEqual([
      { id: 'claude-a', name: 'claude-a' },
      { id: 'claude-b', name: 'claude-b' },
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/services/api/anthropicApi.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

新建 `src/services/api/anthropicApi.ts`:

```typescript
import type { UsageMetadata } from '@google/genai';
import type { ModelOption, NonStreamMessageSender, StreamMessageSender } from '@/types';
import { logService } from '@/services/logService';
import { buildAnthropicRequestBody } from './anthropicMessages';
import { extractAnthropicMessageText, readAnthropicErrorMessage } from './anthropicResponses';
import { readAnthropicStreamEvents } from './anthropicStream';
import {
  asAnthropicChatConfig,
  mapAnthropicUsage,
  type AnthropicModelsResponsePayload,
  type AnthropicResponsePayload,
  type AnthropicStreamEvent,
} from './anthropicTypes';
import { buildAnthropicMessagesUrl, buildAnthropicModelsUrl } from './anthropicUrls';

const ANTHROPIC_VERSION = '2023-06-01';

const createRequestInit = (apiKey: string, body: Record<string, unknown>, abortSignal: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: abortSignal,
});

const createGetRequestInit = (apiKey: string, abortSignal: AbortSignal): RequestInit => ({
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  },
  signal: abortSignal,
});

export const fetchAnthropicModels = async (
  apiKey: string,
  baseUrl: string | null | undefined,
  abortSignal: AbortSignal,
): Promise<ModelOption[]> => {
  const response = await fetch(buildAnthropicModelsUrl(baseUrl), createGetRequestInit(apiKey, abortSignal));
  if (!response.ok) {
    throw new Error(await readAnthropicErrorMessage(response));
  }
  const payload = (await response.json()) as AnthropicModelsResponsePayload;
  const seenIds = new Set<string>();
  return (payload.data ?? []).reduce<ModelOption[]>((models, item) => {
    const modelId = typeof item.id === 'string' ? item.id.trim() : '';
    if (!modelId || seenIds.has(modelId)) return models;
    seenIds.add(modelId);
    models.push({ id: modelId, name: modelId });
    return models;
  }, []);
};

export const sendAnthropicMessageNonStream: NonStreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onError,
  onComplete,
  role = 'user',
) => {
  const anthropicConfig = asAnthropicChatConfig(config);
  try {
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }
    const response = await fetch(
      buildAnthropicMessagesUrl(anthropicConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildAnthropicRequestBody(modelId, history, parts, anthropicConfig, role, false),
        abortSignal,
      ),
    );
    if (!response.ok) {
      throw new Error(await readAnthropicErrorMessage(response));
    }
    const payload = (await response.json()) as AnthropicResponsePayload;
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }
    const text = extractAnthropicMessageText(payload);
    onComplete(text ? [{ text }] : [], undefined, mapAnthropicUsage(payload.usage), undefined, undefined);
  } catch (error) {
    logService.error('Anthropic non-stream request failed:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

export const sendAnthropicMessageStream: StreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onPart,
  _onThoughtChunk,
  onError,
  onComplete,
  role = 'user',
) => {
  const anthropicConfig = asAnthropicChatConfig(config);
  let finalUsage: UsageMetadata | undefined;
  try {
    if (abortSignal.aborted) {
      onComplete(undefined, undefined, undefined);
      return;
    }
    const response = await fetch(
      buildAnthropicMessagesUrl(anthropicConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildAnthropicRequestBody(modelId, history, parts, anthropicConfig, role, true),
        abortSignal,
      ),
    );
    if (!response.ok) {
      throw new Error(await readAnthropicErrorMessage(response));
    }
    await readAnthropicStreamEvents(response, abortSignal, (event: AnthropicStreamEvent) => {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        onPart({ text: event.delta.text });
      }
      if (event.usage) {
        const usage = mapAnthropicUsage(event.usage);
        if (usage) finalUsage = usage;
      }
      if (event.type === 'message_delta' && event.usage) {
        const usage = mapAnthropicUsage(event.usage);
        if (usage) finalUsage = usage;
      }
    });
    onComplete(finalUsage, undefined, undefined);
  } catch (error) {
    logService.error('Anthropic stream request failed:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/services/api/anthropicApi.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 提交**

```bash
git add src/services/api/anthropicApi.ts src/services/api/anthropicApi.test.ts
git commit -m "feat(anthropic): add stream/non-stream senders and model fetch"
```

---

## Task 8: 发送层按 provider.protocol 分流

**Files:**

- Modify: `src/features/message-sender/standardChatApiCall.ts`

> 这是把"死路"接通的关键。把 `isOpenAICompatibleApiActive` → `isThirdPartyApiActive`,按 `provider.protocol` 选 openai-compatible 或 anthropic 发送函数。

- [ ] **Step 1: 改 import**

在 `src/features/message-sender/standardChatApiCall.ts` 顶部 import 区,把:

```typescript
import { isOpenAICompatibleApiActive } from '@/utils/openaiCompatibleMode';
```

替换为:

```typescript
import { isThirdPartyApiActive } from '@/utils/thirdPartyApiActive';
import { getThirdPartyProviderConfig } from '@/utils/thirdPartyApiProviders';
import { sendAnthropicMessageNonStream, sendAnthropicMessageStream } from '@/services/api/anthropicApi';
```

(`sendOpenAICompatibleMessageStream/NonStream` 的 import 保留不动)

- [ ] **Step 2: 改判断 + modelId 解析**

找到第 116-117 行:

```typescript
const isOpenAICompatibleMode = isOpenAICompatibleApiActive(appSettings);
const apiModelId = isOpenAICompatibleMode ? appSettings.openaiCompatibleModelId : activeModelId;
```

替换为:

```typescript
const isThirdPartyMode = isThirdPartyApiActive(appSettings);
const activeProvider = isThirdPartyMode ? getThirdPartyProviderConfig(appSettings) : null;
const apiModelId = activeProvider ? activeProvider.modelId : activeModelId;
```

- [ ] **Step 3: 改发送分支**

找到第 158 行的 `if (isOpenAICompatibleMode) {` 整块(到对应的 `return;` + `}`),替换为:

```typescript
if (activeProvider) {
  const providerConfig = {
    baseUrl: activeProvider.baseUrl,
    systemInstruction: sessionToUpdate.systemInstruction,
    temperature: sessionToUpdate.temperature,
    topP: sessionToUpdate.topP,
  };
  const isAnthropic = activeProvider.protocol === 'anthropic';

  if (appSettings.isStreamingEnabled) {
    await routeThrownStreamError(
      () =>
        isAnthropic
          ? sendAnthropicMessageStream(
              keyToUse,
              apiModelId,
              historyForChat,
              finalParts,
              providerConfig,
              newAbortController.signal,
              streamOnPart,
              onThoughtChunk,
              streamOnError,
              streamOnComplete,
              finalRole,
            )
          : sendOpenAICompatibleMessageStream(
              keyToUse,
              apiModelId,
              historyForChat,
              finalParts,
              providerConfig,
              newAbortController.signal,
              streamOnPart,
              onThoughtChunk,
              streamOnError,
              streamOnComplete,
              finalRole,
            ),
      streamOnError,
    );
    return;
  }

  await routeThrownStreamError(
    () =>
      isAnthropic
        ? sendAnthropicMessageNonStream(
            keyToUse,
            apiModelId,
            historyForChat,
            finalParts,
            providerConfig,
            newAbortController.signal,
            streamOnError,
            nonStreamOnComplete,
            finalRole,
          )
        : sendOpenAICompatibleMessageNonStream(
            keyToUse,
            apiModelId,
            historyForChat,
            finalParts,
            providerConfig,
            newAbortController.signal,
            streamOnError,
            nonStreamOnComplete,
            finalRole,
          ),
    streamOnError,
  );
  return;
}
```

- [ ] **Step 4: 类型检查 + 回归测试**

Run: `npx tsc --noEmit`
Expected: 无错(忽略已知的 excluded 文件错误)

Run: `npx vitest run src/features/message-sender/`
Expected: 现有测试通过(它们用的是 Gemini 路径,不受影响)

- [ ] **Step 5: 提交**

```bash
git add src/features/message-sender/standardChatApiCall.ts
git commit -m "feat(third-party): route message sending by provider protocol"
```

---

## Task 8b: API key 解析接入第三方 provider(关键前置)

**Files:**

- Modify: `src/utils/apiKeySelection.ts`

> `getKeyForRequest()` → `resolveApiKeyRequestMode()` + `getActiveApiConfig()` 目前用 `isOpenAICompatibleApiActive()` 读 `openaiCompatibleApiKey`。第三方模式必须让它们读 `activeProvider.apiKey`,否则 keyToUse 错误,发送必然失败。

- [ ] **Step 1: 扩展 ApiKeyRequestMode 类型**

在 `src/utils/apiKeySelection.ts` 第 21 行:

```typescript
type ApiKeyRequestMode = 'active' | 'gemini-native' | 'openai-compatible';
```

改为:

```typescript
type ApiKeyRequestMode = 'active' | 'gemini-native' | 'openai-compatible' | 'third-party';
```

- [ ] **Step 2: 改 resolveApiKeyRequestMode**

第 29-35 行的 `resolveApiKeyRequestMode`,把:

```typescript
return isOpenAICompatibleApiActive(appSettings) ? 'openai-compatible' : 'gemini-native';
```

改为:

```typescript
if (isThirdPartyApiActive(appSettings)) {
  return 'third-party';
}
return isOpenAICompatibleApiActive(appSettings) ? 'openai-compatible' : 'gemini-native';
```

并在文件顶部 import:

```typescript
import { isThirdPartyApiActive } from '@/utils/thirdPartyApiActive';
import { getThirdPartyProviderConfig } from '@/utils/thirdPartyApiProviders';
```

- [ ] **Step 3: 改 getActiveApiConfig**

第 50-54 行的 `if (resolveApiKeyRequestMode(...) === 'openai-compatible')` 块之后,新增 third-party 分支:

```typescript
if (resolveApiKeyRequestMode(appSettings, apiMode) === 'third-party') {
  const activeProvider = getThirdPartyProviderConfig(appSettings);
  const envFallback = activeProvider.protocol === 'openai-compatible' ? importEnv?.VITE_OPENAI_API_KEY : null;
  return { apiKeysString: activeProvider.apiKey || envFallback || null };
}
```

(放在 openai-compatible 分支之后、useCustomApiConfig 分支之前)

- [ ] **Step 4: 写/更新测试**

在 `src/utils/apiKeySelection.test.ts` 新增:

```typescript
it('resolves third-party provider api key when third-party mode active', () => {
  const settings = createAppSettings({
    isThirdPartyApiEnabled: true,
    apiMode: 'third-party',
    thirdPartyApi: {
      activeProvider: 'anthropic',
      providers: {
        ...createDefaultThirdPartyApiSettings().providers,
        anthropic: {
          ...createDefaultThirdPartyApiSettings().providers.anthropic,
          apiKey: 'sk-ant-test',
        },
      },
    },
  });
  const result = getKeyForRequest(settings, createChatSettings());
  expect('key' in result && result.key).toBe('sk-ant-test');
});
```

(import `createDefaultThirdPartyApiSettings` from `@/utils/thirdPartyApiProviders`)

Run: `npx vitest run src/utils/apiKeySelection.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/apiKeySelection.ts src/utils/apiKeySelection.test.ts
git commit -m "feat(third-party): resolve api key from active provider"
```

---

## Task 9: 模型列表接入 buildProviderAwareModelList

**Files:**

- Modify: `src/hooks/app/useApp.ts`

- [ ] **Step 1: 改 import + 本地函数**

在 `src/hooks/app/useApp.ts` 顶部找到本地函数(约第 31 行):

```typescript
const buildProviderAwareModels = (apiModels: ModelOption[]): ModelOption[] => {
  return apiModels.map((model) => ({ ...model, apiMode: 'gemini-native' as const }));
};
```

删除它,改为 import:

```typescript
import { buildProviderAwareModelList } from '@/utils/thirdPartyApiProviders';
```

- [ ] **Step 2: 改 useMemo 调用**

找到第 130 行:

```typescript
const providerAwareModels = useMemo(() => buildProviderAwareModels(apiModels), [apiModels]);
```

替换为:

```typescript
const providerAwareModels = useMemo(
  () => buildProviderAwareModelList(appSettings, apiModels),
  [appSettings, apiModels],
);
```

- [ ] **Step 3: 类型检查 + 回归测试**

Run: `npx tsc --noEmit`
Expected: 无错

Run: `npx vitest run src/hooks/app/`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/hooks/app/useApp.ts
git commit -m "feat(third-party): merge active provider models into picker list"
```

---

## Task 10: Settings sanitize 归一化 apiMode

**Files:**

- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: 改 sanitizeAppSettings**

在 `src/stores/settingsStore.ts` 的 `sanitizeAppSettings` return 对象里,找到:

```typescript
    apiMode: isOpenAICompatibleApiEnabled ? settings.apiMode : 'gemini-native',
```

替换为(把旧 `openai-compatible` 归一为 `gemini-native`):

```typescript
    apiMode: (() => {
      const rawMode = isOpenAICompatibleApiEnabled ? settings.apiMode : 'gemini-native';
      // Legacy 'openai-compatible' apiMode is replaced by 'third-party'. Normalize stale data.
      return rawMode === 'openai-compatible' ? 'gemini-native' : rawMode;
    })(),
```

- [ ] **Step 2: 写/更新测试**

在 `src/stores/settingsStore.test.ts` 新增一个 describe:

```typescript
describe('sanitizeAppSettings apiMode normalization', () => {
  it('normalizes legacy openai-compatible apiMode to gemini-native', () => {
    // 直接调 sanitize 需要它被 export;若未 export,通过 setAppSettings 间接测。
    // 假设 sanitizeAppSettings 已 export(检查文件顶部),否则跳过此测试改用集成断言。
  });
});
```

> 注:若 `sanitizeAppSettings` 未 export,这个测试改为通过 `setAppSettings({ apiMode: 'openai-compatible' })` 后读取 `useSettingsStore.getState().appSettings.apiMode` 断言。先确认是否 export 再定测试形态。

Run: `npx vitest run src/stores/settingsStore.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/settingsStore.ts src/stores/settingsStore.test.ts
git commit -m "feat(third-party): normalize legacy openai-compatible apiMode in sanitize"
```

---

## Task 11: i18n provider 文案

**Files:**

- Modify: `src/i18n/translations/settings/api.ts`

- [ ] **Step 1: 加 provider 名称 + 面板文案**

在 `src/i18n/translations/settings/api.ts` 的 export 对象末尾(闭合 `};` 前)追加:

```typescript
  // Third-party API provider
  thirdPartyApiPanelTitle: { en: 'Third-Party API Provider', zh: '第三方 API 服务商' },
  thirdPartyApiProviderLabel: { en: 'Provider', zh: '服务商' },
  thirdPartyApiEnableToggle: { en: 'Enable third-party API provider', zh: '启用第三方 API 服务商' },
  thirdPartyApiBaseUrl: { en: 'Base URL', zh: 'Base URL' },
  thirdPartyProviderOpenai: { en: 'OpenAI', zh: 'OpenAI' },
  thirdPartyProviderDeepseek: { en: 'DeepSeek', zh: 'DeepSeek' },
  thirdPartyProviderAnthropic: { en: 'Anthropic', zh: 'Anthropic' },
  thirdPartyProviderOpenrouter: { en: 'OpenRouter', zh: 'OpenRouter' },
  thirdPartyProviderQwen: { en: 'Qwen', zh: '通义千问' },
  thirdPartyProviderKimi: { en: 'Kimi', zh: 'Kimi' },
  thirdPartyProviderCustom: { en: 'Custom', zh: '自定义' },
```

- [ ] **Step 2: 跑 i18n 覆盖率测试**

Run: `npx vitest run src/i18n/translationCoverage.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/i18n/translations/settings/api.ts
git commit -m "feat(third-party): add provider i18n strings"
```

---

## Task 12: ThirdPartyApiSettingsPanel 组件

**Files:**

- Create: `src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx`

- [ ] **Step 1: 实现组件**

新建 `src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx`:

```typescript
import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import type { AppSettings, ThirdPartyApiSettings, ThirdPartyProviderId } from '@/types';
import {
  THIRD_PARTY_PROVIDER_IDS,
  THIRD_PARTY_PROVIDER_LABELS,
  getThirdPartyProviderConfig,
  updateActiveThirdPartyProviderConfig,
  updateThirdPartyApiSettings,
} from '@/utils/thirdPartyApiProviders';
import { ApiKeyInput } from './ApiKeyInput';
import { ApiConnectionTester } from './ApiConnectionTester';
import { OpenAICompatibleModelListEditor } from './OpenAICompatibleModelListEditor';

interface ThirdPartyApiSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetConnectionTest: () => void;
  onTestConnection: () => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testMessage: string | null;
  hasEnvKey: boolean;
}

export const ThirdPartyApiSettingsPanel: React.FC<ThirdPartyApiSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onResetConnectionTest,
  onTestConnection,
  testStatus,
  testMessage,
}) => {
  const { t } = useI18n();
  const activeConfig = getThirdPartyProviderConfig(settings);

  const updateThirdPartyApi = (next: ThirdPartyApiSettings) => {
    onUpdateSettings({ thirdPartyApi: next });
  };

  const handleProviderChange = (providerId: ThirdPartyProviderId) => {
    updateThirdPartyApi(updateThirdPartyApiSettings(settings.thirdPartyApi, providerId));
    onResetConnectionTest();
  };

  const updateActiveField = <K extends keyof typeof activeConfig>(key: K, value: (typeof activeConfig)[K]) => {
    updateThirdPartyApi(updateActiveThirdPartyProviderConfig(settings.thirdPartyApi, { [key]: value }));
    onResetConnectionTest();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="third-party-provider-select" className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
          {t('thirdPartyApiProviderLabel')}
        </label>
        <select
          id="third-party-provider-select"
          value={settings.thirdPartyApi.activeProvider}
          onChange={(e) => handleProviderChange(e.target.value as ThirdPartyProviderId)}
          className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm ${SETTINGS_INPUT_CLASS}`}
        >
          {THIRD_PARTY_PROVIDER_IDS.map((providerId) => (
            <option key={providerId} value={providerId}>
              {t(THIRD_PARTY_PROVIDER_LABELS[providerId])}
            </option>
          ))}
        </select>
      </div>

      <ApiKeyInput
        apiKey={activeConfig.apiKey}
        setApiKey={(value) => updateActiveField('apiKey', value)}
        label={t('settingsOpenAICompatibleApiKey')}
        placeholder={t('apiConfigOpenaiKeyPlaceholder')}
        helpText={t('settingsOpenAICompatibleApiKeyHelp')}
      />

      <div className="space-y-2">
        <label htmlFor="third-party-base-url-input" className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
          {t('thirdPartyApiBaseUrl')}
        </label>
        <input
          id="third-party-base-url-input"
          type="text"
          value={activeConfig.baseUrl || ''}
          onChange={(e) => updateActiveField('baseUrl', e.target.value)}
          className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm custom-scrollbar font-mono ${SETTINGS_INPUT_CLASS}`}
          aria-label={t('thirdPartyApiBaseUrl')}
        />
      </div>

      <OpenAICompatibleModelListEditor
        models={activeConfig.models}
        selectedModelId={activeConfig.modelId}
        onModelsChange={(models) => updateActiveField('models', models)}
        onSelectedModelChange={(modelId) => updateActiveField('modelId', modelId)}
      />

      <ApiConnectionTester
        onTest={onTestConnection}
        testStatus={testStatus}
        testMessage={testMessage}
        isTestDisabled={testStatus === 'testing' || !activeConfig.apiKey}
      />
    </div>
  );
};
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错(THIRD_PARTY_PROVIDER_LABELS 在 thirdPartyApiProviders.ts 里,用 labelKey 而非直接 t-able 字符串——见 Step 3 修正)

- [ ] **Step 3: 修正 provider label 引用**

`THIRD_PARTY_PROVIDER_LABELS` 的值是 provider 显示名(如 `'OpenAI'`),不是 i18n key。把下拉的 `{t(THIRD_PARTY_PROVIDER_LABELS[providerId])}` 改为直接用值(它们是英文品牌名,不需翻译),或映射到新 i18n key。采用直接用值:

```typescript
            <option key={providerId} value={providerId}>
              {THIRD_PARTY_PROVIDER_LABELS[providerId]}
            </option>
```

(Qwen/Kimi 是品牌名,Task 11 的 i18n key 备用但此面板直接显示品牌名)

Run: `npx tsc --noEmit`
Expected: 无错

- [ ] **Step 4: 提交**

```bash
git add src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx
git commit -m "feat(third-party): add ThirdPartyApiSettingsPanel component"
```

---

## Task 13: SettingsContent 接线 + ApiConfigSection 启用开关

**Files:**

- Modify: `src/components/settings/SettingsContent.tsx`
- Modify: `src/components/settings/sections/ApiConfigSection.tsx`

- [ ] **Step 1: SettingsContent 改用 thirdParty 判断**

在 `src/components/settings/SettingsContent.tsx`,把所有 `isOpenAICompatibleApiActive` 改为 `isThirdPartyApiActive`(import 从 `@/utils/openaiCompatibleMode` 换成 `@/utils/thirdPartyApiActive`)。把 `apiMode === 'openai-compatible'` 改为 `apiMode === 'third-party'`。把读取 `openaiCompatibleModels`/`openaiCompatibleModelId` 的地方改为读 active provider 的 models/modelId(用 `getThirdPartyProviderConfig`)。

`tagModelsWithApiMode` 的 `'openai-compatible'` 参数改为 `'third-party'`。

- [ ] **Step 2: 替换面板组件引用**

把渲染 `OpenAICompatibleApiSettingsPanel` 的地方改为 `ThirdPartyApiSettingsPanel`,props 适配(onUpdate 改为 onUpdateSettings 接受 Partial<AppSettings>)。

- [ ] **Step 3: ApiConfigSection 启用开关**

在 `src/components/settings/sections/ApiConfigSection.tsx`,启用开关读写 `isThirdPartyApiEnabled`(不再读写 `isOpenAICompatibleApiEnabled`)。开关打开时同时设 `apiMode: 'third-party'`,关闭时设 `'gemini-native'`。

- [ ] **Step 4: 类型检查 + 回归**

Run: `npx tsc --noEmit`
Expected: 无错

Run: `npx vitest run src/components/settings/`
Expected: 现有测试可能因字段名变化失败——更新它们指向 thirdParty 字段

- [ ] **Step 5: 更新 settings 测试(若失败)**

打开失败的测试文件(如 `ApiConfigSection.test.tsx`),把 `openaiCompatible*` 字段改为 `thirdPartyApi`/`isThirdPartyApiEnabled`。跑通为止。

Run: `npx vitest run src/components/settings/`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/settings/SettingsContent.tsx src/components/settings/sections/ApiConfigSection.tsx src/components/settings/sections/ApiConfigSection.test.tsx
git commit -m "feat(third-party): wire third-party provider into settings UI"
```

---

## Task 14: 连接测试按 protocol 分流

**Files:**

- Modify: `src/hooks/settings/useSettingsLogic.ts`(或实际承载 testConnection 的文件)

- [ ] **Step 1: 定位 testConnection 实现**

Run: `grep -rn "testConnection\|onTestConnection\|fetchOpenAICompatibleModels\|/models" src/hooks/settings src/components/settings --include="*.ts" --include="*.tsx" | grep -v test`

找到实际发起测试请求的函数。它当前调 `fetchOpenAICompatibleModels`。

- [ ] **Step 2: 按 protocol 分流**

在该函数里,读取 active provider 的 protocol:

```typescript
const activeProvider = getThirdPartyProviderConfig(appSettings);
const isAnthropic = activeProvider.protocol === 'anthropic';
const models = isAnthropic
  ? await fetchAnthropicModels(key, activeProvider.baseUrl, signal)
  : await fetchOpenAICompatibleModels(key, activeProvider.baseUrl, signal);
```

(key 从 activeProvider.apiKey 或环境变量解析,参照 resolveActiveThirdPartyProviderApiKey)

- [ ] **Step 3: 模型导入按钮同理**

`OpenAICompatibleModelListEditor` 的 `onFetchModelsForImportPreview` 也按 protocol 分流(同样的 fetchAnthropicModels/fetchOpenAICompatibleModels 选择)。

- [ ] **Step 4: 类型检查 + 测试**

Run: `npx tsc --noEmit`
Expected: 无错

Run: `npx vitest run src/hooks/settings/ src/components/settings/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add <修改的文件>
git commit -m "feat(third-party): route connection test and model import by provider protocol"
```

---

## Task 15: 全量验证

**Files:** 无(纯验证)

- [ ] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: 无错(忽略已知 excluded 文件)

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: 除 2 个预存在的 clipboard 测试 + 3 个架构测试(Pyodide/npm/app拆分)外全过

- [ ] **Step 3: lint**

Run: `npx eslint src --max-warnings=0` (或 `npm run lint`)
Expected: 无错

- [ ] **Step 4: 手动端到端验证**

启动 dev server,在设置里:

1. 启用第三方 provider
2. 选 OpenAI,填 key,测试连接 → 成功
3. 模型列表出现 GPT 模型,发消息 → 走 OpenAI 路径
4. 切到 Anthropic,填 key,测试连接 → 成功
5. 选 Claude 模型,发消息 → 走 Anthropic 路径
6. 关闭开关 → 回到 Gemini 模式

---

## Spec 覆盖核对

| Spec 需求                                                 | 覆盖任务                                      |
| --------------------------------------------------------- | --------------------------------------------- |
| 数据模型 thirdPartyApi 唯一真相                           | Task 8(发送)+ Task 9(模型)+ Task 10(sanitize) |
| isThirdPartyApiActive 工具                                | Task 1                                        |
| 消息发送按 protocol 分流                                  | Task 8                                        |
| Anthropic 适配器(URL/types/messages/responses/stream/api) | Task 2-7                                      |
| 模型列表接入                                              | Task 9                                        |
| UI 替换面板                                               | Task 12-13                                    |
| 连接测试按 protocol                                       | Task 14                                       |
| sanitize apiMode 归一                                     | Task 10                                       |
| i18n                                                      | Task 11                                       |
| 不迁移旧配置                                              | (无任务——保留字段不读即可)                    |
| 旧字段保留                                                | (类型/schema 已存在,不动)                     |
