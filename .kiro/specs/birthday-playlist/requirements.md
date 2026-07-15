# Requirements Document

## Introduction

"Birthday Playlist" is a personal music timeline web application that displays one song per year the user has been alive (1981 through the most recent year in the data). The tagline: "One song for every year I've been alive." The app fetches song data from Airtable at runtime and presents it as an interactive timeline with detail views for each song entry.

## Glossary

- **Timeline**: The primary view displaying all song entries in chronological order as a horizontal (desktop) or vertical (mobile) sequence connected by a visual line
- **Song_Entry**: A single record representing one year, containing metadata (song title, artist, album, release date), media URLs (Apple Music, Spotify, Music Video), images (album cover, artist photo), and personal notes
- **Detail_View**: The expanded view of a Song_Entry showing full metadata, artwork, streaming links, and personal notes
- **Modal**: A desktop overlay displaying a Detail_View on top of the Timeline, dismissible by clicking outside or navigating
- **Fullscreen_View**: A mobile-specific layout that replaces the Timeline to show a Detail_View, with a back button to return
- **Data_Service**: The module responsible for fetching, paginating, and caching song data from the Airtable API
- **Timeline_Component**: The module responsible for rendering the chronological timeline of album artwork with year labels and connecting line
- **Detail_Component**: The module responsible for rendering the Detail_View content (modal on desktop, fullscreen on mobile)
- **EventBus**: The publish-subscribe communication system enabling decoupled interaction between components
- **Airtable_API**: The external REST API providing song data, authenticated via bearer token, rate-limited to 5 requests per second, paginated at 100 records per page

## Requirements

### Requirement 1: Fetch Song Data from Airtable

**User Story:** As a visitor, I want the app to load all song data when I open the page, so that I can browse the complete timeline.

#### Acceptance Criteria

1. WHEN the application loads, THE Data_Service SHALL fetch all Song_Entry records from the Airtable_API using the configured base ID and table ID
2. WHEN the Airtable_API returns a paginated response with an offset token, THE Data_Service SHALL fetch subsequent pages until all records are retrieved or a maximum of 50 sequential page requests have been made
3. WHILE fetching data from the Airtable_API, THE Data_Service SHALL limit requests to no more than 5 per second to respect rate limits
4. WHEN all pages have been fetched, THE Data_Service SHALL sort Song_Entry records by Release Date in ascending order (oldest first), placing records with missing or null Release Date values at the end of the sorted list
5. IF the Airtable_API returns an error response or the total fetch operation exceeds 30 seconds, THEN THE Data_Service SHALL display a non-technical error message in the page content area indicating that song data could not be loaded
6. THE Data_Service SHALL authenticate all Airtable_API requests using a bearer token injected at build time via environment variable
7. IF the bearer token environment variable is not set at build time, THEN THE Data_Service SHALL prevent API requests from being made and SHALL display a non-technical error message in the page content area indicating that data could not be loaded

### Requirement 2: Render Timeline View

**User Story:** As a visitor, I want to see a visual timeline of album covers arranged chronologically, so that I can explore the music collection at a glance.

#### Acceptance Criteria

1. WHEN song data has loaded, THE Timeline_Component SHALL render one album cover image per Song_Entry arranged in chronological order
2. THE Timeline_Component SHALL display the year (from Release Date) as a label adjacent to each album cover, positioned below the cover in horizontal layout and below the cover in vertical layout
3. THE Timeline_Component SHALL render a continuous connecting line running through all Song_Entry positions
4. WHILE the viewport width is 768px or greater, THE Timeline_Component SHALL arrange entries horizontally from left (oldest, 1981) to right (newest)
5. WHILE the viewport width is less than 768px, THE Timeline_Component SHALL arrange entries vertically from top (oldest, 1981) to bottom (newest)
6. WHEN the viewport is resized across the 768px breakpoint, THE Timeline_Component SHALL re-render using the horizontal layout (criterion 4) or vertical layout (criterion 5) matching the new viewport width
7. IF a Song_Entry album cover image fails to load, THEN THE Timeline_Component SHALL display a placeholder element of the same dimensions as other album covers showing the song title text

### Requirement 3: Open Detail View on Desktop

