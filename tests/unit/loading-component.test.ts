import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoadingComponent } from '../../src/renderer/loading-component';
import { createEventBus } from '../../src/event-bus';
import type { EventBus } from '../../src/event-bus';

describe('LoadingComponent', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = createEventBus();
    container = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should mount without rendering until show is called', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);

    expect(container.querySelector('.loading-container')).toBeNull();
    loading.destroy();
  });

  it('should render loading DOM when show() is called', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    const root = container.querySelector('.loading-container');
    expect(root).not.toBeNull();
    expect(root!.querySelector('.loading-year-start')!.textContent).toBe('1981');
    expect(root!.querySelector('.loading-year-end')!.textContent).toBe(
      `${new Date().getFullYear()}`,
    );
    expect(root!.querySelector('.loading-age')!.textContent).toBe('Age 0');
    expect(root!.querySelector('.loading-fill')).not.toBeNull();

    loading.destroy();
  });

  it('should have role="status" for accessibility', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    const root = container.querySelector('.loading-container');
    expect(root!.getAttribute('role')).toBe('status');
    expect(root!.getAttribute('aria-label')).toBe('Loading song data');

    loading.destroy();
  });

  it('should animate age counter on interval ticks', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    const currentYear = new Date().getFullYear();
    const totalYears = currentYear - 1981;
    const tickInterval = 3500 / totalYears;

    // Advance by one tick
    vi.advanceTimersByTime(tickInterval);
    expect(container.querySelector('.loading-age')!.textContent).toBe('Age 1');

    // Advance by another tick
    vi.advanceTimersByTime(tickInterval);
    expect(container.querySelector('.loading-age')!.textContent).toBe('Age 2');

    loading.destroy();
  });

  it('should update fill bar width in sync with age counter', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    const currentYear = new Date().getFullYear();
    const totalYears = currentYear - 1981;
    const tickInterval = 3500 / totalYears;

    vi.advanceTimersByTime(tickInterval * 5);

    const fill = container.querySelector('.loading-fill') as HTMLElement;
    const expectedWidth = (5 / totalYears) * 100;
    expect(fill.style.width).toBe(`${expectedWidth}%`);

    loading.destroy();
  });

  it('should loop the animation after reaching the end', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    const currentYear = new Date().getFullYear();
    const totalYears = currentYear - 1981;
    const tickInterval = 3500 / totalYears;

    // Advance past one full cycle
    vi.advanceTimersByTime(tickInterval * (totalYears + 1));

    // After looping, age should reset to 0
    expect(container.querySelector('.loading-age')!.textContent).toBe('Age 0');

    // Then continue incrementing
    vi.advanceTimersByTime(tickInterval);
    expect(container.querySelector('.loading-age')!.textContent).toBe('Age 1');

    loading.destroy();
  });

  it('should show on loading:start event', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);

    bus.emit('loading:start', undefined);
    vi.advanceTimersByTime(0); // flush the setTimeout(0)

    expect(container.querySelector('.loading-container')).not.toBeNull();

    loading.destroy();
  });

  it('should hide on data:loaded event', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    expect(container.querySelector('.loading-container')).not.toBeNull();

    bus.emit('data:loaded', { collection: { entries: [], startYear: 1981, endYear: 2025 } });

    expect(container.querySelector('.loading-container')).toBeNull();

    loading.destroy();
  });

  it('should hide on data:error event', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    expect(container.querySelector('.loading-container')).not.toBeNull();

    bus.emit('data:error', { message: 'Something went wrong' });

    expect(container.querySelector('.loading-container')).toBeNull();

    loading.destroy();
  });

  it('should cancel pending show timeout when data arrives before display', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);

    // Emit loading:start (schedules a show)
    bus.emit('loading:start', undefined);

    // Data arrives before the timeout fires
    bus.emit('data:loaded', { collection: { entries: [], startYear: 1981, endYear: 2025 } });

    // Advance time past the scheduled show
    vi.advanceTimersByTime(300);

    // Should never have shown
    expect(container.querySelector('.loading-container')).toBeNull();

    loading.destroy();
  });

  it('should clean up timers on hide', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();

    loading.hide();

    // Verify no more DOM updates happen
    const currentYear = new Date().getFullYear();
    const totalYears = currentYear - 1981;
    const tickInterval = 3500 / totalYears;
    vi.advanceTimersByTime(tickInterval * 10);

    // Container should be empty after hide
    expect(container.querySelector('.loading-container')).toBeNull();

    loading.destroy();
  });

  it('should unsubscribe from bus on destroy', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.destroy();

    // After destroy, events shouldn't trigger show
    bus.emit('loading:start', undefined);
    vi.advanceTimersByTime(300);

    expect(container.querySelector('.loading-container')).toBeNull();
  });

  it('should not double-show if show() is called multiple times', () => {
    const loading = createLoadingComponent(bus);
    loading.mount(container);
    loading.show();
    loading.show(); // second call should be a no-op

    expect(container.querySelectorAll('.loading-container').length).toBe(1);

    loading.destroy();
  });
});
