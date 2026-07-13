import type { EventBus } from '../event-bus';
import type { SongCollection } from '../types';

export interface NavigationController {
  init(collection: SongCollection): void;
  getCurrentIndex(): number;
  canGoNext(): boolean;
  canGoPrev(): boolean;
  goNext(): void;
  goPrev(): void;
  destroy(): void;
}

export type TransitionPhase = 'idle' | 'fade-out' | 'slide' | 'fade-in';

const PHASE_DURATION = 200;

export function createNavigationController(bus: EventBus): NavigationController {
  let collection: SongCollection | null = null;
  let currentIndex = 0;
  let currentPhase: TransitionPhase = 'idle';
  let destroyed = false;

  function handleEntrySelect(payload: { index: number }): void {
    if (!collection) return;
    const idx = payload.index;
    if (idx >= 0 && idx < collection.entries.length) {
      currentIndex = idx;
    }
  }

  function handleNavNext(): void {
    goNext();
  }

  function handleNavPrev(): void {
    goPrev();
  }

  function init(coll: SongCollection): void {
    collection = coll;
    currentIndex = 0;
    currentPhase = 'idle';

    bus.on('entry:select', handleEntrySelect);
    bus.on('nav:next', handleNavNext);
    bus.on('nav:prev', handleNavPrev);
  }

  function getCurrentIndex(): number {
    return currentIndex;
  }

  function canGoNext(): boolean {
    if (!collection) return false;
    return currentIndex < collection.entries.length - 1;
  }

  function canGoPrev(): boolean {
    if (!collection) return false;
    return currentIndex > 0;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function navigateToEntry(targetIndex: number): Promise<void> {
    if (currentPhase !== 'idle') return; // Guard: ignore during transition
    if (!collection) return;
    if (targetIndex < 0 || targetIndex >= collection.entries.length) return;
    if (destroyed) return;

    currentPhase = 'fade-out';
    bus.emit('nav:transition:start', undefined);

    // Phase 1: Fade out (200ms)
    await delay(PHASE_DURATION);
    if (destroyed) return;

    // Phase 2: Slide/scroll (200ms)
    currentPhase = 'slide';
    currentIndex = targetIndex;
    await delay(PHASE_DURATION);
    if (destroyed) return;

    // Phase 3: Fade in (200ms)
    currentPhase = 'fade-in';
    await delay(PHASE_DURATION);
    if (destroyed) return;

    currentPhase = 'idle';
    bus.emit('nav:transition:end', undefined);
  }

  function goNext(): void {
    if (!canGoNext()) return;
    navigateToEntry(currentIndex + 1);
  }

  function goPrev(): void {
    if (!canGoPrev()) return;
    navigateToEntry(currentIndex - 1);
  }

  function destroy(): void {
    destroyed = true;
    bus.off('entry:select', handleEntrySelect);
    bus.off('nav:next', handleNavNext);
    bus.off('nav:prev', handleNavPrev);
    collection = null;
    currentPhase = 'idle';
  }

  return {
    init,
    getCurrentIndex,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    destroy,
  };
}
