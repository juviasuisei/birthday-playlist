import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/event-bus';

describe('EventBus', () => {
  it('calls handler with correct payload on emit', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('data:error', handler);
    bus.emit('data:error', { message: 'Something went wrong' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ message: 'Something went wrong' });
  });

  it('does not call handler after off()', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('nav:next', handler);
    bus.emit('nav:next', undefined);
    expect(handler).toHaveBeenCalledOnce();

    bus.off('nav:next', handler);
    bus.emit('nav:next', undefined);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls all handlers registered for the same event', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on('entry:select', handler1);
    bus.on('entry:select', handler2);
    bus.on('entry:select', handler3);

    bus.emit('entry:select', { index: 5 });

    expect(handler1).toHaveBeenCalledWith({ index: 5 });
    expect(handler2).toHaveBeenCalledWith({ index: 5 });
    expect(handler3).toHaveBeenCalledWith({ index: 5 });
  });

  it('does not throw when emitting an event with no listeners', () => {
    const bus = createEventBus();

    expect(() => {
      bus.emit('loading:start', undefined);
    }).not.toThrow();
  });

  it('does not throw when calling off() for a non-registered handler', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    expect(() => {
      bus.off('nav:prev', handler);
    }).not.toThrow();
  });
});
