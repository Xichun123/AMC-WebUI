import { HTML_PREVIEW_DIAGNOSTIC_EVENT, HTML_PREVIEW_MESSAGE_CHANNEL } from './previewMessageProtocol';

export const PREVIEW_BRIDGE_SCRIPT = `<script>
(() => {
  const channel = ${JSON.stringify(HTML_PREVIEW_MESSAGE_CHANNEL)};
  const notify = (event, payload) => {
    try {
      parent.postMessage(payload === undefined ? { channel, event } : { channel, event, payload }, '*');
    } catch {}
  };
  const notifyDiagnostic = (payload) => notify(${JSON.stringify(HTML_PREVIEW_DIAGNOSTIC_EVENT)}, payload);
  const readResourceUrl = (element) => {
    if (!(element instanceof Element)) return undefined;
    return element.getAttribute('src') || element.getAttribute('href') || element.getAttribute('poster') || undefined;
  };
  const isSupportedResourceError = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    if (!['img', 'script', 'link', 'video', 'audio', 'source'].includes(tagName)) {
      return false;
    }

    notifyDiagnostic({
      type: 'resource-error',
      tagName,
      url: readResourceUrl(target),
    });
    return true;
  };
  window.addEventListener('error', (event) => {
    if (isSupportedResourceError(event)) return;

    notifyDiagnostic({
      type: 'runtime-error',
      message: event.message || 'Unknown preview runtime error',
      source: event.filename || undefined,
      line: event.lineno || undefined,
      column: event.colno || undefined,
    });
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    notifyDiagnostic({
      type: 'runtime-error',
      message: reason && typeof reason.message === 'string' ? reason.message : String(reason || 'Unhandled promise rejection'),
    });
  });
  window.addEventListener('securitypolicyviolation', (event) => {
    notifyDiagnostic({
      type: 'csp-violation',
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
    });
  });
  const notifyResize = () => {
    try {
      const body = document.body;
      const root = document.documentElement;
      const height = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        root ? root.scrollHeight : 0,
        root ? root.offsetHeight : 0
      );
      parent.postMessage({ channel, event: 'resize', height }, '*');
    } catch {}
  };

  let resizeFrame = 0;
  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      notifyResize();
    });
  };

  const notifyReady = () => {
    notify('ready');
    scheduleResize();
  };

  if (document.readyState === 'complete') {
    Promise.resolve().then(notifyReady);
  } else {
    window.addEventListener('load', notifyReady, { once: true });
  }

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleResize);
    if (document.documentElement) observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }

  if ('MutationObserver' in window) {
    const observer = new MutationObserver(scheduleResize);
    observer.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true });
  }

  window.addEventListener('resize', scheduleResize);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      notify('escape');
    }
  });

  const isEditableElement = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
  };

  const getElementForNode = (node) => {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  };

  const notifySelection = () => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        notify('selection', null);
        return;
      }

      const range = selection.getRangeAt(0);
      const targetElement = getElementForNode(range.commonAncestorContainer);
      if (isEditableElement(targetElement)) {
        notify('selection', null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        notify('selection', null);
        return;
      }

      const rect = range.getBoundingClientRect();
      notify('selection', {
        text,
        copyText: text,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
        },
      });
    } catch {
      notify('selection', null);
    }
  };

  let selectionFrame = 0;
  const scheduleSelection = () => {
    if (selectionFrame) return;
    selectionFrame = requestAnimationFrame(() => {
      selectionFrame = 0;
      notifySelection();
    });
  };

  document.addEventListener('selectionchange', scheduleSelection);
  document.addEventListener('mouseup', scheduleSelection);
  document.addEventListener('keyup', scheduleSelection);

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.channel !== channel || event.data.event !== 'clear-selection') {
      return;
    }

    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  });

  const parseFollowupPayload = (rawPayload) => {
    const trimmedPayload = rawPayload.trim();
    if (!trimmedPayload) return null;

    try {
      const parsedPayload = JSON.parse(trimmedPayload);
      if (typeof parsedPayload === 'string') {
        const instruction = parsedPayload.trim();
        return instruction ? { instruction } : null;
      }
      return parsedPayload;
    } catch (error) {
      if (/^[{[]/.test(trimmedPayload)) {
        console.warn('Invalid Live Artifact follow-up payload.', error);
        return null;
      }

      return { instruction: trimmedPayload };
    }
  };

  const readFollowupPayload = (target) => {
    if (!(target instanceof Element)) return null;
    const trigger = target.closest('[data-amc-followup]');
    if (!trigger) return null;

    const rawPayload = trigger.getAttribute('data-amc-followup');
    if (!rawPayload) return null;

    const payload = parseFollowupPayload(rawPayload);
    return payload ? mergeFollowupState(payload, collectFollowupState(trigger)) : null;
  };

  const resolveFollowupScope = (trigger) => {
    const scopeSelector = trigger.getAttribute('data-amc-followup-scope');
    if (scopeSelector && scopeSelector.trim()) {
      try {
        return document.querySelector(scopeSelector) || trigger.closest(scopeSelector) || document;
      } catch {
        return document;
      }
    }

    return trigger.closest('[data-amc-followup-scope]') || document;
  };

  const readStateValue = (element) => {
    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      if (inputType === 'checkbox') return element.checked;
      if (inputType === 'radio') return element.checked ? element.value || true : undefined;
      if (inputType === 'number' || inputType === 'range') {
        return element.value === '' || Number.isNaN(element.valueAsNumber) ? element.value : element.valueAsNumber;
      }
      return element.value;
    }

    if (element instanceof HTMLSelectElement) {
      if (element.multiple) {
        return Array.from(element.selectedOptions).map((option) => option.value);
      }
      return element.value;
    }

    if (element instanceof HTMLTextAreaElement) return element.value;

    const stateValue = element.getAttribute('data-amc-state-value');
    if (stateValue !== null) {
      const isToggleLike =
        element.hasAttribute('aria-pressed') ||
        element.hasAttribute('aria-selected') ||
        element.hasAttribute('aria-checked');
      if (!isToggleLike) return stateValue;

      const isActive =
        element.getAttribute('aria-pressed') === 'true' ||
        element.getAttribute('aria-selected') === 'true' ||
        element.getAttribute('aria-checked') === 'true';
      return isActive ? stateValue : undefined;
    }

    const textValue = element.textContent ? element.textContent.trim() : '';
    return textValue || undefined;
  };

  const appendStateValue = (state, key, value) => {
    if (value === undefined) return;

    if (Object.prototype.hasOwnProperty.call(state, key)) {
      state[key] = Array.isArray(state[key]) ? [...state[key], value] : [state[key], value];
      return;
    }

    state[key] = value;
  };

  const collectFollowupState = (trigger) => {
    const scope = resolveFollowupScope(trigger);
    const state = {};
    const stateElements = [];

    if (scope instanceof Element && scope.matches('[data-amc-state-key]')) {
      stateElements.push(scope);
    }

    stateElements.push(...Array.from(scope.querySelectorAll('[data-amc-state-key]')));

    stateElements.forEach((element) => {
      const key = element.getAttribute('data-amc-state-key');
      if (!key || element.disabled) return;

      appendStateValue(state, key, readStateValue(element));
    });

    return state;
  };

  const mergeFollowupState = (payload, collectedState) => {
    if (!collectedState || Object.keys(collectedState).length === 0) return payload;

    const existingState =
      payload && typeof payload.state === 'object' && !Array.isArray(payload.state)
        ? payload.state
        : payload && payload.state !== undefined
          ? { value: payload.state }
          : {};

    return {
      ...payload,
      state: {
        ...existingState,
        ...collectedState,
      },
    };
  };

  document.addEventListener('click', (event) => {
    const payload = readFollowupPayload(event.target);
    if (!payload) return;

    event.preventDefault();
    notify('followup', payload);
  });
})();
</script>`;
