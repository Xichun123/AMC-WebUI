# Live Translate 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `gemini-3.5-live-translate-preview` 模型集成到 AMC-WebUI，选中后自动进入实时语音翻译模式：录音 → 模型实时返回翻译音频 → 流式播放 → 停止后固化为带音频播放器的聊天消息。

**Architecture:** 最大化复用现有 Live API 基础设施。Live Translate 模型归类为 native audio（自动获得 `'live'` 目录分类、LiveControls 按钮、`useLiveConfig` 路径）。翻译方向通过精简的 `systemInstruction` 注入；翻译音频复用现有 `audioSrc` 字段存为 `ChatMessage`（不新增消息类型）。语言方向选择器替代 Live 模式的 voice 选择器。

**Tech Stack:** React + TypeScript + Zustand + Vitest + @google/genai（`bidiGenerateContent` 经 `ai.live.connect`）。

**关键设计决策（已与用户确认，对 spec 的细化）：**

1. **不新增 `TranslateMessageData` 类型或 `TranslateMessageBubble` 组件** —— 复用现有 `ChatMessage`：译文走 `message.content`，翻译音频走 `message.audioSrc`，现有的 `onLiveTranscript` → `handleLiveTranscript` 流水线已能正确构建带 `AudioPlayer` 的气泡。
2. **不修改 `modelCatalog.ts`** —— 让 `isLiveTranslateModel` 的模型同时满足 `isNativeAudioModel`，自动归入 `'live'` 类别、自动获得 LiveControls 与 Live config 路径。
3. 源语言/目标语言作为 `AppSettings` 顶层字段持久化（非 `ChatSettings`），因为它是设备级偏好而非会话级配置。

---

## File Structure

| 文件                                                              | 操作 | 责任                                                                                                                                |
| ----------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/modelRegistry.ts`                                  | 修改 | 注册 `gemini-3.5-live-translate-preview` 到 `defaultPinned`，新增 `'liveTranslate'` group                                           |
| `src/utils/modelCapabilities.ts`                                  | 修改 | 新增 `isLiveTranslateModel()`；让 live-translate 模型计入 `isNativeAudioModel`；`getModelCapabilities` 返回值新增 `isLiveTranslate` |
| `src/types/settings.ts`                                           | 修改 | `AppSettings` 新增 `liveTranslateSourceLanguage` / `liveTranslateTargetLanguage`                                                    |
| `src/constants/settingsDefaults.ts`                               | 修改 | 默认值 `'auto'` / `'English'`                                                                                                       |
| `src/stores/settingsStore.ts`                                     | 修改 | `sanitizeAppSettings` 兜底新字段                                                                                                    |
| `src/hooks/live-api/useLiveConfig.ts`                             | 修改 | live-translate 模型走精简 config（无 voiceConfig / tools / transcription / compression / thinking）                                 |
| `src/hooks/live-api/useLiveTranslateConfig.ts`                    | 新建 | 纯函数：构建精简 config（systemInstruction 含语言方向提示）。`useLiveConfig` 调用它                                                 |
| `src/components/chat/input/toolbar/LanguageDirectionSelector.tsx` | 新建 | 源语言 + 目标语言两个下拉，写回 `appSettings`                                                                                       |
| `src/components/chat/input/ChatInputToolbar.tsx`                  | 修改 | live-translate 模型显示语言方向选择器（替代 voice 选择器）                                                                          |
| `src/constants/translationOptions.ts`                             | 修改 | 导出 `LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS`（含 auto）、`LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS`                                  |
| `src/i18n/translations/chatInput.ts`                              | 修改 | 新增语言方向选择器 + auto 选项文案                                                                                                  |

**测试文件：**

- `src/utils/modelCapabilities.test.ts`（修改）— 新增 `isLiveTranslateModel` + native audio 检测测试
- `src/hooks/live-api/useLiveConfig.test.tsx`（修改）— 新增 live-translate 精简 config 测试
- `src/hooks/live-api/useLiveTranslateConfig.test.ts`（新建）— 纯函数测试，覆盖 auto / 指定源语言分支
- `src/constants/settingsDefaults.test.ts`（修改）— 断言新字段默认值

---

## Task 1: 注册 Live Translate 模型 + 新增 model group

**Files:**

- Modify: `src/constants/modelRegistry.ts`
- Test: `src/constants/settingsModelOptions.test.ts`（已有，确认 pin 后出现在默认模型列表）

- [ ] **Step 1: 新增 `'liveTranslate'` group 类型 + 注册模型**

在 `src/constants/modelRegistry.ts`，把第 3 行的 `ModelRegistryGroup` 类型加入 `'liveTranslate'`：

```typescript
type ModelRegistryGroup =
  | 'defaultPinned'
  | 'tts'
  | 'image'
  | 'liveArtifacts'
  | 'connectionTest'
  | 'transcription'
  | 'liveTranslate';
