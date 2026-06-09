import { logService } from '@/services/logService';
import { sanitizeCssColorFunctionsForPngExport } from './cssColorSanitizer';
import { isDarkThemeId } from '@/utils/themeMode';

const DEFAULT_EXPORT_WIDTH = '800px';

const isExportableStylesheetContentType = (contentType: string): boolean =>
  contentType.includes('text/css') || contentType.includes('application/octet-stream');

/**
 * Gathers all style and link tags from the current document's head to be inlined.
 * @returns A promise that resolves to a string of HTML style and link tags.
 */
export const gatherPageStyles = async (): Promise<string> => {
  const stylePromises = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).map(
    async (element) => {
      if (element.tagName === 'STYLE') {
        return `<style>${sanitizeCssColorFunctionsForPngExport(element.innerHTML)}</style>`;
      }
      if (element.tagName === 'LINK' && (element as HTMLLinkElement).rel === 'stylesheet') {
        const href = (element as HTMLLinkElement).href;

        try {
          const response = await fetch(href);
          if (!response.ok) throw new Error(response.statusText);

          const contentType = response.headers.get('content-type');
          if (contentType && !isExportableStylesheetContentType(contentType)) {
            logService.warn(`Skipping stylesheet ${href} due to invalid MIME: ${contentType}`);
            return '';
          }

          const stylesheetCss = await response.text();
          return `<style>${sanitizeCssColorFunctionsForPngExport(stylesheetCss)}</style>`;
        } catch (stylesheetError) {
          logService.warn('Could not fetch stylesheet for export.', { href, error: stylesheetError });
          return '';
        }
      }
      return '';
    },
  );

  return (await Promise.all(stylePromises)).join('\n');
};

/**
 * Embeds images in a cloned DOM element by converting their sources to Base64 data URIs.
 * This allows the HTML to be self-contained (offline-capable).
 * @param clone The cloned HTMLElement to process.
 */
const embedImagesInClone = async (clone: HTMLElement): Promise<void> => {
  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('data:')) return;

        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              img.src = reader.result;
              img.removeAttribute('srcset');
              img.removeAttribute('loading');
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(blob);
        });
      } catch (embedError) {
        logService.warn('Failed to embed image for export:', embedError);
      }
    }),
  );
};

/**
 * Creates an isolated DOM container for exporting, injecting current styles and theme.
 */
export const createSnapshotContainer = async (
  themeId: string,
  width: string = DEFAULT_EXPORT_WIDTH,
): Promise<{ container: HTMLElement; innerContent: HTMLElement; remove: () => void; rootBgColor: string }> => {
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '0px';
  tempContainer.style.width = width;
  tempContainer.style.padding = '0';
  tempContainer.style.zIndex = '-1';
  tempContainer.style.boxSizing = 'border-box';

  const allStyles = await gatherPageStyles();
  const bodyClasses = document.body.className;

  let rootBgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim();
  if (!rootBgColor) {
    rootBgColor = isDarkThemeId(themeId) ? '#09090b' : '#FFFFFF';
  }

  tempContainer.innerHTML = `
        ${allStyles}
        <div class="theme-${themeId} ${bodyClasses} is-exporting-png" style="background-color: ${rootBgColor}; color: var(--theme-text-primary); min-height: 100vh;">
            <div style="background-color: ${rootBgColor}; padding: 0;">
                <div class="exported-chat-container" style="width: 100%; max-width: 100%; margin: 0 auto;">
                </div>
            </div>
        </div>
    `;

  document.body.appendChild(tempContainer);

  const innerContent = tempContainer.querySelector('.exported-chat-container') as HTMLElement;
  const captureTarget = tempContainer.querySelector<HTMLElement>(':scope > div');

  if (!innerContent || !captureTarget) {
    document.body.removeChild(tempContainer);
    throw new Error('Failed to create snapshot container structure');
  }

  return {
    container: captureTarget,
    innerContent,
    remove: () => {
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
    },
    rootBgColor,
  };
};

/**
 * Creates a standard header DOM element for exported images.
 */
