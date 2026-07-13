import './styles.css';
import { createEventBus } from './event-bus';
import { createDataService } from './data/data-service';
import { createTimelineComponent } from './renderer/timeline-component';
import { createDetailComponent } from './renderer/detail-component';
import { createLoadingComponent } from './renderer/loading-component';
import { createErrorComponent } from './renderer/error-component';
import { createMarkdownParser } from './engine/markdown-parser';

const BREAKPOINT = 768;

const bus = createEventBus();
const parser = createMarkdownParser();

const appEl = document.querySelector<HTMLElement>('#app')!;

// Mount components
const loading = createLoadingComponent(bus);
loading.mount(appEl);

const error = createErrorComponent(bus);
error.mount(appEl);

const timeline = createTimelineComponent(bus);
timeline.mount(appEl);

const detail = createDetailComponent(bus, parser);
detail.mount(appEl);

// Responsive layout detection
function detectLayout(): 'horizontal' | 'vertical' {
  return window.innerWidth >= BREAKPOINT ? 'horizontal' : 'vertical';
}

let currentLayout = detectLayout();

window.addEventListener('resize', () => {
  const newLayout = detectLayout();
  if (newLayout !== currentLayout) {
    currentLayout = newLayout;
    bus.emit('layout:changed', { mode: currentLayout });
  }
});

// Fetch data
const token = import.meta.env.VITE_AIRTABLE_API_TOKEN || '';
const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID || 'appjZ7QZY0mRUJWrp';
const tableId = import.meta.env.VITE_AIRTABLE_TABLE_ID || 'tbl2h7NudXhGkHY23';

if (!token) {
  bus.emit('data:error', { message: 'Configuration error. Data cannot be loaded.' });
} else {
  const dataService = createDataService(
    {
      baseId,
      tableId,
      token,
      maxPages: 50,
      timeoutMs: 30000,
      rateLimit: 5,
    },
    bus
  );

  dataService.fetchAll().catch(() => {
    // Error is already emitted by DataService via the EventBus
  });
}
