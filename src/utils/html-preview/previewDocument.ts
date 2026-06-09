import katex from 'katex';
import katexCss from 'katex/dist/katex.min.css?inline';
import { AVAILABLE_THEMES, DEFAULT_THEME_ID } from '@/constants/themeRegistry';
import { PREVIEW_BRIDGE_SCRIPT } from './previewBridgeScript';
import { sanitizeElementTree } from './previewSanitizer';
import { STREAMING_PREVIEW_RUNNER_SCRIPT } from './streamingPreviewRunnerScript';

export {
  HTML_PREVIEW_CLEAR_SELECTION_EVENT,
  HTML_PREVIEW_DIAGNOSTIC_EVENT,
  HTML_PREVIEW_MESSAGE_CHANNEL,
  HTML_PREVIEW_STREAM_RENDER_EVENT,
} from './previewMessageProtocol';

const KATEX_STYLE_ATTRIBUTE = 'data-amc-katex';
const PREVIEW_CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline' https: blob:; font-src https: data:; media-src https: data: blob:; connect-src https: data: blob:; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const PREVIEW_CONTENT_SECURITY_POLICY_META = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CONTENT_SECURITY_POLICY}">`;
const PREVIEW_BASE_FONT_SIZE_ATTRIBUTE = 'data-amc-live-artifact-base-font-size';
const PREVIEW_THEME_ATTRIBUTE = 'data-amc-live-artifact-theme';
const MATH_IGNORED_ANCESTOR_SELECTOR = 'script,style,textarea,pre,code,kbd,samp,.katex';
const DARK_LIVE_ARTIFACT_THEME_IDS = new Set(['onyx', 'graphite']);
const TEX_MATH_SIGNAL_REGEX = /[\\^_{}=+\-*/<>|]|[A-Za-z]\d|\d[A-Za-z]|[\u0370-\u03ff]/;
const TEX_MATH_ENVIRONMENT_NAMES =
  'align\\*?|aligned|alignedat|array|Bmatrix|bmatrix|cases|equation\\*?|gather\\*?|gathered|matrix|multline\\*?|pmatrix|smallmatrix|split|subarray|Vmatrix|vmatrix';
const TEX_MATH_DELIMITER_REGEX = new RegExp(
  [
    String.raw`\$\$([\s\S]+?)\$\$`,
    String.raw`\$((?:\\.|[^$\\\n])+?)\$`,
    String.raw`\\\(([\s\S]+?)\\\)`,
    String.raw`\\\[([\s\S]+?)\\\]`,
    String.raw`\\begin\{(${TEX_MATH_ENVIRONMENT_NAMES})\}([\s\S]+?)\\end\{\5\}`,
  ].join('|'),
  'g',
);
const ASYMPTOTIC_COMPLEXITY_REGEX = /^(?:O|Θ|Ω|Theta|Omega)\s*\([^)]*[A-Za-z0-9][^)]*\)$/;

const cloneIntoDocument = (node: Node, targetDocument: Document): Node => targetDocument.importNode(node, true);

const isLikelyTexMath = (value: string): boolean => {
  const normalizedValue = value.trim();

  return (
    /^[A-Za-z]$/.test(normalizedValue) ||
    TEX_MATH_SIGNAL_REGEX.test(normalizedValue) ||
    ASYMPTOTIC_COMPLEXITY_REGEX.test(normalizedValue)
  );
};

const hasTexMathDelimiterCandidate = (value: string): boolean => {
  TEX_MATH_DELIMITER_REGEX.lastIndex = 0;
  const hasCandidate = TEX_MATH_DELIMITER_REGEX.test(value);
  TEX_MATH_DELIMITER_REGEX.lastIndex = 0;
  return hasCandidate;
};

const readTexMathMatch = (
  match: RegExpMatchArray,
): { latex: string; displayMode: boolean; shouldValidateMathSignal: boolean } => {
  if (match[1] !== undefined) {
    return { latex: match[1], displayMode: true, shouldValidateMathSignal: true };
  }

  if (match[2] !== undefined) {
    return { latex: match[2], displayMode: false, shouldValidateMathSignal: true };
  }

  if (match[3] !== undefined) {
    return { latex: match[3], displayMode: false, shouldValidateMathSignal: true };
  }

  if (match[4] !== undefined) {
    return { latex: match[4], displayMode: true, shouldValidateMathSignal: true };
  }

  return { latex: match[0], displayMode: true, shouldValidateMathSignal: false };
};

