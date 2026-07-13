# Implementation Plan: Birthday Playlist

## Overview

This plan implements "Jeremiah's Birthday Playlist" — a single-page web app that fetches song data from Airtable and renders an interactive chronological timeline (1981–present). The implementation follows a bottom-up approach: scaffolding → data layer → engine/utilities → rendering → controller → integration and wiring.

## Tasks

- [x] 1. Project scaffolding and tooling setup
  - [x] 1.1 Initialize project with Vite vanilla-ts template
    - Run `npm create vite@latest . -- --template vanilla-ts`
    - Initialize git repository
    - Configure `tsconfig.json` with strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
    - Create `src/types.ts` with all interfaces (`AirtableRecord`, `AirtableResponse`, `SongEntry`, `SongCollection`, `AppState`, `EventMap`)
    - _Requirements: 11.1, 11.2, 11.4_

  - [x] 1.2 Configure testing framework and CI
    - Install Vitest, jsdom, fast-check, and MSW as dev dependencies
    - Create `vitest.config.ts` with jsdom environment
    - Create `.env.example` with `AIRTABLE_API_TOKEN=your_token_here`, `VITE_AIRTABLE_BASE_ID=your_base_id`, `VITE_AIRTABLE_TABLE_ID=your_table_id`
    - Create `.gitignore` (node_modules, dist, .env, coverage)
    - Create GitHub Actions workflow (`.github/workflows/ci.yml`) for lint, type-check, test, and build
    - Create GitHub Actions workflow (`.github/workflows/deploy.yml`) for GitHub Pages deployment on push to main
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 2. Implement EventBus
  - [x] 2.1 Create EventBus module
    - Implement `src/event-bus.ts` with typed `on`, `off`, `emit` methods
    - Ensure type-safe event payloads using the `EventMap` interface
    - _Requirements: (foundational infrastructure for all component communication)_

  - [x] 2.2 Write unit tests for EventBus
    - Test subscribe/emit, unsubscribe, multiple handlers, unknown events
    - _Requirements: (foundational infrastructure)_

- [x] 3. Implement data layer
  - [x] 3.1 Implement RateLimiter
    - Create `src/data/rate-limiter.ts` with token-bucket or sliding-window algorithm
    - Enforce no more than 5 resolved `acquire()` calls within any contiguous 1-second window
    - _Requirements: 1.3_

  - [x] 3.2 Write property test for RateLimiter
    - **Property 2: Rate Limiter Enforcement**
    - **Validates: Requirements 1.3**

  - [x] 3.3 Implement DataService
    - Create `src/data/data-service.ts` with `createDataService` factory
    - Implement paginated fetching with offset token handling (stop at no offset or 50 pages max)
    - Integrate RateLimiter for request throttling
    - Normalize `AirtableRecord` → `SongEntry` (extract year, camelCase fields, null-coalesce)
    - Emit `loading:start`, `loading:progress`, `data:loaded`, `data:error` events via EventBus
    - Implement 30-second timeout via AbortController
    - Guard against empty/missing `AIRTABLE_API_TOKEN` at runtime
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 3.4 Write property test for pagination completeness
    - **Property 1: Pagination Completeness**
    - **Validates: Requirements 1.2**

  - [x] 3.5 Write unit tests for DataService
    - Test successful multi-page fetch, error handling (4xx/5xx), timeout, missing token guard, 429 retry
    - Use MSW to mock Airtable API responses
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

