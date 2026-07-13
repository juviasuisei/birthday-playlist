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

const APPLE_MUSIC_ICON = `<img src="./assets/apple-music.png" alt="Apple Music" width="24" height="24" style="border-radius: 4px;" />`;

const SPOTIFY_ICON = `<img src="./assets/spotify.png" alt="Spotify" width="24" height="24" style="border-radius: 50%;" />`;

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
      linksHtml += `<a href="${escapeAttr(entry.appleMusicUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Listen on Apple Music (opens in new tab)">${APPLE_MUSIC_ICON}</a>`;
    }
    if (entry.spotifyUrl) {
      linksHtml += `<a href="${escapeAttr(entry.spotifyUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Listen on Spotify (opens in new tab)">${SPOTIFY_ICON}</a>`;
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

    const prevButton = `<button class="detail-nav-prev${canGoPrev ? '' : ' detail-nav--hidden'}" aria-label="Previous song"${canGoPrev ? '' : ' disabled'}>\u2190</button>`;
    const nextButton = `<button class="detail-nav-next${canGoNext ? '' : ' detail-nav--hidden'}" aria-label="Next song"${canGoNext ? '' : ' disabled'}>\u2192</button>`;

    const backButton = isMobile
      ? `<button class="detail-back" aria-label="Back to timeline">\u2190 Back</button>`
      : '';

    const albumCoverHtml = entry.albumCoverUrl
      ? `<img class="detail-cover" src="${escapeAttr(entry.albumCoverUrl)}" alt="Album cover for ${escapeAttr(entry.song)}" />`
      : '';

    const musicVideoHtml = entry.musicVideoUrl
      ? `<div class="detail-video"><iframe src="${escapeAttr(entry.musicVideoUrl.replace('youtu.be/', 'www.youtube.com/embed/').replace('watch?v=', 'embed/'))}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Music video for ${escapeAttr(entry.song)}"></iframe></div>`
      : '';

    return `
      ${backButton}
      <div class="detail-body">
        <div class="detail-top">
          <div class="detail-header">
            <h2 class="detail-heading">${escapeHtml(heading)}</h2>
            <div class="detail-secondary">
              <span class="detail-album">${escapeHtml(entry.album)}</span>
              <span class="detail-separator">&bull;</span>
              <span class="detail-date">${escapeHtml(formattedDate)}</span>
              ${linksSection}
            </div>
          </div>
          <div class="detail-middle">
            ${artistPhotoHtml}
            ${notesHtml}
          </div>
        </div>
        <div class="detail-cover-row">
          ${prevButton}
          ${albumCoverHtml}
          ${nextButton}
        </div>
        <div class="detail-bottom">
          ${musicVideoHtml}
        </div>
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
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigatePrev();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateNext();
      });
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
