# Gemini 3.5 Live Translate 集成设计

**日期**: 2026-06-14
**项目**: AMC-WebUI
**状态**: 已批准

## 概述

将 Google Gemini 3.5 Live Translate（`gemini-3.5-live-translate-preview`）集成到 AMC-WebUI 中。用户在模型列表中选择该模型后，界面自动切换到实时语音翻译模式：对着麦克风说话，模型实时返回翻译后的语音，翻译结果以聊天消息气泡形式（原文+译文+可播放音频）保存到聊天记录中。

## 背景

Gemini 3.5 Live Translate 是谷歌最新的音频到音频实时翻译模型，支持 70+ 种语言，通过 `bidiGenerateContent`（WebSocket 双向流式）调用。AMC-WebUI 已有完善的 Live API 基础设施（`useLiveConnection`、PCM 音频处理、实时音频播放），本设计最大化复用这些现有能力。

## 功能需求

1. **模型注册**：将 `gemini-3.5-live-translate-preview` 加入模型选择器
2. **自动切换**：选中后自动进入语音翻译模式
3. **双向语言选择**：用户可选择源语言（含"自动检测"）和目标语言
4. **聊天消息输出**：每轮翻译结果以消息气泡形式展示（原文+译文+音频播放器）
5. **实时播放**：录音期间翻译音频流式实时播放
6. **历史保存**：翻译消息存入 chatStore，IndexedDB 持久化

## 技术设计

### 1. 模型注册与检测

**模型注册** — `src/constants/modelRegistry.ts`：

- `ModelRegistryGroup` 类型新增 `'liveTranslate'`
- 注册 `{ id: 'gemini-3.5-live-translate-preview', name: 'Gemini 3.5 Live Translate', groups: ['defaultPinned', 'liveTranslate'] }`

**模型检测** — `src/utils/modelCapabilities.ts`：

```typescript
export function isLiveTranslateModel(id: string): boolean {
  return id.includes('live-translate');
}
```

- `getModelCapabilities()` 返回值新增 `isLiveTranslate: boolean`
- `ModelInteractionPermissions` 新增 `canUseLiveTranslate: boolean`（仅 `isLiveTranslateModel` 为 true 时生效）
- `canUseLiveControls` 也为 true（复用 Live 模式 UI 框架）

**模型目录** — `src/utils/modelCatalog.ts`：`isLiveTranslateModel` 为 true 的模型归入 `'live'` 类别。

### 2. WebSocket 连接与配置

**新建 `src/hooks/live-api/useLiveTranslateConfig.ts`**：

构建 Live Translate 专用的精简 config，与普通 Live API 的差异：

| 配置项                   | 普通 Live API | Live Translate       |
| ------------------------ | ------------- | -------------------- |
| voiceConfig              | 需要          | 不需要               |
| systemInstruction        | 可选          | 轻量（语言方向提示） |
| tools                    | 支持          | 不需要               |
| thinkingConfig           | 可选          | 不需要               |
| inputAudioTranscription  | 需要          | 不需要               |
| outputAudioTranscription | 需要          | 不需要               |
| contextWindowCompression | 需要          | 不需要               |

```typescript
function useLiveTranslateConfig(settings: LiveTranslateSettings) {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: {
      parts: [
        {
          text:
            settings.sourceLanguage === 'auto'
              ? `Translate into ${settings.targetLanguage}.`
              : `Translate from ${settings.sourceLanguage} into ${settings.targetLanguage}.`,
        },
      ],
    },
  };
}
```

**连接** — 复用 `useLiveConnection` hook，传入精简 config。

**音频参数**：

- 输入：`audio/pcm;rate=16000`（复用现有采集管线）
- 输出：`audio/pcm;rate=24000`（现有 Live API 已处理多采样率播放）

**自动重连** — 复用现有 5 次指数退避逻辑。

### 3. UI 交互流程

**选中模型后**：