```

在 `MODEL_REGISTRY` 数组中（`gemini-3.1-flash-live-preview` 条目之后，约第 35 行后）插入：

```typescript
  {
    id: 'gemini-3.5-live-translate-preview',
    name: 'Gemini 3.5 Live Translate',
    groups: ['defaultPinned'],
  },
```

> 说明：只加入 `defaultPinned`，让模型出现在模型选择器的默认 pinned 列表中（通过 `getDefaultModelOptions()` → `getModelOptionsForGroup('defaultPinned')`）。`'liveTranslate'` group 类型目前不挂载任何条目，但保留以备 spec 中提及的 `groups: ['defaultPinned', 'liveTranslate']` 未来扩展。

- [ ] **Step 2: 运行现有测试确认未破坏**

Run: `npx vitest run src/constants/settingsModelOptions.test.ts`
Expected: PASS（新模型不影响现有断言；若该测试硬编码了模型数量，会失败——见下一步）

- [ ] **Step 3: 若 settingsModelOptions.test.ts 因模型计数失败，按其断言风格更新**

打开 `src/constants/settingsModelOptions.test.ts`，找到断言默认 pinned 模型列表/数量的地方。如果它用 `toContain` 风格则无需改；如果是精确数组相等，追加 `'gemini-3.5-live-translate-preview'`。

Run: `npx vitest run src/constants/settingsModelOptions.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/constants/modelRegistry.ts src/constants/settingsModelOptions.test.ts
git commit -m "feat(live-translate): register gemini-3.5-live-translate-preview model"
```

---

## Task 2: 模型能力检测 —— `isLiveTranslateModel` + 归入 native audio

**Files:**

- Modify: `src/utils/modelCapabilities.ts`
- Test: `src/utils/modelCapabilities.test.ts`

- [ ] **Step 1: 先写失败测试（新增 describe 块）**

在 `src/utils/modelCapabilities.test.ts` 顶部 import 中加入 `isLiveTranslateModel`：

```typescript
import {
  getDefaultThinkingLevelForModel,
  getModelCapabilities,
  isGemini3Model,
  isLiveTranslateModel,
  normalizeThinkingLevelForModel,
  shouldStripThinkingFromContext,
} from './modelCapabilities';
```

在文件末尾（最后一个 `describe` 之后）追加：

```typescript
describe('isLiveTranslateModel', () => {
  it('returns false for empty string', () => {
    expect(isLiveTranslateModel('')).toBe(false);
  });

  it('returns true for the preview model id', () => {
    expect(isLiveTranslateModel('gemini-3.5-live-translate-preview')).toBe(true);
    expect(isLiveTranslateModel('models/gemini-3.5-live-translate-preview')).toBe(true);
  });

  it('returns false for unrelated models', () => {
    expect(isLiveTranslateModel('gemini-3.1-flash-live-preview')).toBe(false);
    expect(isLiveTranslateModel('gemini-3.5-flash')).toBe(false);
  });
});