- [x] 4. Implement engine and utilities
  - [x] 4.1 Implement SongSorter
    - Create `src/engine/song-sorter.ts`
    - Sort by `releaseDate` ascending; entries with null `releaseDate` go to end
    - _Requirements: 1.4_

  - [x] 4.2 Write property test for sort order invariant
    - **Property 3: Sort Order Invariant**
    - **Validates: Requirements 1.4**

  - [x] 4.3 Implement MarkdownParser
    - Create `src/engine/markdown-parser.ts`
    - Parse headings (h1–h6), bold, italic, links, unordered lists, ordered lists, paragraphs into AST (`MdNode[]`)
    - Implement `toHtml()` to render AST to sanitized HTML (strip `<script>`, `on*` attributes, `javascript:` URLs)
    - Return empty string for empty/whitespace-only input
    - Render unsupported syntax as plain text in `<p>` element
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 7.1, 7.3_

  - [x] 4.4 Write property test for empty input produces empty output
    - **Property 8: Empty Input Produces Empty Output**
    - **Validates: Requirements 7.2, 12.5**

  - [x] 4.5 Write property test for markdown sanitization
    - **Property 9: Markdown Sanitization**
    - **Validates: Requirements 7.3**

  - [x] 4.6 Write property test for unsupported markdown fallback
    - **Property 11: Unsupported Markdown Fallback**
    - **Validates: Requirements 12.6**

  - [x] 4.7 Implement PrettyPrinter
    - Create `src/engine/pretty-printer.ts`
    - Convert `MdNode[]` AST back to markdown string
    - _Requirements: 12.3_

  - [x] 4.8 Write property test for markdown round-trip
    - **Property 10: Markdown Round-Trip**
    - **Validates: Requirements 12.3, 12.4**

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement renderer components
  - [x] 6.1 Implement LoadingComponent
    - Create `src/renderer/loading-component.ts`
    - Render animated timeline-filling indicator from "1981" to current year
    - Display age counter incrementing from "Age 0" in sync with line animation
    - Subscribe to `loading:start` and `data:loaded` / `data:error` events
    - Show within 200ms of fetch initiation; replace with timeline within 1s of completion
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 6.2 Implement TimelineComponent
    - Create `src/renderer/timeline-component.ts`
    - Render one album cover per `SongEntry` in chronological order with year labels
    - Render continuous connecting line through all entry positions
    - Horizontal layout (≥768px): left-to-right scroll, covers 150–300px square
    - Vertical layout (<768px): top-to-bottom scroll
    - Handle image load errors with placeholder showing song title
    - Make each cover focusable (tabindex) in chronological order with visible focus indicator
    - Implement `scrollToIndex()` for smooth scrolling to a target album cover
    - Emit `entry:select` on click/Enter/Space; subscribe to `data:loaded`, `layout:changed`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 5.2, 5.3, 5.4, 5.5, 10.1_

  - [x] 6.3 Write property test for timeline rendering completeness
    - **Property 4: Timeline Rendering Completeness**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 6.4 Write property test for tab order matches chronological order
    - **Property 13: Tab Order Matches Chronological Order**
    - **Validates: Requirements 10.1**

  - [x] 6.5 Write property test for album cover size invariants
    - **Property 14: Album Cover Size Invariants**
    - **Validates: Requirements 5.3, 5.5**

  - [x] 6.6 Implement DetailComponent
    - Create `src/renderer/detail-component.ts`
    - Desktop (≥768px): modal overlay with album cover centered at same position as timeline
    - Mobile (<768px): fullscreen view with back button
    - Render heading as "{year} • {song} • {artist}", secondary line with album + release date
    - Render artist photo (200px fixed height, auto width preserving aspect ratio)
    - Render streaming icons conditionally (Apple Music, Spotify) with `target="_blank"` and `rel="noopener noreferrer"`
    - Render Thoughts markdown via MarkdownParser
    - Render next/prev navigation controls; disable at boundaries
    - Close modal on outside click or Escape key; return focus to trigger element
    - Support arrow key navigation (left/right for prev/next)
    - Handle browser back button on mobile
    - _Requirements: 3.1–3.16, 4.1–4.8, 6.1–6.6, 7.1–7.4, 9.1–9.6, 10.2–10.7_

  - [x] 6.7 Write property test for detail heading format
    - **Property 5: Detail Heading Format**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 6.8 Write property test for streaming icon conditional rendering
    - **Property 6: Streaming Icon Conditional Rendering**
    - **Validates: Requirements 3.5, 3.7, 6.1, 6.2, 6.4, 6.5**

  - [x] 6.9 Write property test for external link safety
    - **Property 7: External Link Safety**
    - **Validates: Requirements 6.3, 6.6, 7.4**

  - [x] 6.10 Implement ErrorComponent
    - Create `src/renderer/error-component.ts`
    - Subscribe to `data:error` event
    - Display non-technical error message with retry button
    - _Requirements: 1.5, 1.7, 8.4_

- [x] 7. Implement NavigationController
  - [x] 7.1 Implement NavigationController with three-phase animation
    - Create `src/controller/navigation-controller.ts`
    - Track current index, implement `goNext()` / `goPrev()` with boundary guards
    - Orchestrate three-phase animation: fade out (200ms) → slide/scroll (200ms) → fade in (200ms)
    - Implement transition guard: ignore nav events while transitioning
    - Emit `nav:transition:start` and `nav:transition:end` events
    - _Requirements: 3.15, 3.16, 4.6, 9.1–9.7_

  - [x] 7.2 Write property test for navigation transition guard
    - **Property 12: Navigation Transition Guard**
    - **Validates: Requirements 9.7**

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration and wiring
  - [x] 9.1 Implement Main bootstrap and responsive layout detection
    - Create `src/main.ts` as application entry point
    - Bootstrap all components: EventBus, DataService, TimelineComponent, DetailComponent, LoadingComponent, ErrorComponent, NavigationController
    - Set up ResizeObserver to emit `layout:changed` event at 768px breakpoint
    - Wire Vite build-time env var injection for `AIRTABLE_API_TOKEN`
    - Add Vite plugin or config to fail build if token is missing
    - _Requirements: 1.6, 1.7, 5.4, 11.1, 11.3_

  - [x] 9.2 Create HTML entry point and CSS styles
    - Create `index.html` with semantic structure and meta viewport tag
    - Create `src/styles.css` with timeline layout styles (horizontal/vertical), detail modal/fullscreen styles, animation classes (fade-out, slide, fade-in), responsive breakpoint (768px), loading indicator, and focus indicator styles
    - _Requirements: 2.3, 2.4, 2.5, 3.1, 3.16, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 10.1_

  - [x] 9.3 Write integration tests
    - Test full data fetch → render pipeline with MSW mocked Airtable responses
    - Test navigation flow: click entry → view detail → navigate next → close
    - Test responsive layout switch during active detail view
    - Test loading state → data loaded transition
    - _Requirements: 1.1, 2.1, 3.1, 8.1, 9.3_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Commit at the completion of each numbered task (conventional commits)
- The project uses TypeScript strict mode with Vite, Vitest + jsdom, and fast-check
- All streaming links use `target="_blank"` and `rel="noopener noreferrer"` for security
- The 768px breakpoint is the single responsive threshold

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "4.2", "4.3"] },
    { "id": 5, "tasks": ["3.4", "3.5", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 6, "tasks": ["4.8", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "6.5", "6.6", "6.10"] },
    { "id": 8, "tasks": ["6.7", "6.8", "6.9", "7.1"] },
    { "id": 9, "tasks": ["7.2", "9.1", "9.2"] },
    { "id": 10, "tasks": ["9.3"] }
  ]
}
```