const createRenderedMathFragment = (targetDocument: Document, value: string): DocumentFragment | null => {
  TEX_MATH_DELIMITER_REGEX.lastIndex = 0;

  let lastIndex = 0;
  let rendered = false;
  const fragment = targetDocument.createDocumentFragment();

  for (const match of value.matchAll(TEX_MATH_DELIMITER_REGEX)) {
    const startIndex = match.index ?? 0;

    if (startIndex > 0 && value[startIndex - 1] === '\\') {
      continue;
    }

    const rawMatch = match[0];
    const { latex: rawLatex, displayMode, shouldValidateMathSignal } = readTexMathMatch(match);
    const latex = rawLatex.trim();

    if (!latex || (shouldValidateMathSignal && !isLikelyTexMath(latex))) {
      continue;
    }

    if (startIndex > lastIndex) {
      fragment.appendChild(targetDocument.createTextNode(value.slice(lastIndex, startIndex)));
    }

    try {
      const template = targetDocument.createElement('template');
      template.innerHTML = katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
      fragment.appendChild(template.content.cloneNode(true));
      rendered = true;
    } catch {
      fragment.appendChild(targetDocument.createTextNode(rawMatch));
    }

    lastIndex = startIndex + rawMatch.length;
  }

  if (!rendered) {
    return null;
  }

  if (lastIndex < value.length) {
    fragment.appendChild(targetDocument.createTextNode(value.slice(lastIndex)));
  }

  return fragment;
};

const renderMathInDocument = (targetDocument: Document): boolean => {
  if (!targetDocument.body) {
    return false;
  }

  const showText = targetDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = targetDocument.createTreeWalker(targetDocument.body, showText);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let rendered = false;

  textNodes.forEach((textNode) => {
    if (textNode.parentElement?.closest(MATH_IGNORED_ANCESTOR_SELECTOR)) {
      return;
    }

    const renderedFragment = createRenderedMathFragment(targetDocument, textNode.data);
    if (!renderedFragment) {
      return;
    }

    textNode.replaceWith(renderedFragment);
    rendered = true;
  });

  return rendered;
};

const injectKatexStyles = (targetDocument: Document) => {
  if (targetDocument.head.querySelector(`style[${KATEX_STYLE_ATTRIBUTE}]`)) {
    return;
  }

  const styleElement = targetDocument.createElement('style');
  styleElement.setAttribute(KATEX_STYLE_ATTRIBUTE, 'true');
  styleElement.textContent = katexCss;
  targetDocument.head.appendChild(styleElement);
};

const renderPreviewMath = (srcDoc: string): string => {
  if (!hasTexMathDelimiterCandidate(srcDoc) || typeof DOMParser === 'undefined') {
    return srcDoc;
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(srcDoc, 'text/html');

  if (renderMathInDocument(parsedDocument)) {
    injectKatexStyles(parsedDocument);
  }

  return `<!DOCTYPE html>${parsedDocument.documentElement.outerHTML}`;
};

const injectPreviewSecurityPolicy = (srcDoc: string): string => {
  if (srcDoc.includes(PREVIEW_CONTENT_SECURITY_POLICY)) {
    return srcDoc;
  }

  if (/<head\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<head\b[^>]*>/i, (headTag) => `${headTag}${PREVIEW_CONTENT_SECURITY_POLICY_META}`);
  }

  if (/<html\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(
      /<html\b[^>]*>/i,
      (htmlTag) => `${htmlTag}<head>${PREVIEW_CONTENT_SECURITY_POLICY_META}</head>`,
    );
  }

  return `<!DOCTYPE html><html><head>${PREVIEW_CONTENT_SECURITY_POLICY_META}</head><body>${srcDoc}</body></html>`;
};

const injectPreviewHeadStyle = (srcDoc: string, style: string): string => {
  if (srcDoc.includes(PREVIEW_CONTENT_SECURITY_POLICY_META)) {
    return srcDoc.replace(PREVIEW_CONTENT_SECURITY_POLICY_META, `${PREVIEW_CONTENT_SECURITY_POLICY_META}${style}`);
  }

  if (/<head\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<head\b[^>]*>/i, (headTag) => `${headTag}${style}`);
  }

  if (/<html\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<html\b[^>]*>/i, (htmlTag) => `${htmlTag}<head>${style}</head>`);
  }

  return `<!DOCTYPE html><html><head>${style}</head><body>${srcDoc}</body></html>`;
};

const resolvePreviewTheme = (themeId?: string) => {
  return (
    AVAILABLE_THEMES.find((theme) => theme.id === themeId) ??
    AVAILABLE_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ??
    AVAILABLE_THEMES[0]
  );
};

const buildPreviewThemeStyle = (themeId?: string): string => {
  const theme = resolvePreviewTheme(themeId);
  const colors = theme.colors;
  const colorScheme = DARK_LIVE_ARTIFACT_THEME_IDS.has(theme.id) ? 'dark' : 'light';

  return `<style ${PREVIEW_THEME_ATTRIBUTE}="true">:root{color-scheme:${colorScheme};--amc-live-artifact-text:${colors.textPrimary};--amc-live-artifact-muted:${colors.textSecondary};--amc-live-artifact-subtle:${colors.textTertiary};--amc-live-artifact-surface:${colors.bgTertiary};--amc-live-artifact-surface-muted:${colors.bgInput};--amc-live-artifact-border:${colors.borderSecondary};--amc-live-artifact-accent:${colors.textLink};--amc-live-artifact-accent-surface:${colors.bgAccent};--amc-live-artifact-success:${colors.textSuccess};--amc-live-artifact-danger:${colors.textDanger};--amc-live-artifact-warning:${colors.textWarning};}html,body{margin:0;padding:0;background:transparent!important;color:var(--amc-live-artifact-text);}</style>`;
};

