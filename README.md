# Software Testing: Techniques, Types, and Best Practices
An interactive five-page digital book for the MCA *Software Engineering* course.
Built with plain HTML5, CSS3, and vanilla JavaScript. No frameworks, backend, API keys, or internet connection are needed to read it.

## Project structure
```
software-testing-book/
├── index.html   # the five book pages, toolbar, contents panel, controls
├── style.css    # themes (light/dark), page-turn animation, responsive and print styles
├── script.js    # navigation, contents, progress, theme, fullscreen, print, editable cover
├── assets/      # optional folder for extra images (currently empty)
└── README.md
```

## How to open
1. Unzip the folder.
2. Double-click `index.html` (any modern browser: Chrome, Edge, Firefox, Safari).

## How to use
| Action | How |
|---|---|
| Turn pages | **Next / Previous** buttons, or the **Left / Right arrow** keys (**Home / End** jump to the first / last page); swipe left or right on touch screens |
| Open a page from the contents | Click **Contents**, then choose an entry (**Esc** closes the panel) |
| Reading progress | The bar above the buttons and the "Page x of 5" label |
| Light / dark mode | Moon button (your choice is remembered in this browser) |
| Fullscreen | Expand button (hidden automatically if the browser does not support it) |
| Print / PDF | Printer button (see below) |
| Student details | Click the Name, Course, or Date line on the cover and type; they are saved in this browser only |

On the first or last page, the book shakes slightly and shows a short message. If your system uses *reduce motion*, pages change instantly without animation.


## Responsive behaviour
The whole interface is exactly one window tall (toolbar, book, and page controls), so the page itself never scrolls. The book is sized from the space that is left. A page that holds more text than fits scrolls inside the book, with a fade and a "Scroll for more" hint at the bottom edge.

| Window size | Layout |
|---|---|
| 1600 px wide and 800 px tall or more | **Two-page spread** (cover alone, then pages 2-3 and 4-5). The indicator reads "Pages 2-3 of 5" |
| Laptops, tablets, small windows | **Single page**, up to about 46-60 rem wide, centred in the window |
| 760 px wide or less (phones) | One page using nearly the full width; stacked cards; swipe left/right to turn pages |
| 560 px tall or less (landscape phones) | Compact toolbar and controls so the page keeps as much height as possible |

Text size follows both window width and height (15 px minimum, 16.5 px maximum). If the window is resized, rotated, or enters fullscreen, the book keeps you on the same page and switches layout without reloading. Safe-area insets (notches) and reduced-motion settings are respected.

## Host on GitHub Pages
1. Create a new public repository on GitHub (for example `software-testing-book`).
2. Upload `index.html`, `style.css`, `script.js`, and the `assets/` folder to the repository root (drag and drop on the web page works).
3. Go to **Settings, Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select branch `main` and folder `/ (root)`, then **Save**.
4. After about a minute, the book is available at `https://<your-username>.github.io/software-testing-book/`.

## Print or export as PDF
1. Click the printer button (or press Ctrl+P / Cmd+P).
2. Choose **Save as PDF** as the destination, paper size **A4**, and turn on **Background graphics** so the cover colours print.
3. The toolbar and buttons are hidden automatically, and the book prints as exactly five pages (cover, three content pages, conclusion and references).

## Sources
All references are listed on page 5 in APA 7th edition style. Their DOI and web links were checked against publisher, library, or standards-body pages. The two textbooks are print sources and have no link. The examples (GST function, age field, checkout case) are illustrative and were written for teaching.

## Verification checklist
- [x] Exactly five logical pages (`section.page` count = 5); navigation is not counted as a page
- [x] Previous / Next, keyboard, swipe, and contents navigation tested in a real browser
- [x] Page-turn animation works forward and backward; first/last page feedback shown
- [x] Progress bar and "Page x of 5" update on every change
- [x] Light/dark mode, fullscreen, and print buttons tested
- [x] Fits the window with no page scroll and no clipped content at 1920x1080, 1440x900, 1366x768, 1280x720, 1024x768, 768x1024, 390x844, and 360x800
- [x] Print output is exactly 5 A4 pages without toolbars or buttons
- [x] In-text citations and an APA 7th edition reference list; no invented sources
- [x] No console errors; works from `file://` with no network
