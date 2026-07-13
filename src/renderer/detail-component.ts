import type { EventBus } from '../event-bus';
import type { SongCollection, SongEntry } from '../types';
import type { MarkdownParser } from '../engine/markdown-parser';

export interface DetailComponent {
  mount(container: HTMLElement): void;
  open(index: number, collection: SongCollection): void;
  close(): void;
  destroy(): void;
}

const BREAKPOINT = 768;

const APPLE_MUSIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.073-.005-.146-.01-.22-.015H6.117l-.283.02c-.62.04-1.237.1-1.84.27C2.77.507 1.803 1.181 1.12 2.328A4.971 4.971 0 0 0 .457 4.16c-.058.3-.09.605-.111.91L.33 5.3v13.44l.015.2c.04.615.09 1.23.272 1.83.317 1.04.9 1.893 1.783 2.53.585.422 1.24.69 1.947.843.37.078.745.12 1.122.147.206.015.413.022.62.03h12.042l.165-.012c.634-.04 1.265-.094 1.878-.285 1.07-.332 1.94-.946 2.583-1.86.394-.56.62-1.188.756-1.853.064-.308.1-.62.122-.934l.013-.198V6.124zm-7.16 4.994c0 2.467 0 4.934-.003 7.4 0 .272-.027.543-.08.81-.14.716-.52 1.272-1.13 1.665a2.61 2.61 0 0 1-1.09.433c-.508.084-1 .057-1.472-.135-.477-.194-.86-.51-1.1-.964-.37-.7-.214-1.628.39-2.2.36-.342.795-.544 1.277-.642.322-.065.65-.1.977-.147.32-.046.592-.184.77-.474.12-.197.164-.416.164-.647V10.95c0-.21-.058-.394-.26-.503a.862.862 0 0 0-.356-.1c-.638-.073-1.278-.135-1.917-.198-.705-.07-1.41-.14-2.116-.207-.238-.023-.447.07-.55.3-.058.13-.083.272-.083.417-.003 1.963-.004 3.925-.004 5.887 0 .806-.002 1.613-.004 2.42 0 .258-.023.514-.072.768-.143.73-.528 1.296-1.148 1.694-.41.264-.868.395-1.358.42-.406.02-.803-.02-1.18-.17-.568-.225-.98-.617-1.198-1.188-.284-.738-.088-1.43.507-1.968.363-.33.793-.522 1.266-.617.325-.065.655-.098.984-.146.313-.046.578-.178.754-.463.128-.205.17-.432.17-.666V8.46c0-.314.058-.605.32-.822.156-.13.34-.2.544-.22.755-.075 1.51-.146 2.264-.216l2.142-.206 1.503-.142c.16-.015.323-.022.483-.006.287.028.488.208.548.492.023.105.03.214.03.322v3.456z"/></svg>`;

