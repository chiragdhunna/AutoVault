/**
 * Visual feedback injected entirely from JS (keeps the content script a single
 * self-contained file). Highly specific class names + !important avoid
 * interfering with the host page's own styles.
 */

let stylesInjected = false;

const STYLE_ID = 'autovault-injected-styles';

function ensureStyles(): void {
  if (stylesInjected || document.getElementById(STYLE_ID)) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes autovault-fade {
      0%   { box-shadow: 0 0 0 3px rgba(46,139,87,0.85); background-color: rgba(46,139,87,0.10); }
      100% { box-shadow: 0 0 0 3px rgba(46,139,87,0.0);  background-color: rgba(46,139,87,0.0); }
    }
    .autovault-filled {
      animation: autovault-fade 1.8s ease-out forwards !important;
      border-radius: 4px;
    }
    .autovault-file-flag {
      outline: 2px dashed #2f6df6 !important;
      outline-offset: 2px !important;
    }
    .autovault-hint {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      margin: 6px 0 !important;
      padding: 6px 10px !important;
      background: #eaf1ff !important;
      color: #1b2430 !important;
      border: 1px solid #2f6df6 !important;
      border-radius: 8px !important;
      font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 0 2px 8px rgba(16,24,40,0.12) !important;
      max-width: 320px !important;
      z-index: 2147483000 !important;
    }
    .autovault-hint__btn {
      appearance: none !important;
      border: 1px solid #2f6df6 !important;
      background: #2f6df6 !important;
      color: #fff !important;
      border-radius: 6px !important;
      padding: 3px 8px !important;
      font: 600 11px -apple-system, BlinkMacSystemFont, sans-serif !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }
    .autovault-hint__close {
      appearance: none !important;
      border: none !important;
      background: none !important;
      color: #6a7683 !important;
      cursor: pointer !important;
      font-size: 14px !important;
      line-height: 1 !important;
      padding: 0 2px !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  stylesInjected = true;
}

export function highlightFilled(el: Element): void {
  ensureStyles();
  el.classList.remove('autovault-filled');
  // reflow so the animation restarts if the element was highlighted before
  void (el as HTMLElement).offsetWidth;
  el.classList.add('autovault-filled');
  window.setTimeout(() => el.classList.remove('autovault-filled'), 2000);
}

/**
 * Flag a file input the user must fill manually, with a one-click helper to copy
 * the stored filename. Browsers forbid programmatically setting file inputs, so
 * this is the safe, honest alternative.
 */
export function flagFileInput(input: HTMLInputElement, filename: string | undefined, label: string): void {
  ensureStyles();
  if (input.dataset.autovaultFlagged === '1') return;
  input.dataset.autovaultFlagged = '1';
  input.classList.add('autovault-file-flag');

  const hint = document.createElement('div');
  hint.className = 'autovault-hint';
  hint.setAttribute('role', 'note');

  const text = document.createElement('span');
  text.textContent = filename ? `📎 ${label}: attach “${filename}” here` : `📎 Attach your ${label} here`;
  hint.appendChild(text);

  if (filename) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'autovault-hint__btn';
    btn.textContent = 'Copy filename';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(filename);
        btn.textContent = 'Copied ✓';
        window.setTimeout(() => (btn.textContent = 'Copy filename'), 1500);
      } catch {
        btn.textContent = 'Copy failed';
      }
    });
    hint.appendChild(btn);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'autovault-hint__close';
  close.textContent = '✕';
  close.title = 'Dismiss';
  close.addEventListener('click', (e) => {
    e.preventDefault();
    hint.remove();
    input.classList.remove('autovault-file-flag');
  });
  hint.appendChild(close);

  // Insert the hint right after the input (or its labelled wrapper) so it flows
  // with the layout and stays put on scroll.
  const anchor =
    input.closest('label, .field, .form-group, [class*="field"], [class*="upload"]') ?? input;
  anchor.insertAdjacentElement('afterend', hint);
}
