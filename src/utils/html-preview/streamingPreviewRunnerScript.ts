import { HTML_PREVIEW_MESSAGE_CHANNEL, HTML_PREVIEW_STREAM_RENDER_EVENT } from './previewMessageProtocol';
import { STREAM_SANITIZER_SCRIPT } from './previewSanitizer';

export const STREAMING_PREVIEW_RUNNER_SCRIPT = `<script>
(() => {
  const channel = ${JSON.stringify(HTML_PREVIEW_MESSAGE_CHANNEL)};
  const streamRenderEvent = ${JSON.stringify(HTML_PREVIEW_STREAM_RENDER_EVENT)};
  const root = document.querySelector('[data-amc-stream-preview-root]');
${STREAM_SANITIZER_SCRIPT}
  const syncAttributes = (currentElement, nextElement) => {
    Array.from(currentElement.attributes).forEach((attribute) => {
      if (!nextElement.hasAttribute(attribute.name)) {
        currentElement.removeAttribute(attribute.name);
      }
    });

    Array.from(nextElement.attributes).forEach((attribute) => {
      if (currentElement.getAttribute(attribute.name) !== attribute.value) {
        currentElement.setAttribute(attribute.name, attribute.value);
      }
    });
  };

  const canPatchNode = (currentNode, nextNode) => {
    if (currentNode.nodeType !== nextNode.nodeType) return false;
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      return currentNode.nodeName === nextNode.nodeName;
    }
    return true;
  };

  const patchNode = (currentNode, nextNode) => {
    if (!canPatchNode(currentNode, nextNode)) {
      currentNode.replaceWith(nextNode);
      return;
    }

    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.nodeValue !== nextNode.nodeValue) {
        currentNode.nodeValue = nextNode.nodeValue;
      }
      return;
    }

    if (currentNode.nodeType !== Node.ELEMENT_NODE) {
      currentNode.replaceWith(nextNode);
      return;
    }

    syncAttributes(currentNode, nextNode);
    patchChildren(currentNode, nextNode);
  };

  const patchChildren = (currentParent, nextParent) => {
    const currentChildren = Array.from(currentParent.childNodes);
    const nextChildren = Array.from(nextParent.childNodes);
    const maxLength = Math.max(currentChildren.length, nextChildren.length);

    for (let index = 0; index < maxLength; index += 1) {
      const currentChild = currentChildren[index];
      const nextChild = nextChildren[index];

      if (!nextChild) {
        currentChild.remove();
        continue;
      }

      if (!currentChild) {
        currentParent.appendChild(nextChild);
        continue;
      }

      patchNode(currentChild, nextChild);
    }
  };

  const buildRenderableFragment = (parsedDocument) => {
    const fragment = document.createDocumentFragment();
    parsedDocument.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      fragment.appendChild(document.importNode(node, true));
    });
    Array.from(parsedDocument.body.childNodes).forEach((node) => {
      fragment.appendChild(document.importNode(node, true));
    });
    return fragment;
  };

  const syncDocumentAttributes = (parsedDocument) => {
    if (document.documentElement && parsedDocument.documentElement) {
      syncAttributes(document.documentElement, parsedDocument.documentElement);
    }

    if (document.body && parsedDocument.body) {
      syncAttributes(document.body, parsedDocument.body);
    }
  };

  const renderHtml = (html) => {
    if (!root || typeof html !== 'string') return;

    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(html, 'text/html');
    sanitizeElementTree(parsedDocument);
    syncDocumentAttributes(parsedDocument);
    const fragment = buildRenderableFragment(parsedDocument);
    if (!root.hasChildNodes()) {
      root.replaceChildren(fragment);
      return;
    }
    patchChildren(root, fragment);
  };

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.channel !== channel || event.data.event !== streamRenderEvent) {
      return;
    }

    renderHtml(event.data.html);
  });
})();
</script>`;