export const createExportDOMHeader = (title: string, metaLeft: string, metaRight: string): HTMLElement => {
  const headerDiv = document.createElement('div');
  headerDiv.style.padding = '2rem 2rem 1rem 2rem';
  headerDiv.style.borderBottom = '1px solid var(--theme-border-secondary)';
  headerDiv.style.marginBottom = '1rem';

  const titleEl = document.createElement('h1');
  titleEl.style.fontSize = '1.5rem';
  titleEl.style.fontWeight = 'bold';
  titleEl.style.color = 'var(--theme-text-primary)';
  titleEl.style.marginBottom = '0.5rem';
  titleEl.textContent = title;

  const metaDiv = document.createElement('div');
  metaDiv.style.fontSize = '0.875rem';
  metaDiv.style.color = 'var(--theme-text-tertiary)';
  metaDiv.style.display = 'flex';
  metaDiv.style.gap = '1rem';

  const leftSpan = document.createElement('span');
  leftSpan.textContent = metaLeft;
  const separatorSpan = document.createElement('span');
  separatorSpan.textContent = '•';
  const rightSpan = document.createElement('span');
  rightSpan.textContent = metaRight;

  headerDiv.appendChild(titleEl);
  metaDiv.appendChild(leftSpan);
  metaDiv.appendChild(separatorSpan);
  metaDiv.appendChild(rightSpan);
  headerDiv.appendChild(metaDiv);

  return headerDiv;
};

/**
 * Clones, cleans, and prepares a DOM element for export (HTML or PNG).
 * Handles removing interactive elements, expanding content, embedding images,
 * and normalizing layout artifacts from virtualization.
 */
export const prepareElementForExport = async (
  sourceElement: HTMLElement,
  options: { expandDetails?: boolean } = {},
): Promise<HTMLElement> => {
  const { expandDetails = true } = options;

  const clone = sourceElement.cloneNode(true) as HTMLElement;

  // Normalize virtualization offsets before snapshotting.
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';

  const potentialLists = Array.from(clone.children) as HTMLElement[];
  potentialLists.forEach((child) => {
    if (child.style.paddingTop) child.style.paddingTop = '0px';
    if (child.style.marginTop) child.style.marginTop = '0px';
    if (child.style.transform) child.style.transform = 'none';
    if (child.style.position === 'absolute') child.style.position = 'static';
  });

  const selectorsToRemove = [
    'button',
    '.message-actions',
    '.sticky',
    'input',
    'textarea',
    '.code-block-utility-button',
    '[role="tooltip"]',
    '.loading-dots-container',
  ];
  clone.querySelectorAll(selectorsToRemove.join(',')).forEach((element) => element.remove());

  clone.querySelectorAll('[data-message-id]').forEach((element) => {
    (element as HTMLElement).style.animation = 'none';
    (element as HTMLElement).style.opacity = '1';
    (element as HTMLElement).style.transform = 'none';
  });

  if (expandDetails) {
    clone.querySelectorAll('.message-thoughts-block').forEach((element) => element.remove());

    clone.querySelectorAll('.code-block-expand-overlay').forEach((element) => element.remove());

    clone.querySelectorAll('pre').forEach((element) => {
      (element as HTMLElement).style.maxHeight = 'none';
      (element as HTMLElement).style.height = 'auto';
      (element as HTMLElement).style.overflow = 'visible';
    });

    clone.querySelectorAll('details').forEach((element) => element.setAttribute('open', 'true'));
  } else {
    clone.querySelectorAll('details').forEach((element) => element.removeAttribute('open'));

    clone.querySelectorAll('.thought-process-accordion').forEach((accordion) => {
      const parent = accordion.parentElement;
      if (!parent) return;

      const header = parent.firstElementChild as HTMLElement;
      if (!header || header === accordion) return;

      const details = document.createElement('details');
      details.className = parent.className;

      const summary = document.createElement('summary');
      summary.className = header.className;
      summary.style.cursor = 'pointer';
      summary.style.listStyle = 'none';

      const style = document.createElement('style');
      style.textContent = 'summary::-webkit-details-marker { display: none; }';
      summary.appendChild(style);

      while (header.firstChild) {
        summary.appendChild(header.firstChild);
      }

      const svg = summary.querySelector('svg');
      if (svg && svg.classList.contains('transition-transform')) {
        svg.classList.remove('rotate-180');
        svg.classList.add('group-open:rotate-180');
      }

      const inner = accordion.querySelector('.thought-process-inner') || accordion;
      const contentWrapper = document.createElement('div');
      contentWrapper.className = inner.className;

      while (inner.firstChild) {
        contentWrapper.appendChild(inner.firstChild);
      }

      details.appendChild(summary);
      details.appendChild(contentWrapper);

      parent.replaceWith(details);
    });
  }

  // Embed blob and remote images before the clone leaves the live document.
  await embedImagesInClone(clone);

  return clone;
};
