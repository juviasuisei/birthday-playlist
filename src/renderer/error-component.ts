import type { EventBus } from '../event-bus';

export interface ErrorComponent {
  mount(container: HTMLElement): void;
  show(message: string): void;
  hide(): void;
  destroy(): void;
}

export function createErrorComponent(bus: EventBus): ErrorComponent {
  let container: HTMLElement | null = null;
  let rootEl: HTMLElement | null = null;
  let isVisible = false;

  function createDOM(message: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'error-container';
    el.setAttribute('role', 'alert');

    el.innerHTML = `
      <p class="error-message">${escapeHtml(message)}</p>
      <button class="error-retry">Try Again</button>
    `;

    const button = el.querySelector('.error-retry') as HTMLButtonElement;
    button.addEventListener('click', () => {
      window.location.reload();
    });

    return el;
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleDataError(payload: { message: string }): void {
    show(payload.message);
  }

  function show(message: string): void {
    if (!container) return;

    // If already visible, remove existing and show new message
    if (isVisible && rootEl && rootEl.parentNode) {
      rootEl.parentNode.removeChild(rootEl);
    }

    rootEl = createDOM(message);
    container.appendChild(rootEl);
    isVisible = true;
  }

  function hide(): void {
    if (!isVisible || !rootEl) return;
    isVisible = false;

    if (rootEl.parentNode) {
      rootEl.parentNode.removeChild(rootEl);
    }
    rootEl = null;
  }

  function mount(target: HTMLElement): void {
    container = target;
    bus.on('data:error', handleDataError);
  }

  function destroy(): void {
    hide();
    bus.off('data:error', handleDataError);
    container = null;
    rootEl = null;
  }

  return {
    mount,
    show,
    hide,
    destroy,
  };
}
