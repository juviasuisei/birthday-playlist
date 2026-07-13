import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createErrorComponent } from '../../src/renderer/error-component';
import { createEventBus } from '../../src/event-bus';
import type { EventBus } from '../../src/event-bus';

describe('ErrorComponent', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = createEventBus();
    container = document.createElement('div');
  });

  it('should show error message when data:error is emitted', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    bus.emit('data:error', { message: "We couldn't load the music data. Please try again later." });

    const messageEl = container.querySelector('.error-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl!.textContent).toBe("We couldn't load the music data. Please try again later.");

    error.destroy();
  });

  it('should display a retry button', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('Something went wrong');

    const button = container.querySelector('.error-retry');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('Try Again');

    error.destroy();
  });

  it('should have role="alert" for accessibility', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('An error occurred');

    const root = container.querySelector('.error-container');
    expect(root).not.toBeNull();
    expect(root!.getAttribute('role')).toBe('alert');

    error.destroy();
  });

  it('should hide when hide() is called', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('An error occurred');
    expect(container.querySelector('.error-container')).not.toBeNull();

    error.hide();
    expect(container.querySelector('.error-container')).toBeNull();

    error.destroy();
  });

  it('should clean up on destroy()', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('An error occurred');
    expect(container.querySelector('.error-container')).not.toBeNull();

    error.destroy();

    // DOM should be cleaned up
    expect(container.querySelector('.error-container')).toBeNull();

    // Bus events should be unsubscribed
    bus.emit('data:error', { message: 'Should not show' });
    expect(container.querySelector('.error-container')).toBeNull();
  });

  it('should call window.location.reload when retry button is clicked', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('An error occurred');

    const button = container.querySelector('.error-retry') as HTMLButtonElement;
    button.click();

    expect(reloadMock).toHaveBeenCalledOnce();

    error.destroy();
  });

  it('should not render anything before show() or event is emitted', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    expect(container.querySelector('.error-container')).toBeNull();

    error.destroy();
  });

  it('should replace existing error when show() is called again', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('First error');
    error.show('Second error');

    const containers = container.querySelectorAll('.error-container');
    expect(containers.length).toBe(1);
    expect(container.querySelector('.error-message')!.textContent).toBe('Second error');

    error.destroy();
  });

  it('should escape HTML in error messages', () => {
    const error = createErrorComponent(bus);
    error.mount(container);

    error.show('<script>alert("xss")</script>');

    const messageEl = container.querySelector('.error-message');
    expect(messageEl!.textContent).toBe('<script>alert("xss")</script>');
    expect(messageEl!.innerHTML).not.toContain('<script>');

    error.destroy();
  });
});