**User Story:** As a desktop visitor, I want to click an album cover to see full details about that song in an overlay where the artwork stays centered, so that I can read the notes and access streaming links with the album cover as the visual anchor.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or greater, WHEN a visitor clicks a Song_Entry album cover, THE Detail_Component SHALL display the Detail_View with the album cover remaining visually centered in the viewport at the same position it occupied on the Timeline
2. WHEN the Detail_View is displayed, THE Detail_Component SHALL render additional content (heading, secondary line, artist photo, streaming links, notes) above and below the centered album cover
3. WHEN the Detail_View is displayed, THE Detail_Component SHALL show a heading formatted as "[Year] • [Song Title] • [Artist]"
4. WHEN the Detail_View is displayed, THE Detail_Component SHALL show a secondary line containing the album name and exact release date
5. WHEN the Detail_View is displayed AND the Song_Entry contains an Apple Music URL, THE Detail_Component SHALL show an Apple Music icon linking to that URL
6. WHEN a visitor clicks the Apple Music icon, THE Detail_Component SHALL open the Apple Music URL in a new browser tab
7. WHEN the Detail_View is displayed AND the Song_Entry contains a Spotify URL, THE Detail_Component SHALL show a Spotify icon linking to that URL
8. WHEN a visitor clicks the Spotify icon, THE Detail_Component SHALL open the Spotify URL in a new browser tab
9. WHEN the Detail_View is displayed, THE Detail_Component SHALL show the artist photo with a fixed height of 200px and variable width preserving the original aspect ratio
10. WHEN the Song_Entry contains a Thoughts field, THE Detail_Component SHALL render the Thoughts content as formatted markdown below the artist photo
11. WHEN a visitor clicks outside the Detail_View content area, THE Detail_Component SHALL close the Detail_View and return to the Timeline view
12. WHEN the Detail_View is displayed, THE Detail_Component SHALL provide next and previous navigation controls to move between Song_Entry records in the same order as displayed on the Timeline
13. IF the currently displayed Song_Entry is the first entry in the Timeline, THEN THE Detail_Component SHALL disable or hide the previous navigation control
14. IF the currently displayed Song_Entry is the last entry in the Timeline, THEN THE Detail_Component SHALL disable or hide the next navigation control
15. WHEN a visitor activates the next or previous navigation control, THE Detail_Component SHALL first fade out the current detail content (heading, secondary line, artist photo, notes), THEN slide the Timeline to center the adjacent album cover in the viewport, THEN fade in the new Song_Entry's detail content
16. THE fade-out, slide, and fade-in animation sequence SHALL complete within 600 milliseconds total

### Requirement 4: Open Detail View on Mobile

**User Story:** As a mobile visitor, I want to tap an album cover to see full song details in a fullscreen view, so that I can read the notes and access streaming links without an awkward modal overlay.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768px, WHEN a visitor taps a Song_Entry album cover, THE Detail_Component SHALL display the Fullscreen_View for that Song_Entry, covering the entire viewport width and height
2. WHEN the Fullscreen_View is displayed, THE Detail_Component SHALL show a back button that navigates the visitor to the Timeline view, and THE Detail_Component SHALL also close the Fullscreen_View when the visitor activates the browser or device back navigation
3. WHEN the Fullscreen_View is displayed, THE Detail_Component SHALL show the same data fields as the desktop Detail_View: heading, secondary line, artist photo, streaming links, and rendered Thoughts
4. IF the Fullscreen_View is displayed and streaming link data is unavailable for a Song_Entry, THEN THE Detail_Component SHALL still display all other content fields and SHALL omit the streaming links section without showing an error
5. WHEN the Fullscreen_View is displayed, THE Detail_Component SHALL provide next and previous navigation controls to move between Song_Entry records
6. WHEN a visitor activates the next or previous navigation control on mobile, THE Detail_Component SHALL fade out the current detail content, scroll the view to vertically center the adjacent Song_Entry's album cover, and then fade in the new Song_Entry's detail content
7. IF the currently displayed Song_Entry is the first entry in the Timeline, THEN THE Detail_Component SHALL disable or hide the previous navigation control on mobile
8. IF the currently displayed Song_Entry is the last entry in the Timeline, THEN THE Detail_Component SHALL disable or hide the next navigation control on mobile

### Requirement 5: Responsive Layout