describe('Live Translate model capabilities', () => {
  const capabilities = getModelCapabilities('gemini-3.5-live-translate-preview');

  it('is classified as a native audio model so it reuses the live infra', () => {
    expect(capabilities.isNativeAudioModel).toBe(true);
    expect(capabilities.permissions.canUseLiveControls).toBe(true);
    expect(capabilities.isLiveTranslate).toBe(true);
  });

  it('does not require a text prompt (audio-first)', () => {
    expect(capabilities.permissions.requiresTextPrompt).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/utils/modelCapabilities.test.ts`
Expected: FAIL — `isLiveTranslateModel is not a function`，且 `isLiveTranslate` / native audio 断言失败。

- [ ] **Step 3: 实现 `isLiveTranslateModel` + 改 `isNativeAudioModel`**

在 `src/utils/modelCapabilities.ts` 中：

**3a.** 在文件顶部（`isGeminiRoboticsModel` 定义之后，约第 17 行后）新增导出函数：

```typescript
export const isLiveTranslateModel = (modelId: string): boolean =>
  !!modelId && modelId.toLowerCase().includes('live-translate');
```

**3b.** 修改 `isNativeAudioModel`（当前第 19-22 行是 module-private 函数），让它也对 live-translate 模型返回 true。把它改为：

```typescript
const isNativeAudioModel = (modelId: string): boolean => {
  const lowerId = modelId.toLowerCase();
  return lowerId.includes('native-audio') || lowerId.includes('-live-') || lowerId.includes('live-translate');
};
```

> 注意：`-live-` 本身不匹配 `live-translate`（因为是 `live-translate`，前后是 `-translate`），所以显式加 `live-translate` 分支。

**3c.** 在 `ModelCapabilities` interface（第 63-85 行）中，紧跟 `isNativeAudioModel: boolean;` 之后加一行：

```typescript
isLiveTranslate: boolean;
```

**3d.** 在 `getModelCapabilities` 的 return 对象（第 153-175 行）中，紧跟 `isNativeAudioModel: nativeAudioModel,` 之后加一行：

```typescript
    isLiveTranslate: isLiveTranslateModel(modelId),
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/utils/modelCapabilities.test.ts`
Expected: PASS（全部，包括新增 describe 块）

- [ ] **Step 5: 运行受影响的全量相关测试，确认无回归**

Run: `npx vitest run src/utils/modelCatalog.test.ts src/stores/modelCapabilitiesStore.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/utils/modelCapabilities.ts src/utils/modelCapabilities.test.ts
git commit -m "feat(live-translate): detect live-translate models as native audio"
```

---

## Task 3: Settings 类型与默认值 —— 语言方向字段

**Files:**

- Modify: `src/types/settings.ts`
- Modify: `src/constants/settingsDefaults.ts`
- Modify: `src/stores/settingsStore.ts`
- Test: `src/constants/settingsDefaults.test.ts`, `src/stores/settingsStore.test.ts`

- [ ] **Step 1: 先写失败测试 —— 默认值**

在 `src/constants/settingsDefaults.test.ts` 中（import 已有 `getDefaultAppSettings` 或 `DEFAULT_APP_SETTINGS`），新增测试块：

```typescript
describe('Live Translate settings defaults', () => {
  it('defaults source language to auto-detect and target to English', () => {
    const settings = getDefaultAppSettings();
    expect(settings.liveTranslateSourceLanguage).toBe('auto');
    expect(settings.liveTranslateTargetLanguage).toBe('English');
  });
});
```

（若该文件 import 的是 `DEFAULT_APP_SETTINGS`，用它替代 `getDefaultAppSettings()`。）

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/constants/settingsDefaults.test.ts`
Expected: FAIL — `liveTranslateSourceLanguage` 为 `undefined`（TS 也会报属性不存在）。

- [ ] **Step 3: 类型 —— 在 `AppSettings` 加字段**

在 `src/types/settings.ts` 的 `AppSettings` interface 中（紧跟 `tabModelCycleIds?: string[];` 之后，第 150 行后）追加：

```typescript
liveTranslateSourceLanguage: string; // 'auto' = 自动检测，或具体语言名
liveTranslateTargetLanguage: string; // 目标语言名
```

- [ ] **Step 4: 默认值 —— 在 `BASE_DEFAULT_APP_SETTINGS` 加**

在 `src/constants/settingsDefaults.ts` 的 `BASE_DEFAULT_APP_SETTINGS` 对象中（紧跟 `tabModelCycleIds: undefined,` 之后，第 112 行后）追加：

```typescript
  liveTranslateSourceLanguage: 'auto',
  liveTranslateTargetLanguage: 'English',
```

- [ ] **Step 5: sanitize 兜底**

在 `src/stores/settingsStore.ts` 的 `sanitizeAppSettings` 函数中（return 对象内，紧跟 `liveArtifactsSystemPrompts: normalizeLiveArtifactsSystemPrompts(settings),` 之后，约第 85 行后）追加两行：

```typescript
    liveTranslateSourceLanguage: settings.liveTranslateSourceLanguage ?? defaultSettings.liveTranslateSourceLanguage,
    liveTranslateTargetLanguage: settings.liveTranslateTargetLanguage ?? defaultSettings.liveTranslateTargetLanguage,
```

> 说明：这两个字段不进 `resolveSupportedModelId`（不是模型 id），用简单 `?? default` 兜底即可，与 `themeId` 等非模型字段的处理风格一致。

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/constants/settingsDefaults.test.ts src/stores/settingsStore.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/types/settings.ts src/constants/settingsDefaults.ts src/stores/settingsStore.ts src/constants/settingsDefaults.test.ts
git commit -m "feat(live-translate): add language direction settings fields"
```

---

## Task 4: 语言选项常量

**Files:**

- Modify: `src/constants/translationOptions.ts`

- [ ] **Step 1: 新增 live-translate 专用语言选项**

在 `src/constants/translationOptions.ts` 末尾（第 18 行 `];` 之后）追加：

```typescript
/**
 * Live Translate 源语言选项。包含 'auto'（自动检测）。
 * value 为语言名（与 systemInstruction 一致），labelKey 为 i18n key。
 */
export const LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS: Array<{
  value: string;
  labelKey: string;
}> = [{ value: 'auto', labelKey: 'liveTranslateSourceLanguageAuto' }, ...TRANSLATION_TARGET_LANGUAGE_OPTIONS];

/**
 * Live Translate 目标语言选项。复用现有目标语言列表（不含 auto）。
 */
export const LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS = TRANSLATION_TARGET_LANGUAGE_OPTIONS;
```

> 说明：复用 `TRANSLATION_TARGET_LANGUAGE_OPTIONS` 的 value/labelKey，避免重复维护语言列表。源语言额外加一个 `'auto'` 选项，labelKey 用新 key `liveTranslateSourceLanguageAuto`（在 Task 7 加文案）。

- [ ] **Step 2: 提交（本任务无独立测试，纯常量导出）**

```bash
git add src/constants/translationOptions.ts
git commit -m "feat(live-translate): add source/target language option constants"
```

---

## Task 5: 精简 Live Translate config builder + 接入 useLiveConfig

**Files:**

- Create: `src/hooks/live-api/useLiveTranslateConfig.ts`
- Create: `src/hooks/live-api/useLiveTranslateConfig.test.ts`
- Modify: `src/hooks/live-api/useLiveConfig.ts`
- Modify: `src/hooks/live-api/useLiveConfig.test.tsx`

- [ ] **Step 1: 先写失败测试 —— 纯函数 builder**

新建 `src/hooks/live-api/useLiveTranslateConfig.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';
import { buildLiveTranslateConfig } from './useLiveTranslateConfig';

describe('buildLiveTranslateConfig', () => {
  it('omits voiceConfig, tools, transcription, compression, and thinking', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });

    expect(config).not.toHaveProperty('speechConfig');
    expect(config).not.toHaveProperty('tools');
    expect(config).not.toHaveProperty('inputAudioTranscription');
    expect(config).not.toHaveProperty('outputAudioTranscription');
    expect(config).not.toHaveProperty('contextWindowCompression');
    expect(config).not.toHaveProperty('thinkingConfig');
  });

  it('requests AUDIO modality only', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });
    expect(config.responseModalities).toEqual(['AUDIO']);
  });

  it('uses "Translate into" when source is auto', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'auto', targetLanguage: 'Japanese' });
    expect(config.systemInstruction).toEqual({
      parts: [{ text: 'Translate into Japanese.' }],
    });
  });

  it('uses "Translate from X into Y" when source is specified', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });
    expect(config.systemInstruction).toEqual({
      parts: [{ text: 'Translate from English into Japanese.' }],
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/hooks/live-api/useLiveTranslateConfig.test.ts`
Expected: FAIL — `buildLiveTranslateConfig is not a function` / 模块找不到。

- [ ] **Step 3: 实现纯函数 builder**

新建 `src/hooks/live-api/useLiveTranslateConfig.ts`：

```typescript
interface LiveTranslateLanguageSettings {
  sourceLanguage: string; // 'auto' 或具体语言名
  targetLanguage: string;
}

export interface LiveTranslateConfig {
  responseModalities: ['AUDIO'];
  systemInstruction: { parts: Array<{ text: string }> };
}

/**
 * 为 Live Translate 模型构建精简 config。
 * 与普通 Live API 的差异：
 *   - 不需要 voiceConfig（翻译音频沿用源说话人音色）
 *   - 不需要 tools / transcription / contextWindowCompression / thinkingConfig
 *   - systemInstruction 仅含语言方向提示
 */
export const buildLiveTranslateConfig = ({
  sourceLanguage,
  targetLanguage,
}: LiveTranslateLanguageSettings): LiveTranslateConfig => {
  const instruction =
    sourceLanguage === 'auto' || !sourceLanguage
      ? `Translate into ${targetLanguage}.`
      : `Translate from ${sourceLanguage} into ${targetLanguage}.`;

  return {
    responseModalities: ['AUDIO'],
    systemInstruction: { parts: [{ text: instruction }] },
  };
};
```

> 命名说明：虽然文件名是 `useLiveTranslateConfig.ts`（与 spec 一致），但实际导出的是纯函数 `buildLiveTranslateConfig` 而非 React hook（它不调用任何 React API，也不需要 `useMemo` 包裹——`useLiveConfig` 内部已在 `useMemo` 中调用它）。这是刻意决策：保持纯函数易于测试。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/hooks/live-api/useLiveTranslateConfig.test.ts`
Expected: PASS

- [ ] **Step 5: 先写失败测试 —— useLiveConfig 对 live-translate 走精简分支**

在 `src/hooks/live-api/useLiveConfig.test.tsx` 末尾（最后一个 `it` 之后、`describe` 闭合 `});` 之前）追加：

```typescript
it('emits a stripped-down config for live-translate models', () => {
  const { result, unmount } = renderHook(() =>
    useLiveConfig({
      chatSettings: createChatSettings({
        ...baseChatSettings,
        modelId: 'gemini-3.5-live-translate-preview',
      }),
      sessionHandle: null,
    }),
  );

  expect(result.current.liveConfig.responseModalities).toEqual(['AUDIO']);
  // 未传 liveTranslateLanguages 时走默认 { sourceLanguage: 'auto', targetLanguage: 'English' }
  expect(result.current.liveConfig.systemInstruction).toEqual({
    parts: [{ text: 'Translate into English.' }],
  });
  expect(result.current.liveConfig).not.toHaveProperty('speechConfig');
  expect(result.current.liveConfig).not.toHaveProperty('tools');
  expect(result.current.liveConfig).not.toHaveProperty('inputAudioTranscription');
  expect(result.current.liveConfig).not.toHaveProperty('contextWindowCompression');
  expect(result.current.liveConfig).not.toHaveProperty('thinkingConfig');
  // tools 数组应为空（builder 不产生 tools）
  expect(result.current.tools).toEqual([]);
  unmount();
});

it('uses the provided language direction for live-translate models', () => {
  const { result, unmount } = renderHook(() =>
    useLiveConfig({
      chatSettings: createChatSettings({
        ...baseChatSettings,
        modelId: 'gemini-3.5-live-translate-preview',
      }),
      sessionHandle: null,
      liveTranslateLanguages: { sourceLanguage: 'English', targetLanguage: 'Japanese' },
    }),
  );

  expect(result.current.liveConfig.systemInstruction).toEqual({
    parts: [{ text: 'Translate from English into Japanese.' }],
  });
  unmount();
});
```

> 注意：`baseChatSettings` 的 `ttsVoice` 是 `'Zephyr'`，但 live-translate 分支不读 ttsVoice，所以测试不关心它。**关键**：live-translate 分支忽略 `chatSettings.systemInstruction`，直接用 `liveTranslateLanguages`（或默认值）生成 instruction。`useLiveConfig` 通过 Task 6 接线从 `appSettings` 接收语言，但单元测试可直接传 `liveTranslateLanguages` prop。

- [ ] **Step 6: 运行测试确认失败**

Run: `npx vitest run src/hooks/live-api/useLiveConfig.test.tsx`
Expected: FAIL — live-translate 模型当前仍走完整 config（有 speechConfig 等）。

- [ ] **Step 7: 实现 —— useLiveConfig 接入精简分支**

修改 `src/hooks/live-api/useLiveConfig.ts`：

**7a.** 顶部加 import：

```typescript
import { buildLiveTranslateConfig } from './useLiveTranslateConfig';
```

**7b.** 修改 `UseLiveConfigProps` interface（第 7-11 行），新增可选的 live-translate 语言设置：

```typescript
interface UseLiveConfigProps {
  chatSettings: ChatSettings;
  sessionHandle: string | null;
  clientFunctions?: LiveClientFunctions;
  liveTranslateLanguages?: {
    sourceLanguage: string;
    targetLanguage: string;
  };
}
```

**7c.** 修改 hook 签名（第 38 行）解构出新参数：

```typescript
export const useLiveConfig = ({ chatSettings, sessionHandle, clientFunctions, liveTranslateLanguages }: UseLiveConfigProps) => {
```

**7d.** 在 `useMemo` 内部最开头（紧跟 `const capabilities = ...` 之后，约第 41 行后）插入早返回分支：

```typescript
const capabilities = getCachedModelCapabilities(chatSettings.modelId);

// Live Translate 模型走精简 config：无 voiceConfig / tools / transcription / compression / thinking
if (capabilities.isLiveTranslate) {
  const { sourceLanguage, targetLanguage } = liveTranslateLanguages ?? {
    sourceLanguage: 'auto',
    targetLanguage: 'English',
  };
  return {
    liveConfig: buildLiveTranslateConfig({ sourceLanguage, targetLanguage }),
    tools: [],
  };
}
```

**7e.** 更新 `useMemo` 依赖数组（第 100 行），加入 `liveTranslateLanguages`：

```typescript
  }, [chatSettings, sessionHandle, clientFunctions, liveTranslateLanguages]);
```

> 关键：早返回的 `return` 在 `useMemo` 内部，所以类型上 `liveConfig` 变成了 `LiveConfig | LiveTranslateConfig` 联合。`useLiveConnection` 接收 `liveConfig: unknown`（见 `useLiveConnection.ts:52`），所以无需改连接层类型。

- [ ] **Step 8: 运行测试确认通过**

Run: `npx vitest run src/hooks/live-api/useLiveConfig.test.tsx src/hooks/live-api/useLiveTranslateConfig.test.ts`
Expected: PASS（全部）

- [ ] **Step 9: 运行 live-api 全量测试确认无回归**

Run: `npx vitest run src/hooks/live-api/`
Expected: PASS（注意：`useLiveConnection.test.tsx` 可能因 `useLiveConfig` 签名变化需要检查，但该测试直接 mock liveConfig，不经过 useLiveConfig，应不受影响）

- [ ] **Step 10: 提交**

```bash
git add src/hooks/live-api/useLiveTranslateConfig.ts src/hooks/live-api/useLiveTranslateConfig.test.ts src/hooks/live-api/useLiveConfig.ts src/hooks/live-api/useLiveConfig.test.tsx
git commit -m "feat(live-translate): build stripped-down live config for translate models"
```

---

## Task 6: 把语言方向传入 useLiveConfig（接线 useChatInputCore → useLiveApi → useLiveConfig）

**Files:**

- Modify: `src/hooks/chat-input/useChatInputCore.ts`
- Modify: `src/hooks/live-api/useLiveApi.ts`

> 说明：本任务把 `appSettings` 里的语言方向透传到 `useLiveConfig`。无独立单元测试（接线代码），通过 Task 8 的端到端手动验证覆盖。但会跑全量 live-api 测试确认接线不破坏现有 hook。

- [ ] **Step 1: useLiveApi 接收并透传语言方向**

修改 `src/hooks/live-api/useLiveApi.ts`：

**1a.** 修改 `UseLiveApiProps` interface（第 16-24 行），新增可选字段：

```typescript
interface UseLiveApiProps {
  appSettings: AppSettings;
  chatSettings: ChatSettings;
  modelId: string;
  onClose?: () => void;
  onTranscript?: LiveTranscriptHandler;
  onGeneratedFiles?: (files: UploadedFile[]) => void;
  clientFunctions?: LiveClientFunctions;
  liveTranslateLanguages?: {
    sourceLanguage: string;
    targetLanguage: string;
  };
}
```

**1b.** 修改解构（第 26-34 行）：

```typescript
export const useLiveApi = ({
  appSettings,
  chatSettings,
  modelId,
  onClose,
  onTranscript,
  onGeneratedFiles,
  clientFunctions,
  liveTranslateLanguages,
}: UseLiveApiProps) => {
```

**1c.** 修改 `useLiveConfig` 调用（第 46-50 行），传入语言方向：

```typescript
const { liveConfig, tools } = useLiveConfig({
  chatSettings,
  sessionHandle,
  clientFunctions,
  liveTranslateLanguages,
});
```

- [ ] **Step 2: useChatInputCore 传入语言方向**

修改 `src/hooks/chat-input/useChatInputCore.ts` 的 `useLiveApi` 调用（第 130-140 行），新增 `liveTranslateLanguages`：

```typescript
const liveApi = useLiveApi({
  appSettings,
  chatSettings: currentChatSettings,
  modelId: currentChatSettings.modelId,
  onClose: undefined,
  onTranscript: onLiveTranscript,
  onGeneratedFiles: onLiveTranscript
    ? (files) => onLiveTranscript?.('', 'model', false, 'content', undefined, files)
    : undefined,
  clientFunctions: liveClientFunctions,
  liveTranslateLanguages: {
    sourceLanguage: appSettings.liveTranslateSourceLanguage,
    targetLanguage: appSettings.liveTranslateTargetLanguage,
  },
});
```

- [ ] **Step 3: 运行 live-api + chat-input 相关测试确认无回归**

Run: `npx vitest run src/hooks/live-api/ src/hooks/chat-input/`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/hooks/chat-input/useChatInputCore.ts src/hooks/live-api/useLiveApi.ts
git commit -m "feat(live-translate): pass language direction into live config pipeline"
```

---

## Task 7: i18n 文案

**Files:**

- Modify: `src/i18n/translations/chatInput.ts`

- [ ] **Step 1: 新增文案 key**

在 `src/i18n/translations/chatInput.ts` 的 `chatInputTranslations` 对象中，紧接 `queuedSubmissionRemove` 之后（文件末尾，第 410 行 `};` 之前）追加：

```typescript

  // Live Translate language direction selector
  liveTranslateSourceLanguageAuto: { en: 'Auto-detect', zh: '自动检测' },
  liveTranslateSourceLanguageLabel: { en: 'Source language', zh: '源语言' },
  liveTranslateTargetLanguageLabel: { en: 'Target language', zh: '目标语言' },
```

> 说明：源/目标语言选项的 labelKey 复用现有 `translationTargetLanguageEnglish` 等 key（在 `src/i18n/translations/settings/model.ts`），无需新增。只新增 `'auto'` 选项和两个 aria label。

- [ ] **Step 2: 运行 i18n 覆盖率测试确认不破坏**

Run: `npx vitest run src/i18n/translationCoverage.test.ts`
Expected: PASS（若有 key 覆盖率检查，新 key 的 en/zh 都已提供）

- [ ] **Step 3: 提交**

```bash
git add src/i18n/translations/chatInput.ts
git commit -m "feat(live-translate): add language selector i18n strings"
```

---

## Task 8: 语言方向选择器组件

**Files:**

- Create: `src/components/chat/input/toolbar/LanguageDirectionSelector.tsx`
- Modify: `src/components/chat/input/ChatInputToolbar.tsx`

- [ ] **Step 1: 新建选择器组件**

新建 `src/components/chat/input/toolbar/LanguageDirectionSelector.tsx`：

```typescript
import React from 'react';
import { Languages } from 'lucide-react';
import { Select } from '@/components/shared/Select';
import { useI18n } from '@/contexts/I18nContext';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS,
  LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS,
} from '@/constants/translationOptions';