1. `modelCapabilities` 检测到 `isLiveTranslate: true`
2. UI 自动切换到 Live 模式（复用 `canUseLiveControls` 切换逻辑）
3. Live 模式工具栏显示**语言方向选择器**（替代普通 Live 模式的 voice 选择器）

**语言方向选择器**：

- 源语言：自动检测 + English / 简体中文 / 繁体中文 / 日本語 / 한국어 / Español / Français / Deutsch
- 目标语言：同上列表（不含自动检测）
- 复用现有 `TRANSLATION_TARGET_LANGUAGE_OPTIONS` 的值

**录音交互**：

- 点击麦克风 → 开始录音 + 建立 WebSocket 连接
- 实时发送音频流 → 模型实时返回翻译音频 → 流式实时播放
- 点击停止 → 结束本轮，翻译结果固化为一条聊天消息

### 4. 消息渲染与存储

**消息数据结构**：

Live Translate 模型默认只返回音频。文字（原文/译文）为可选字段——如果模型在响应中包含 text part 则记录，否则仅保存音频。

```typescript
interface TranslateMessageData {
  sourceText?: string; // 原文（可选，模型可能不返回文字）
  translatedText?: string; // 译文（可选，模型可能不返回文字）
  audioUrl?: string; // 翻译音频 Blob URL
  sourceLanguage: string; // 用户设置的源语言
  targetLanguage: string; // 用户设置的目标语言
  duration: number; // 音频时长（秒）
}
```

**消息气泡** — 新建 `src/components/chat/message-list/TranslateMessageBubble.tsx`：

- 上半部分：原文（可选，如果模型返回了文字则显示，次要色）
- 分隔线（仅当有文字时显示）
- 下半部分：目标语言标签 + 音频播放器 + 译文文字（可选）
- 如果模型未返回文字，气泡仅显示音频播放器和语言标签

**音频处理**：

- 录音期间：翻译音频块流式实时播放（低延迟）
- 录音停止：完整音频转为 WAV Blob → `URL.createObjectURL()` → 存入消息

**存储** — 翻译消息存入 `chatStore` 的 messages 数组，IndexedDB 持久化，与普通聊天消息统一管理。

### 5. Settings

**新增字段** — `src/types/settings.ts` 的 `AppSettings`：

```typescript
liveTranslateSourceLanguage: string; // 默认 'auto'
liveTranslateTargetLanguage: string; // 默认 'English'
```

`src/stores/settingsStore.ts` 的 `sanitizeAppSettings()` 中新增这两个字段的默认值处理。

**i18n** — `src/i18n/` en/zh 文件新增翻译相关文案。

## 新增/修改文件清单

| 文件                                                          | 操作                                |
| ------------------------------------------------------------- | ----------------------------------- |
| `src/constants/modelRegistry.ts`                              | 修改：注册新模型 + 新增 group       |
| `src/utils/modelCapabilities.ts`                              | 修改：新增 `isLiveTranslateModel()` |
| `src/utils/modelCatalog.ts`                                   | 修改：分类到 `'live'` 类别          |
| `src/types/settings.ts`                                       | 修改：新增语言设置字段              |
| `src/stores/settingsStore.ts`                                 | 修改：sanitize 新字段               |
| `src/hooks/live-api/useLiveTranslateConfig.ts`                | 新建：精简 config builder           |
| `src/hooks/live-api/useLiveTranslate.ts`                      | 新建：编排 hook                     |
| `src/components/chat/message-list/TranslateMessageBubble.tsx` | 新建：翻译消息气泡                  |
| `src/components/chat/input/LanguageSelector.tsx`              | 新建：语言选择器                    |
| `src/i18n/en.json` / `zh.json`                                | 修改：新增文案                      |

## 不涉及的范围

- 不修改后端代理服务器（浏览器直连 Google API）
- 不修改 MCP、Pyodide、图片生成等无关模块
- 不新增第三方依赖