**User Story:** As a visitor on any device, I want the app to display appropriately for my screen size, so that I have a good experience on both phones and large monitors.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or greater, THE Timeline_Component SHALL arrange timeline entries in a single horizontal row that scrolls along the horizontal axis
2. WHILE the viewport width is less than 768px, THE Timeline_Component SHALL arrange timeline entries in a single vertical column that scrolls along the vertical axis
3. THE Timeline_Component SHALL render all album cover images at the same fixed width and height within each layout orientation, maintaining a 1:1 aspect ratio
4. WHEN the viewport is resized across the 768px breakpoint, THE Timeline_Component SHALL switch between horizontal and vertical layout within 1 second without requiring a page reload
5. WHILE the viewport width is 768px or greater, THE Timeline_Component SHALL display each album cover image at no less than 150px by 150px and no greater than 300px by 300px

### Requirement 6: Streaming Service Links

**User Story:** As a visitor, I want to quickly jump to a song on Apple Music or Spotify, so that I can listen to it.

#### Acceptance Criteria

1. WHEN a Song_Entry has an Apple Music URL, THE Detail_Component SHALL display the Apple Music logo as a clickable icon linking to that URL
2. WHEN a Song_Entry has a Spotify URL, THE Detail_Component SHALL display the Spotify logo as a clickable icon linking to that URL
3. THE Detail_Component SHALL open all streaming service links in a new browser tab without granting the opened page access to the originating page context
4. IF a Song_Entry does not have an Apple Music URL, THEN THE Detail_Component SHALL not render the Apple Music icon for that entry
5. IF a Song_Entry does not have a Spotify URL, THEN THE Detail_Component SHALL not render the Spotify icon for that entry
6. THE Detail_Component SHALL provide an accessible name indicating the streaming service name and that it opens externally for each streaming service icon

### Requirement 7: Render Personal Notes

**User Story:** As a visitor, I want to read personal reflections about each song, so that I understand why each track was chosen for its year.

#### Acceptance Criteria

1. WHEN a Song_Entry contains a Thoughts field, THE Detail_Component SHALL render the content as formatted HTML from the markdown source
2. IF a Song_Entry does not have a Thoughts field or the Thoughts field is an empty string, THEN THE Detail_Component SHALL not render a notes section for that entry
3. THE Detail_Component SHALL support markdown formatting in the Thoughts field including headings (levels 1 through 6), bold, italic, links, and lists, and SHALL sanitize any raw HTML present in the markdown source to prevent script execution
4. WHEN the rendered Thoughts content contains links, THE Detail_Component SHALL open external links in a new browser tab

### Requirement 8: Loading State

**User Story:** As a visitor, I want to see an animated loading indicator that visually represents the timeline filling in from 1981 to the present year, so that I know the app is working and get a sense of the timeline concept before data arrives.

#### Acceptance Criteria

1. WHILE the Data_Service is fetching records from the Airtable_API, THE Timeline_Component SHALL display an animated progress indicator that shows a line filling from a "1981" label to the current year label
2. THE loading indicator SHALL animate continuously from the 1981 end toward the current year end, conveying forward progress through time
3. WHILE the loading animation progresses, THE Timeline_Component SHALL display an age counter that increments from "Age 0" through the current age in sync with the line filling (e.g., "Age 0" at 1981, "Age 1" at 1982, etc.)
3. WHEN all records have been fetched and processed, THE Timeline_Component SHALL replace the loading indicator with the rendered timeline within 1 second of fetch completion
4. IF the Data_Service fails to fetch records from the Airtable_API, THEN THE Timeline_Component SHALL replace the loading indicator with an error message indicating that the data could not be loaded
5. WHEN the Data_Service initiates a fetch request to the Airtable_API, THE Timeline_Component SHALL display the loading indicator within 200 milliseconds of the request being initiated

### Requirement 9: Navigation Between Entries

**User Story:** As a visitor viewing a song's details, I want to navigate to the next or previous year without closing the detail view, so that I can browse sequentially.

#### Acceptance Criteria

