import type { EventMap } from './types';

export interface EventBus {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<keyof EventMap, Set<(payload: never) => void>>();

  return {
    on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
      let handlers = listeners.get(event);
      if (!handlers) {
        handlers = new Set();
        listeners.set(event, handlers);
      }
      handlers.add(handler as (payload: never) => void);
    },

    off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.delete(handler as (payload: never) => void);
      }
    },

    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
      const handlers = listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          handler(payload as never);
        }
      }
    },
  };
}
