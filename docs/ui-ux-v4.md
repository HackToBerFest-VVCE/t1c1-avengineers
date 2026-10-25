# FormBridge AI 4.0 UI/UX

## Design Philosophy

V4 keeps the established React/FastAPI application and focuses on scholarship work: upload, compare, inspect sources, ask questions and prepare an application. The dashboard introduction is compact, the upload workflow remains near the top, and results have a visible scholarship identity and a practical split workspace. Broad sections use unframed layouts and dividing rules; bounded document tools and individual requirements use restrained borders. No backend business logic or API contracts changed.

## Design Tokens

The readable `frontend/src/styles.css` defines the palette, spacing, fonts, radii, shadows, timing, layout widths, breakpoints and focus treatment in one root token set.

| Role | Color |
| --- | --- |
| Workspace background | `#F5F8FC` |
| Sidebar | `#081426` |
| Deep navy | `#0B1F3A` |
| Electric cyan | `#00D4E8` |
| Teal accent | `#14B8A6` |
| Primary text | `#142B45` |
| Secondary palette | `#71849B` |
| Small-text muted ink | `#52677D` |
| Surface | `#FFFFFF` |
| Border | `#E3EBF3` |
| Success / warning / error accents | `#16A34A` / `#F59E0B` / `#EF4444` |

The darker muted ink is used for readable small text. Success, warning and error labels use darker ink variants on pale surfaces instead of light accent colors for body text. Status icons and words accompany color. Cyan is an accent, not a body-text color on white.

Spacing follows 4/8/12/16/24/32/40px tokens and an 8-point rhythm where practical. Tool boundaries use an 8px radius; controls use 4-6px. Shadows are restrained. Controls have stable dimensions and visible keyboard focus. Animations use 150/220ms timings with no bouncing decorations or invented progress percentages.

## Typography

Manrope is used for headings and Inter for body copy. Noto Sans Kannada supports Kannada labels and prose, with system sans-serif fallbacks. Google Fonts requests only the used weights and `display=swap`; the app remains usable if those requests fail. No font dependency or downloaded font bundle was introduced. UI type sizes are fixed at each breakpoint, not tied to viewport-width units. Kannada text wraps naturally, uses additional prose line height and is not forced into fixed-height cards.

## Component Improvements

- **Shell:** fixed navy navigation, real active states, desktop collapse/expand, tablet icon navigation, mobile modal drawer, workspace title/description, language switch and honest backend configuration indicator. Assistant and roadmap links select their existing result sections. Before analysis, the results empty state directs the student to upload.
- **Intake:** refined keyboard-accessible drop area, clear format/size guidance, image thumbnail for the selected notice, wrapped file name, original access, replacement/removal, existing sample actions, aligned optional profile fields and preserved API mappings.
- **ResultHeader:** scholarship/provider, original file, page count, returned duration/model/confidence and conservative outcome. Values come directly from analysis; configuration status is not a live provider availability guarantee.
- **AnalysisOverview:** summary and citations, deadline with the existing missing-date message, real requirement/document counts, reported missing information and existing next tasks. Shortcuts open the corresponding result tabs.
- **Eligibility:** unchanged outcome counts/logic, conservative individual status wording, structured condition, supplied value, explanation and inspectable evidence. Icons/text distinguish satisfied, possible mismatch, review and unavailable results.
- **DocumentViewer:** grouped page/zoom/fit controls, correctly fitted content width, loading treatment, expanded modal view, original-file access and a quotation-panel focus animation. Citation animation applies to the panel, never a fabricated location in the document.
- **ScholarshipChat:** model attribution, distinct user/assistant messages, a useful empty state, real suggested questions, source references, character count and a clearer composer. Existing request/history/reset/retry behavior remains intact.
- **ApplicationRoadmap:** numbered connecting timeline, completion markers, real completion count/progress, existing checkboxes/priorities, source evidence, download and print.

New components are presentation-only `ResultHeader` and `AnalysisOverview`. `useModalFocus` is a small local hook shared by the drawer and expanded viewer. No animation/state-management framework or new runtime dependency was added.

## Responsive Decisions

| Width | Layout |
| --- | --- |
| Desktop, 1440+ | Full navigation, two-column intake, side-by-side source and analysis |
| Laptop, 1024-1439 | Compact spacing, full/collapsible navigation, tighter split tools |
| Tablet, 768-1023 | Icon navigation with accessible labels/tooltips, stacked evidence/results for a readable PDF |
| Mobile, 375-767 | Modal navigation drawer, stacked intake/tools, wrapping tabs, full feature access |

The content has a maximum width, grid tracks use `minmax(0,...)`, long filenames/quotations wrap and tool overflow stays inside its scroll surface. The document viewer remains scrollable/zoomable. Results and source panels scroll independently where bounded. Print mode removes navigation, the viewer and action controls while keeping the roadmap and result context.

## Accessibility

- Skip link, labeled inputs, semantic regions, status/alert messages and visible focus outlines.
- Result tabs use roving tab stops plus ArrowLeft/ArrowRight/Home/End, a labeled tab panel and valid control references.
- Mobile drawer and expanded viewer trap keyboard focus, close with Escape and restore focus. The closed mobile drawer is inert; background scrolling is locked while a modal is open.
- Icon-only controls retain accessible names and native title tooltips.
- Existing data is escaped as React text. No raw model HTML rendering was introduced.
- Reduced motion disables CSS animations/transitions and uses immediate programmatic scrolling for navigation/citations/results.
- Status words/icons remain visible alongside colors. Checkbox completion remains distinct from official submission.

## Verification and Limitations

The supplied v3 baseline tests/build were run before UI changes. V4 retains those regression flows and extends checks for all seven profile fields, keyboard result tabs, drawer/expanded-view focus, navigation, image rendering, print layout and exported checkbox status. Four browser projects exercise 1440x1100, 1100x900, 820x1180 and 375x844. Final actual counts are in the separate delivery report.

Browser fixtures use the existing test-only Google transport. They do not establish live Gemma or Kannada semantic accuracy. The backend remains byte-for-byte unchanged. Existing scan/text-layer/session limitations still apply. Some inherited technical/branding/option text remains English; source quotations retain their original language. Font availability depends on the network, with local fallbacks. Tests use Chromium; this is not a full WCAG certification or Safari/Firefox/native screen-reader audit.
