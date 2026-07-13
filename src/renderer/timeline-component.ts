import type { EventBus } from '../event-bus';
import type { SongCollection, SongEntry } from '../types';

export interface TimelineComponent {
  mount(container: HTMLElement): void;
  update(collection: SongCollection): void;
  scrollToIndex(index: number): Promise<void>;
  destroy(): void;
}

const BREAKPOINT = 768;
const DEFAULT_COVER_SIZE = 180;

export function createTimelineComponent(bus: EventBus): TimelineComponent {
  let container: HTMLElement | null = null;
  let rootEl: HTMLElement | null = null;
  let entriesEl: HTMLElement | null = null;
  let currentCollection: SongCollection | null = null;
  let layoutMode: 'horizontal' | 'vertical' =
    typeof window !== 'undefined' && window.innerWidth >= BREAKPOINT
      ? 'horizontal'
      : 'vertical';

  function createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = `timeline timeline--${layoutMode}`;
    el.setAttribute('role', 'list');

    const entries = document.createElement('div');
    entries.className = 'timeline__entries';
    el.appendChild(entries);

    return el;
  }

  function createEntryElement(entry: SongEntry, index: number): HTMLElement {
    const entryEl = document.createElement('div');
    entryEl.className = 'timeline__entry';
    entryEl.setAttribute('role', 'listitem');
    entryEl.setAttribute('tabindex', '0');
    entryEl.setAttribute('data-index', String(index));

    const songTitle = entry.song || 'Untitled';

    if (!entry.albumCoverUrl) {
      const placeholder = createPlaceholder(songTitle);
      entryEl.appendChild(placeholder);
    } else {
      const img = document.createElement('img');
      img.className = 'timeline__cover';
      img.src = entry.albumCoverUrl;
      img.alt = `Album: ${songTitle} by ${entry.artist}`;
      img.width = DEFAULT_COVER_SIZE;
      img.height = DEFAULT_COVER_SIZE;

      img.addEventListener('error', () => {
        const placeholder = createPlaceholder(songTitle);
        img.replaceWith(placeholder);
      });

      entryEl.appendChild(img);
    }

    const yearLabel = entry.year != null ? String(entry.year) : '';
    const yearSpan = document.createElement('span');
    yearSpan.className = 'timeline__year';
    yearSpan.textContent = yearLabel;
    entryEl.appendChild(yearSpan);

    entryEl.addEventListener('click', () => {
      bus.emit('entry:select', { index });
    });

    entryEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        bus.emit('entry:select', { index });
      }
    });

    return entryEl;
  }

  function createPlaceholder(songTitle: string): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'timeline__cover-placeholder';
    placeholder.style.width = `${DEFAULT_COVER_SIZE}px`;
    placeholder.style.height = `${DEFAULT_COVER_SIZE}px`;
    placeholder.textContent = songTitle;
    return placeholder;
  }

  function renderEntries(collection: SongCollection): void {
    if (!entriesEl) return;

    entriesEl.innerHTML = '';

    collection.entries.forEach((entry, index) => {
      const entryEl = createEntryElement(entry, index);
      entriesEl!.appendChild(entryEl);
    });

    // Add trailing spacer so the last entry can scroll to center
    const spacer = document.createElement('div');
    spacer.className = 'timeline__spacer';
    spacer.setAttribute('aria-hidden', 'true');
    entriesEl.appendChild(spacer);
  }

  function handleDataLoaded(payload: { collection: SongCollection }): void {
    update(payload.collection);
  }

  function handleLayoutChanged(payload: { mode: 'horizontal' | 'vertical' }): void {
    layoutMode = payload.mode;
    if (rootEl) {
      rootEl.classList.remove('timeline--horizontal', 'timeline--vertical');
      rootEl.classList.add(`timeline--${layoutMode}`);
    }
  }

  function mount(target: HTMLElement): void {
    container = target;
    rootEl = createDOM();
    entriesEl = rootEl.querySelector('.timeline__entries');
    container.appendChild(rootEl);

    bus.on('data:loaded', handleDataLoaded);
    bus.on('layout:changed', handleLayoutChanged);
  }

  function update(collection: SongCollection): void {
    currentCollection = collection;
    renderEntries(collection);
  }

  function scrollToIndex(index: number): Promise<void> {
    if (!rootEl || !entriesEl || !currentCollection) {
      return Promise.resolve();
    }

    const targetEntry = entriesEl.querySelector(
      `[data-index="${index}"]`
    ) as HTMLElement | null;

    if (!targetEntry) {
      return Promise.resolve();
    }

    // padding-left on the scroll container = calc(50vw - 90px)
    // This means scrollLeft=0 puts first entry at center.
    // To center entry N, scroll to its offsetLeft within the entries container.
    rootEl.scrollTo({
      left: targetEntry.offsetLeft,
      behavior: 'smooth',
    });

    return Promise.resolve();
  }

  function destroy(): void {
    bus.off('data:loaded', handleDataLoaded);
    bus.off('layout:changed', handleLayoutChanged);

    if (rootEl && rootEl.parentNode) {
      rootEl.parentNode.removeChild(rootEl);
    }

    container = null;
    rootEl = null;
    entriesEl = null;
    currentCollection = null;
  }

  return {
    mount,
    update,
    scrollToIndex,
    destroy,
  };
}