const injectPreviewTheme = (srcDoc: string, themeId?: string): string => {
  if (srcDoc.includes(PREVIEW_THEME_ATTRIBUTE)) {
    return srcDoc;
  }

  return injectPreviewHeadStyle(srcDoc, buildPreviewThemeStyle(themeId));
};

const buildPreviewBaseFontSizeStyle = (baseFontSize?: number): string => {
  if (typeof baseFontSize !== 'number' || !Number.isFinite(baseFontSize)) {
    return '';
  }

  const fontSize = Math.max(1, Math.round(baseFontSize));
  return `<style ${PREVIEW_BASE_FONT_SIZE_ATTRIBUTE}="true">:root{--amc-live-artifact-font-size:${fontSize}px;font-size:var(--amc-live-artifact-font-size);}body{font-size:var(--amc-live-artifact-font-size);}</style>`;
};

const injectPreviewBaseFontSize = (srcDoc: string, baseFontSize?: number): string => {
  const style = buildPreviewBaseFontSizeStyle(baseFontSize);
  if (!style || srcDoc.includes(PREVIEW_BASE_FONT_SIZE_ATTRIBUTE)) {
    return srcDoc;
  }

  return injectPreviewHeadStyle(srcDoc, style);
};

const prepareHtmlPreviewSrcDoc = (srcDoc: string, options: { baseFontSize?: number; themeId?: string } = {}): string =>
  renderPreviewMath(
    injectPreviewBaseFontSize(
      injectPreviewTheme(injectPreviewSecurityPolicy(srcDoc), options.themeId),
      options.baseFontSize,
    ),
  );

export const buildStreamingHtmlPreviewRenderPayload = (htmlContent: string): string => {
  return renderPreviewMath(htmlContent);
};

export const buildHtmlPreviewSrcDoc = (
  htmlContent: string,
  options: { baseFontSize?: number; themeId?: string } = {},
): string => {
  let srcDoc: string;

  if (!htmlContent) {
    srcDoc = `<!DOCTYPE html><html><body>${PREVIEW_BRIDGE_SCRIPT}</body></html>`;
    return prepareHtmlPreviewSrcDoc(srcDoc, options);
  }

  if (/<\/body>/i.test(htmlContent)) {
    srcDoc = htmlContent.replace(/<\/body>/i, `${PREVIEW_BRIDGE_SCRIPT}</body>`);
    return prepareHtmlPreviewSrcDoc(srcDoc, options);
  }

  if (/<\/html>/i.test(htmlContent)) {
    srcDoc = htmlContent.replace(/<\/html>/i, `${PREVIEW_BRIDGE_SCRIPT}</html>`);
    return prepareHtmlPreviewSrcDoc(srcDoc, options);
  }

  srcDoc = `<!DOCTYPE html><html><body>${htmlContent}${PREVIEW_BRIDGE_SCRIPT}</body></html>`;
  return prepareHtmlPreviewSrcDoc(srcDoc, options);
};

export const buildStreamingHtmlPreviewSrcDoc = (options: { baseFontSize?: number; themeId?: string } = {}): string => {
  const srcDoc = `<!DOCTYPE html><html><body><div data-amc-stream-preview-root="true"></div>${PREVIEW_BRIDGE_SCRIPT}${STREAMING_PREVIEW_RUNNER_SCRIPT}</body></html>`;
  return prepareHtmlPreviewSrcDoc(srcDoc, options);
};

export const createStaticPreviewSnapshotContainer = (
  htmlContent: string,
  targetDocument: Document,
): { container: HTMLElement; cleanup: () => void } => {
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(htmlContent, 'text/html');

  sanitizeElementTree(parsedDocument);

  const container = targetDocument.createElement('div');
  container.className = 'is-exporting-png html-preview-snapshot';
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1200px',
    transform: 'translateX(-200vw)',
    pointerEvents: 'none',
    zIndex: '-1',
    overflow: 'hidden',
    background: '#ffffff',
  });

  parsedDocument.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    container.appendChild(cloneIntoDocument(node, targetDocument));
  });

  const bodyWrapper = targetDocument.createElement('div');
  bodyWrapper.className = parsedDocument.body.className;
  const inlineBodyStyle = parsedDocument.body.getAttribute('style');
  if (inlineBodyStyle) {
    bodyWrapper.setAttribute('style', inlineBodyStyle);
  }

  Array.from(parsedDocument.body.childNodes).forEach((node) => {
    bodyWrapper.appendChild(cloneIntoDocument(node, targetDocument));
  });

  container.appendChild(bodyWrapper);
  targetDocument.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      container.remove();
    },
  };
};