/**
 * Live Translate 模式的语言方向选择器（源语言 + 目标语言）。
 * 替代普通 Live 模式的 voice 选择器。读写 appSettings 顶层字段。
 */
export const LanguageDirectionSelector: React.FC = () => {
  const { t } = useI18n();
  const sourceLanguage = useSettingsStore((state) => state.appSettings.liveTranslateSourceLanguage);
  const targetLanguage = useSettingsStore((state) => state.appSettings.liveTranslateTargetLanguage);
  const setAppSettings = useSettingsStore((state) => state.setAppSettings);

  return (
    <div className="flex items-center gap-2">
      <Languages size={14} className="text-purple-500 flex-shrink-0" />
      <Select
        id="live-translate-source-language"
        label={t('liveTranslateSourceLanguageLabel')}
        hideLabel
        value={sourceLanguage}
        onChange={(e) => setAppSettings((prev) => ({ ...prev, liveTranslateSourceLanguage: e.target.value }))}
        className="mb-0"
        wrapperClassName="relative min-w-[120px] w-auto"
        direction="up"
        dropdownClassName="!w-auto !min-w-full max-h-[300px]"
      >
        {LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </Select>
      <span className="text-[var(--theme-text-secondary)] text-sm">→</span>
      <Select
        id="live-translate-target-language"
        label={t('liveTranslateTargetLanguageLabel')}
        hideLabel
        value={targetLanguage}
        onChange={(e) => setAppSettings((prev) => ({ ...prev, liveTranslateTargetLanguage: e.target.value }))}
        className="mb-0"
        wrapperClassName="relative min-w-[120px] w-auto"
        direction="up"
        dropdownClassName="!w-auto !min-w-full max-h-[300px]"
      >
        {LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </Select>
    </div>
  );
};
```

> 说明：直接订阅 `useSettingsStore`，不经 ChatInputToolbarContext 透传（语言方向是设备级偏好，不是会话级 chatSettings）。`Select` 的 props 风格与 `TtsVoiceSelector.tsx` 完全一致。

- [ ] **Step 2: 接入 ChatInputToolbar —— live-translate 时显示语言选择器替代 voice 选择器**

修改 `src/components/chat/input/ChatInputToolbar.tsx`：

**2a.** 顶部加 import：

```typescript
import { LanguageDirectionSelector } from './toolbar/LanguageDirectionSelector';
```

**2b.** 在组件解构的 capabilities（第 40-48 行）中加入 `isLiveTranslate`：

```typescript
const {
  isImageGenerationModel,
  isGemini3ImageModel,
  isRealImagenModel,
  isTtsModel,
  isNativeAudioModel,
  isLiveTranslate,
  supportedAspectRatios,
  supportedImageSizes,
} = capabilities;
```

**2c.** 修改 `canShowTtsVoice`（第 71 行），让 live-translate 模型不显示 voice 选择器：

```typescript
// Allow voice selection for TTS and Native Audio (Live) models, except Live Translate
// which shows a language-direction selector instead.
const canShowTtsVoice = (isTtsModel || isNativeAudioModel) && !isLiveTranslate && Boolean(ttsVoice);

// Live Translate models show a language-direction selector instead of voice
const canShowLanguageDirection = isLiveTranslate;
```

**2d.** 更新 `hasVisibleContent`（第 76-86 行）加入 `canShowLanguageDirection`：

```typescript
const hasVisibleContent =
  showAspectRatio ||
  showImageSize ||
  showImageOutputMode ||
  showPersonGeneration ||
  showQuadToggle ||
  canShowTtsVoice ||
  canShowLanguageDirection ||
  canShowMediaResolution ||
  fileError ||
  showAddByIdInput ||
  showAddByUrlInput;
```

**2e.** 在工具栏渲染块（第 90-96 行的条件渲染）加入 `canShowLanguageDirection`，并在 `canShowTtsVoice` 渲染旁加语言选择器：

```typescript
        {(showAspectRatio ||
          showImageSize ||
          showImageOutputMode ||
          showPersonGeneration ||
          showQuadToggle ||
          canShowTtsVoice ||
          canShowLanguageDirection ||
          canShowMediaResolution) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {canShowTtsVoice && <TtsVoiceSelector ttsVoice={ttsVoice} setTtsVoice={setTtsVoice} />}
            {canShowLanguageDirection && <LanguageDirectionSelector />}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误（`isLiveTranslate` 已在 Task 2 加入 `ModelCapabilities`）

- [ ] **Step 4: 提交**

```bash
git add src/components/chat/input/toolbar/LanguageDirectionSelector.tsx src/components/chat/input/ChatInputToolbar.tsx
git commit -m "feat(live-translate): add language direction selector in toolbar"
```

---

## Task 9: 全量验证 + 类型检查 + lint

**Files:** 无（纯验证）

- [ ] **Step 1: 类型检查全量**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 运行全量单元测试**

Run: `npx vitest run`
Expected: 全部 PASS。重点关注：

- `src/utils/modelCapabilities.test.ts`
- `src/utils/modelCatalog.test.ts`
- `src/hooks/live-api/`（全部）
- `src/stores/settingsStore.test.ts`
- `src/constants/settingsDefaults.test.ts`
- `src/i18n/translationCoverage.test.ts`

- [ ] **Step 3: lint**

Run: `npm run lint`（或项目配置的 lint 命令，如 `npx eslint src --max-warnings=0`）
Expected: 无错误

- [ ] **Step 4: 手动端到端验证（需要 API key）**

启动 dev server，在模型选择器选 `Gemini 3.5 Live Translate`：

1. 工具栏出现「自动检测 → English」语言方向选择器（无 voice 选择器）
2. 点麦克风按钮 → 进入 Live 模式（LiveControls 出现）
3. 对麦克风说中文 → 实时听到英文翻译音频
4. 点停止 → 聊天列表出现一条带 AudioPlayer 的消息（译文若有文字则在 content，音频在 audioSrc）
5. 切换目标语言 → 下次录音 instruction 更新

- [ ] **Step 5: 若全绿，无需额外提交（本任务为验证）**

---

## Spec 覆盖核对

逐条对照 spec 的「功能需求」与「文件清单」：

| Spec 需求                                                        | 覆盖任务                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| 模型注册（modelRegistry）                                        | Task 1                                                    |
| 自动切换（native audio → LiveControls）                          | Task 2（归入 native audio 自动复用）                      |
| 双向语言选择                                                     | Task 4（选项）+ Task 8（UI）                              |
| 聊天消息输出（音频播放器）                                       | 复用现有 `audioSrc` + `AudioPlayer`（已存在，无需新任务） |
| 实时播放                                                         | 复用现有 `useLiveMessageProcessing` 流式播放（已存在）    |
| 历史保存                                                         | 复用现有 `handleLiveTranscript` + IndexedDB（已存在）     |
| isLiveTranslateModel + capabilities                              | Task 2                                                    |
| modelCatalog 归 'live'                                           | Task 2（通过 native audio 自动归类，无需改 catalog）      |
| settings 字段 + sanitize                                         | Task 3                                                    |
| useLiveTranslateConfig                                           | Task 5                                                    |
| LanguageSelector                                                 | Task 8                                                    |
| i18n                                                             | Task 7                                                    |
| 精简 config（无 voice/tools/transcription/compression/thinking） | Task 5                                                    |

**与 spec 的偏离（已与用户确认）：**

- ❌ 不新建 `useLiveTranslate.ts` 编排 hook —— 复用 `useLiveApi`，仅透传语言参数（Task 6）
- ❌ 不新建 `TranslateMessageBubble.tsx` —— 复用现有 ChatMessage + audioSrc
- ❌ 不修改 `modelCatalog.ts` —— native audio 自动归类
- ✅ 新建 `useLiveTranslateConfig.ts` 为纯函数（非 hook），更易测试
