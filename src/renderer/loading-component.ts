import type { EventBus } from '../event-bus';

export interface LoadingComponent {
  mount(container: HTMLElement): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

const START_YEAR = 1981;
const ANIMATION_DURATION_MS = 3500; // ~3.5 seconds for one full loop

export function createLoadingComponent(bus: EventBus): LoadingComponent {
  let container: HTMLElement | null = null;
  let rootEl: HTMLElement | null = null;
  let fillEl: HTMLElement | null = null;
  let ageEl: HTMLElement | null = null;
  let animationTimer: ReturnType<typeof setInterval> | null = null;
  let showTimeout: ReturnType<typeof setTimeout> | null = null;

  const currentYear = new Date().getFullYear();
  const totalYears = currentYear - START_YEAR;
  const tickInterval = ANIMATION_DURATION_MS / totalYears;

  let currentAge = 0;
  let isVisible = false;

  function createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'loading-container';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Loading song data');

    el.innerHTML = `
      <div class="loading-timeline">
        <span class="loading-year-start">${START_YEAR}</span>
        <div class="loading-track">
          <div class="loading-fill"></div>
        </div>
        <span class="loading-year-end">${currentYear}</span>
      </div>
      <div class="loading-age">Age 0</div>
    `;

    return el;
  }

  function startAnimation(): void {
    stopAnimation();
    currentAge = 0;

    if (fillEl) {
      fillEl.style.width = '0%';
    }
    if (ageEl) {
      ageEl.textContent = 'Age 0';
    }

    animationTimer = setInterval(() => {
      currentAge++;

      if (currentAge > totalYears) {
        // Loop: reset and start over
        currentAge = 0;
        if (fillEl) {
          fillEl.style.transition = 'none';
          fillEl.style.width = '0%';
          // Force reflow to apply transition reset
          fillEl.offsetWidth;
          fillEl.style.transition = '';
        }
      }

      const progress = (currentAge / totalYears) * 100;
      if (fillEl) {
        fillEl.style.width = `${progress}%`;
      }
      if (ageEl) {
        ageEl.textContent = `Age ${currentAge}`;
      }
    }, tickInterval);
  }

  function stopAnimation(): void {
    if (animationTimer !== null) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  function handleLoadingStart(): void {
    // Show within 200ms of fetch initiation
    showTimeout = setTimeout(() => {
      show();
      showTimeout = null;
    }, 0);
    // The design says "show within 200ms" — we show immediately (0ms) to be well within that window
  }

  function handleDataLoaded(): void {
    hide();
  }

  function handleDataError(): void {
    hide();
  }

  function show(): void {
    if (isVisible || !rootEl || !container) return;
    isVisible = true;

    container.appendChild(rootEl);
    fillEl = rootEl.querySelector('.loading-fill');
    ageEl = rootEl.querySelector('.loading-age');

    startAnimation();
  }

  function hide(): void {
    if (showTimeout !== null) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }

    if (!isVisible || !rootEl) return;
    isVisible = false;

    stopAnimation();

    if (rootEl.parentNode) {
      rootEl.parentNode.removeChild(rootEl);
    }
  }

  function mount(target: HTMLElement): void {
    container = target;
    rootEl = createDOM();

    bus.on('loading:start', handleLoadingStart);
    bus.on('data:loaded', handleDataLoaded);
    bus.on('data:error', handleDataError);
  }

  function destroy(): void {
    hide();

    bus.off('loading:start', handleLoadingStart);
    bus.off('data:loaded', handleDataLoaded);
    bus.off('data:error', handleDataError);

    container = null;
    rootEl = null;
    fillEl = null;
    ageEl = null;
  }

  return {
    mount,
    show,
    hide,
    destroy,
  };
}