const SPOTIFY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`;

export function createDetailComponent(bus: EventBus, parser: MarkdownParser): DetailComponent {
  let container: HTMLElement | null = null;
  let overlayEl: HTMLElement | null = null;
  let currentIndex: number = -1;
  let currentCollection: SongCollection | null = null;
  let triggerElement: HTMLElement | null = null;
  let isOpen = false;
  let isMobile = false;
  let historyStatePushed = false;

  // Event handler references for cleanup
  function handleKeyDown(e: KeyboardEvent): void {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigatePrev();
    }
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (!isOpen || !overlayEl) return;
    const content = overlayEl.querySelector('.detail-content');
    if (content && !content.contains(e.target as Node)) {
      close();
    }
  }

  function handlePopState(): void {
    if (isOpen && isMobile) {
      closeWithoutHistoryPop();
    }
  }

  function handleEntrySelect(payload: { index: number }): void {
    if (currentCollection) {
      // Store the trigger element for focus return
      const entryEl = container?.querySelector(
        `[data-index="${payload.index}"]`
      ) as HTMLElement | null ?? container?.parentElement?.querySelector(
        `[data-index="${payload.index}"]`
      ) as HTMLElement | null;
      if (entryEl) {
        triggerElement = entryEl;
      }
      open(payload.index, currentCollection);
    }
  }

  function handleDataLoaded(payload: { collection: SongCollection }): void {
    currentCollection = payload.collection;
  }

  function detectMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < BREAKPOINT;
  }

  function formatDate(isoDate: string | null): string {
    if (!isoDate) return '';
    try {
      // Parse date parts directly to avoid timezone issues with ISO date strings
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]!, 10);
        const month = parseInt(parts[1]!, 10) - 1; // months are 0-indexed
        const day = parseInt(parts[2]!, 10);
        const date = new Date(year, month, day);
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(date);
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  }

  function renderContent(entry: SongEntry): string {
    const heading = `${entry.year ?? ''} \u2022 ${entry.song} \u2022 ${entry.artist}`;
    const formattedDate = formatDate(entry.releaseDate);

    let linksHtml = '';
    if (entry.appleMusicUrl) {
      linksHtml += `<a href="${escapeAttr(entry.appleMusicUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Listen on Apple Music (opens in new tab)">${APPLE_MUSIC_SVG}</a>`;
    }
    if (entry.spotifyUrl) {
      linksHtml += `<a href="${escapeAttr(entry.spotifyUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Listen on Spotify (opens in new tab)">${SPOTIFY_SVG}</a>`;
    }

    const linksSection = linksHtml
      ? `<div class="detail-links">${linksHtml}</div>`
      : '';

    const artistPhotoHtml = entry.artistPhotoUrl
      ? `<div class="detail-artist-photo"><img src="${escapeAttr(entry.artistPhotoUrl)}" alt="Artist photo" style="height: 200px; width: auto;" /></div>`
      : '';

    let notesHtml = '';
    if (entry.thoughts && entry.thoughts.trim().length > 0) {
      const ast = parser.parse(entry.thoughts);
      const html = parser.toHtml(ast);
      notesHtml = `<div class="detail-notes">${html}</div>`;
    }

    const canGoPrev = currentIndex > 0;
    const canGoNext = currentCollection
      ? currentIndex < currentCollection.entries.length - 1
      : false;

    const prevButton = canGoPrev
      ? `<button class="detail-nav-prev" aria-label="Previous song">\u2190</button>`
      : '';
    const nextButton = canGoNext
      ? `<button class="detail-nav-next" aria-label="Next song">\u2192</button>`
      : '';

    const backButton = isMobile
      ? `<button class="detail-back" aria-label="Back to timeline">\u2190 Back</button>`
      : '';

    return `
      ${backButton}
      <div class="detail-header">
        <h2 class="detail-heading">${escapeHtml(heading)}</h2>
        <div class="detail-secondary">
          <span class="detail-album">${escapeHtml(entry.album)}</span>
          <span class="detail-date">${escapeHtml(formattedDate)}</span>
          ${linksSection}
        </div>
      </div>
      ${artistPhotoHtml}
      ${notesHtml}
      <div class="detail-nav">
        ${prevButton}
        ${nextButton}
      </div>
    `;
  }

  function createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    if (isMobile) {
      overlay.classList.add('detail-overlay--fullscreen');
    }
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Song details');
    overlay.setAttribute('tabindex', '-1');

    const content = document.createElement('div');
    content.className = 'detail-content';
    overlay.appendChild(content);

    return overlay;
  }

  function attachNavListeners(): void {
    if (!overlayEl) return;

    const prevBtn = overlayEl.querySelector('.detail-nav-prev');
    const nextBtn = overlayEl.querySelector('.detail-nav-next');
    const backBtn = overlayEl.querySelector('.detail-back');

    if (prevBtn) {
      prevBtn.addEventListener('click', navigatePrev);
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', navigateNext);
    }
    if (backBtn) {
      backBtn.addEventListener('click', () => close());
    }
  }

  function navigateNext(): void {
    if (!currentCollection || currentIndex >= currentCollection.entries.length - 1) return;
    bus.emit('nav:next', undefined);
    open(currentIndex + 1, currentCollection);
  }

  function navigatePrev(): void {
    if (!currentCollection || currentIndex <= 0) return;
    bus.emit('nav:prev', undefined);
    open(currentIndex - 1, currentCollection);
  }

  function mount(target: HTMLElement): void {
    container = target;
    bus.on('entry:select', handleEntrySelect);
    bus.on('data:loaded', handleDataLoaded);
  }

  function open(index: number, collection: SongCollection): void {
    currentIndex = index;
    currentCollection = collection;
    isMobile = detectMobile();

    const entry = collection.entries[index];
    if (!entry) return;

    if (!overlayEl) {
      overlayEl = createOverlay();
      container!.appendChild(overlayEl);
      overlayEl.addEventListener('click', handleOverlayClick);
      document.addEventListener('keydown', handleKeyDown);
    } else {
      // Update mobile class
      if (isMobile) {
        overlayEl.classList.add('detail-overlay--fullscreen');
      } else {
        overlayEl.classList.remove('detail-overlay--fullscreen');
      }
    }

    const content = overlayEl.querySelector('.detail-content')!;
    content.innerHTML = renderContent(entry);
    attachNavListeners();

    if (!isOpen && isMobile) {
      window.history.pushState({ detailOpen: true }, '');
      historyStatePushed = true;
      window.addEventListener('popstate', handlePopState);
    }

    isOpen = true;
    overlayEl.style.display = '';
    overlayEl.focus();
  }

  function close(): void {
    if (!isOpen) return;

    if (isMobile && historyStatePushed) {
      historyStatePushed = false;
      window.removeEventListener('popstate', handlePopState);
      window.history.back();
    }

    closeInternal();
  }

  function closeWithoutHistoryPop(): void {
    historyStatePushed = false;
    window.removeEventListener('popstate', handlePopState);
    closeInternal();
  }

  function closeInternal(): void {
    isOpen = false;

    if (overlayEl) {
      overlayEl.removeEventListener('click', handleOverlayClick);
      document.removeEventListener('keydown', handleKeyDown);
      if (overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
      overlayEl = null;
    }

    bus.emit('entry:deselect', undefined);

    if (triggerElement) {
      triggerElement.focus();
      triggerElement = null;
    }
  }

  function destroy(): void {
    if (isOpen) {
      closeInternal();
    }
    bus.off('entry:select', handleEntrySelect);
    bus.off('data:loaded', handleDataLoaded);
    container = null;
    currentCollection = null;
  }

  return {
    mount,
    open,
    close,
    destroy,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