1. WHEN the Detail_View is open and a next Song_Entry exists in chronological order, THE Detail_Component SHALL display a next navigation control that is keyboard-focusable and activated via click or Enter key
2. WHEN the Detail_View is open and a previous Song_Entry exists in chronological order, THE Detail_Component SHALL display a previous navigation control that is keyboard-focusable and activated via click or Enter key
3. WHEN a visitor activates the next or previous navigation control on desktop, THE Detail_Component SHALL execute the three-phase animation: fade out current content, slide timeline to center the adjacent album cover, fade in new content
4. WHEN a visitor activates the next or previous navigation control on mobile, THE Detail_Component SHALL execute the three-phase animation: fade out current content, scroll to vertically center the adjacent album cover, fade in new content
5. IF the current Song_Entry is the last in chronological order, THEN THE Detail_Component SHALL not display a next navigation control
6. IF the current Song_Entry is the first in chronological order, THEN THE Detail_Component SHALL not display a previous navigation control
7. WHILE a transition animation is in progress, THE Detail_Component SHALL ignore additional navigation control activations until the current transition completes

### Requirement 10: Keyboard Accessibility

**User Story:** As a visitor using a keyboard, I want to navigate the timeline and detail views without a mouse, so that the app is accessible.

#### Acceptance Criteria

1. THE Timeline_Component SHALL make each Song_Entry album cover focusable via keyboard tab navigation in chronological order, with a visible focus indicator distinguishable from the surrounding content
2. WHEN a Song_Entry album cover has focus and the visitor presses Enter or Space, THE Detail_Component SHALL open the Detail_View for that entry and move keyboard focus to the Detail_View modal
3. WHEN the Modal is open and the visitor presses the Escape key, THE Detail_Component SHALL close the Modal and return keyboard focus to the Song_Entry album cover that triggered it
4. WHEN the Detail_View is open and the visitor presses the right arrow key, THE Detail_Component SHALL navigate to the next Song_Entry in chronological order
5. WHEN the Detail_View is open and the visitor presses the left arrow key, THE Detail_Component SHALL navigate to the previous Song_Entry in chronological order
6. IF the Detail_View is displaying the last Song_Entry and the visitor presses the right arrow key, THEN THE Detail_Component SHALL remain on the current Song_Entry without wrapping to the first entry
7. IF the Detail_View is displaying the first Song_Entry and the visitor presses the left arrow key, THEN THE Detail_Component SHALL remain on the current Song_Entry without wrapping to the last entry

### Requirement 11: API Token Security

**User Story:** As the site owner, I want the Airtable API token to be excluded from the source repository, so that credentials are not exposed publicly.

#### Acceptance Criteria

1. THE Data_Service SHALL read the Airtable API bearer token from a build-time environment variable named AIRTABLE_API_TOKEN
2. THE Data_Service SHALL NOT include the Airtable API bearer token in source code or build output committed to version control
3. IF the AIRTABLE_API_TOKEN environment variable is undefined or set to an empty string at build time, THEN THE Data_Service SHALL fail the build and output an error message indicating the required environment variable is missing
4. THE Data_Service SHALL include the environment variable name in a .env.example file or equivalent documentation committed to version control, with a placeholder value instead of the actual token

### Requirement 12: Parse and Render Markdown Notes

**User Story:** As a developer, I want a dedicated parser for rendering the Thoughts markdown field, so that formatting is consistent and correct.

#### Acceptance Criteria

1. WHEN a Thoughts field value is provided, THE Markdown_Parser SHALL parse the markdown source into an HTML string containing only the supported element types
2. THE Markdown_Parser SHALL convert headings (levels 1 through 6), bold, italic, links, unordered lists, ordered lists, and paragraphs into their corresponding HTML elements (h1-h6, strong, em, a, ul/li, ol/li, p)
3. THE Pretty_Printer SHALL format parsed markdown structures back into markdown strings that, when re-parsed by the Markdown_Parser, produce structurally identical HTML output
4. THE Markdown_Parser SHALL produce structurally identical HTML output when a Thoughts field value is parsed, printed by the Pretty_Printer, and parsed again (round-trip property), where structurally identical means the same HTML element tree with the same text content ignoring whitespace differences
5. IF the Thoughts field value is empty or contains only whitespace, THEN THE Markdown_Parser SHALL return an empty string without error
6. IF the Thoughts field value contains unsupported or malformed markdown syntax, THEN THE Markdown_Parser SHALL render the content as plain text within a paragraph element rather than producing an error
