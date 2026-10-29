---
title: 'Technical research: iPhone Duo support for the My-Love PWA (Safari 27.1)'
type: 'technical'
topic: 'iPhone Duo support for the My-Love PWA (Safari 27.1)'
decision: 'How the installed My-Love PWA should lay out on iPhone Duo: viewport sizes, safe areas around the outer display''s side controls, posture APIs, and where the dock sits on each display'
source: 'native run'
status: complete
claims_verified: 5
claims_unverified: 4
claims_tally_basis: 'recon_kit tally, keyed by cited source (last status per source)'
preset: 'standard'
validation: 'normal'
created: '2026-10-29'
updated: '2026-10-29'
---

# Technical research: iPhone Duo support for the My-Love PWA (Safari 27.1)

**Decision this research serves:** How the installed My-Love PWA should lay out on iPhone Duo: viewport sizes, safe areas around the outer display's side controls, posture APIs, and where the dock sits on each display.

**Questions asked:**
- Q1: The CSS viewport size in each state, and whether a Home Screen web app differs from Safari.
- Q2: Where the outer display's right-side "hardware controls" sit, what `env(safe-area-inset-*)` reports there, and what `viewport-fit=cover` does.
- Q3: Whether Viewport Segments and Device Posture work without a flag.
- Q4: Apple's guidance on where navigation goes.
- Q5: How to test without the device.

"Home Screen web app" means the PWA installed to the Home Screen and running as `display-mode: standalone`.

**These findings expire fast.** Most are tied to the current releases (Safari 27.1/27.2, Xcode 27.1, Playwright 1.64). The earliest re-check is **2026-11-14**, for the Playwright claims (see the staleness map).

## Executive summary

**What to do:**
- Keep the PWA responsive and device-agnostic for now.
- Keep the bottom dock.
- Pad pinned UI with all four safe-area insets.
- Do not adopt `viewport-fit=cover` or the fold APIs yet.
- Measure the one decisive gap, how a Home Screen web app behaves, in the Xcode 27.1 iPhone Duo simulator.

**What drives that answer:**
- **Safari tabs are fully specified; Home Screen web apps are not.** WebKit gives exact Safari 27.1 viewports in CSS pixels: widths from 382 (outer portrait) to 951 (inner landscape), 385 per Split View window, and heights from 368 to 902 [1]. No first-party source covers Home Screen web apps, partially folded sizes, `devicePixelRatio`, or `env(safe-area-inset-*)` values, so all of those are UNVERIFIED. Playwright cannot emulate them [18][19][20]. Only the simulator can measure them, and even whether the simulator exposes the fold flags is unverified.
- **The "right-side controls" are not hardware buttons.** They are the status bar, Dynamic Island, and toolbar/tab bar, moved into a side column, which is on the right in outer portrait [1][3][16]. In Safari 27.1 a page cannot draw there; Safari fills it with the page background. `viewport-fit=cover` is only a possible future route [1].
- **Fold APIs are flag-gated.** Device Posture and Viewport Segments are a developer preview behind flags each user must turn on [1][2].
- **Apple's guidance is native-only.** It puts bars on the side in every pose except the inner display in portrait, and on each app's outer edge in Split View [3][16]. It never mentions web apps.

## A. Platform facts (Q1–Q3)

### Q1. Safari tab sizes are published; Home Screen web app and partially folded sizes are not

WebKit publishes one table of CSS-pixel viewport sizes for **Safari 27.1 tabs** on iPhone Duo [1]. SVH and LVH are the small and large viewport heights (`svh`/`lvh`). They differ because Safari's tab bar shrinks as the page scrolls. The tab bar sits at the bottom on the outer display and at the top on the inner display [1].

| State | Width | SVH | LVH | Source |
|---|---|---|---|---|
| Outer display, portrait | 382 | 580 | 618 | [1] |
| Outer display, landscape | 594 | 368 | 406 | [1] |
| Inner display, portrait (one tab) | 669 | 867 | 902 | [1] |
| Inner display, landscape (one tab) | 951 | 585 | 620 | [1] |
| Inner display, each of two windows side by side (Split View) | 385 | 571 | 609 | [1] |
| Partially folded (tent, book, laptop) | not stated | not stated | not stated | none |

- **Split View.** WebKit describes two side-by-side windows only "when the inner display is in landscape" [1]. No first-party source says whether a portrait Split View exists.
- **Partially folded.** The post names the device's six poses: outer, tent, inner landscape, book, inner portrait, and laptop. Its table has no row for the partially folded ones [1]. Apple says that when the device is partially folded, the fold becomes a "division" region that splits the inner display into several usable regions. That region has zero width when the device is flat [7]. No first-party source gives segment rectangles or `devicePixelRatio`.
- **Home Screen web app vs a Safari tab: UNVERIFIED.** All of WebKit's numbers are labeled "in Safari 27.1" and assume Safari's tab bar, which a Home Screen web app doesn't show. No first-party source covers Home Screen web apps on iPhone Duo [1][2][3][5][6][7][8]. This research doesn't derive their sizes from the Safari numbers.
- WebKit's own advice is to rely on responsive layout and feature detection, not these numbers: "Avoid UA sniffing to detect devices, and use feature detection instead" [1].

### Q2. The side controls are relocated system UI that a page cannot draw under, and their insets are unpublished

- **Correction: they are not hardware controls.** Q2 asked about the outer display's right-side hardware controls. The right-side "controls" are system and app UI that iOS moves into a column: "the Dynamic Island, the status bar, the toolbar (including navigation buttons), and the tab bar" [3]. The outer display is "wider and shorter than other iPhone displays", so "iOS moves controls to the side" [1]. In Safari, the column also holds Safari's own controls [1].
- **Which edge.** In outer portrait the column is on the **right**. WebKit's screenshot caption says "a column on the right. That space holds the controls for Safari and for the phone itself" [1]. Apple's guidance for native apps running in compatibility mode agrees: "your app will use the screen space to the left of the status bar and camera" [5]. The web statement is only an image caption, so confidence is medium. Where the column goes in the other poses is in the Q4 table.
- **Width.** Apple calls the column "fixed width" [6], but no first-party source gives a number.
- **`env(safe-area-inset-*)`.** No first-party source states the values on iPhone Duo in any state, in Safari or in a Home Screen web app. Apple's native guidance is that safe areas are "often asymmetric. This is especially true on iPhone Duo", and that "vertical bars provide leading and trailing insets" [5].
- **Content under the column today.** "In Safari 27.1, web content does not currently extend to fill the space behind these controls. … Safari looks at the web page and extends its background color to fill the space" [1].
- **`viewport-fit=cover`.** WebKit mentions it only as one possible future way to open that space: "We could use the HTML viewport meta tag with viewport-fit="cover" to extend the webpage into that space". It then adds, "We are investigating if there's a better way … stay tuned" [1]. No source says what `viewport-fit=cover` does on iPhone Duo today, in Safari or in a Home Screen web app. The Safari 27.2 post (released 2026-10-26) says nothing about any of this [8].
- **Related iOS 27 reports (not iPhone Duo), worth checking during open question 2.** Two third-party reports on bugs.webkit.org describe iOS 27 Home Screen web apps.
  - One was filed from an iPhone 16 Pro Max. Content under the status bar sits beneath a system blur even with `viewport-fit=cover` and `black-translucent` (Bugzilla status NEW, Apple radar imported) [11].
  - In the other, a top blur reaches "roughly 40px below" the status bar. It names no device [12].
  - These are reporters' observations, not Apple statements, so confidence is low to medium.

### Q3. Viewport Segments and Device Posture: neither is on by default

- Safari 27.1 adds both APIs **behind feature flags** [2]. WebKit calls them "a developer preview behind feature flags" on iPhone Duo; the user turns them on under Settings > Apps > Safari > Advanced > Feature Flags [1]. "There may still be time to evolve how they work" [1]. The 27.2 post doesn't mention either API [8], so whether 27.2 changed the flag status is UNVERIFIED.
- What ships behind the flags:
  - `navigator.devicePosture` and the `device-posture` media query. `folded` means partially folded; `continuous` means flat, whether fully open or fully closed [1][2].
  - The `horizontal-viewport-segments` and `vertical-viewport-segments` media queries.
  - Six `env(viewport-segment-*)` variables, indexed by column and then by row, starting at the top left [1].
  - `window.viewport.segments`, which returns `DOMRect[]` [1].
- No other fold-related media query or API is named [1][2]. The only fold behavior on by default is a user-facing one: PDFs show as two pages in book pose [2].
- Implementation state: a testing hook to set fold rectangles is in progress (bug 328694, NEW) [9]. Segments don't reach cross-site iframes under Site Isolation (bug 328695, NEW) [10].

## B. Navigation guidance (Q4)

### Q4. Apple puts bars in a side column in every pose but inner portrait, for native apps only

Apple's guidance is written for native apps built from system components: "If you use standard system components, you receive this layout automatically" [3]. **No first-party page addresses web apps, Safari content, or Home Screen web apps**, so applying it to a PWA's own HTML navigation is an inference.

| Pose | Where bars go (native) | Source |
|---|---|---|
| Outer display, portrait | Side column on the **right**. Content sits to its left. The tab bar "stays bottom aligned" in the column, top toolbar items move to its top, and bottom ones to its bottom. | [16][3] |
| Outer display, landscape | Side column by implication only: the HIG makes inner portrait the sole exception to side bars, "The exception is the inner display in portrait" [3]. No source addresses this rotation directly (medium confidence). The edge is not stated; "vertical buttons can appear on the left side in landscape" [5]. | [3][5] |
| Inner display, portrait | The only pose that keeps standard horizontal bars (top and bottom). | [3][16] |
| Inner display, landscape | Side column, in the same position as on the outer display, tied to the hardware [6]. The edge isn't named. A tab bar may become a sidebar for information-dense apps. | [3][6][16] |
| Split View (inner display) | Each app puts its controls on its own outer edge: "the left app has controls on the left" [3]. | [3][16] |
| Partially folded | The fold is a reserved region: keep important elements and interactive controls off it. Prefer an even number of grid columns, and make small adjustments, not rearrangements. When partially folded, "interactive elements move to the bottom half of the display" [16]. | [3][7][16] |

Rules that hold across poses [3]:
- "In general, don't override the default bar placement."
- Keep the controls' relative positions stable from pose to pose.
- Put primary navigation (Back, Close) at the top of the side column. Overflow starts from the bottom: "Items overflow from bottom to top by default."
- Items with text labels stay in a horizontal bar instead of moving to the side column, so prefer a symbol wherever one works. Items too wide for the column (text buttons, segmented controls) stay in the navigation bar [16].
- Use safe areas so that controls on either edge never cover content [3][16].
- Design two layouts, compact width for the outer display and regular width for the inner display, not one per pose [3]. Size classes: outer portrait is compact width with regular height, outer landscape is compact in both, and the inner display is regular in both [5].

## C. Testing without the device (Q5)

### Q5. Playwright covers viewport sizes only; everything else needs the Xcode 27.1 simulator

**Playwright**
- Playwright can reproduce the **viewport sizes** from §A as custom viewports in its WebKit engine. It cannot reproduce:
  - Safari's tab bar or the side column
  - `env(safe-area-inset-*)` values
  - `display-mode: standalone`
  - posture or segments
- This list comes from what Playwright's documentation leaves out. Playwright itself doesn't state these limits.
- Latest release v1.64.1, 2026-10-14 [21]. Version 1.64 bundles WebKit 27.2 [17].
- **No iPhone Duo device.** The device list's only foldables are Galaxy Z Fold 6 and 7 and Galaxy Z Flip 6 and 7 (with Cover and landscape variants), each a single viewport. A device entry carries only user agent, screen, viewport, scale factor, `isMobile`, `hasTouch`, and browser type, so there is nowhere to express safe areas, segments, or posture [18].
- `page.emulateMedia` covers only media type, color scheme, reduced motion, forced colors, and contrast [19]. The emulation guide, the context options, and the 1.60–1.64 release notes contain nothing on `display-mode`/standalone, safe-area insets, device posture, or viewport segments [17][20]. The one related change: 1.64 passes a descriptor's `screen` through to `window.screen` and media queries [17].

**Xcode 27.1 simulator (Device Hub)**
- Xcode 27.1 includes an iPhone Duo Simulator runtime. Known issues: StandBy and most app extensions are unavailable [13]. WebKit points web developers to it: "You don't need iPhone Duo in hand to test your website or web app" [1].
- Pose controls sit under the simulator's bezel [14]:
  - three buttons: **Closed**, **Partially Open**, and **Open**
  - a slider for any fold angle: "hold the Option key while dragging the slider"
  - rotation with the bezel button or Device > Orientation
- The documentation doesn't say outright that Closed shows the outer display and Open the inner one, and it doesn't name tent, book, or laptop.
- Web Inspector: "Web Inspector is always enabled for simulators", and "When a Home Screen web app is in the foreground, you can inspect it from the Develop menu" [15]. That page doesn't name iPhone Duo, and the Home Screen sentence is written for devices in general.
- **UNVERIFIED:** whether the iPhone Duo simulator's Settings has the Device Posture and Viewport Segments feature flags, and whether its pose controls drive those APIs. No first-party page says either. A WebKit testing hook for setting fold rectangles is still open (bug 328694) [9].

## Cross-dimension insights

- **Apple's guidance and WebKit's behavior describe different things.** The HIG and Tech Talks say a native app's tab bar moves into the side column [3][16], and that bars move together to the side "in some poses" [4]. Only system components move this way. WebKit describes the same column on the web as space Safari keeps for its own controls and the phone's, with the page kept out and only its background color shown there [1]. A web app's dock is ordinary HTML, and nothing in either source says iOS moves it. "Put the tab bar in the side column" has no web equivalent today: in 27.1 a page cannot draw in that column [1].
- **The dock decision turns on open question 1, which only a simulator measurement can answer** [15].

## Recommendations

This research feeds a future ticket for an iPhone Duo layout pass on the PWA. No such ticket exists yet. Each recommendation names the basis for its confidence.

1. **Ship no iPhone Duo–specific layout yet. Rely on responsive layout and feature detection, never UA sniffing.** High confidence: it is WebKit's explicit guidance [1], and the posture and segment APIs are flag-gated [2].
2. **Measure a Home Screen web app in the Xcode 27.1 iPhone Duo simulator before any dock decision** (open question 1). Medium confidence that the workflow works: each step rests on one source [14][15]. This measurement is the only route to the facts recommendations 3–5 depend on.
3. **Treat 382 CSS px as the narrowest width to check, and 368 px (outer landscape, small viewport height) as the shortest height** [1]. Each Split View window is 385 px wide [1]. High confidence for Safari tabs. For Home Screen web apps, treat these numbers as a lower bound at best; they are UNVERIFIED.
4. **Keep the dock at the bottom on every display for now. Don't move it to a side rail.** Medium confidence:
   - In Safari tabs the page cannot draw in the side column, so the column doesn't cover a bottom dock [1].
   - Apple's own native tab bar stays bottom-aligned within its column [16], and Apple says "don't override the default bar placement" [3]. That is native guidance applied by inference.
   - Revisit if the measurement shows that a Home Screen web app extends under the column.
5. **Pad anything pinned to the screen with all four `env(safe-area-inset-*)` values, left and right as well as bottom.** Medium confidence: the inset values on iPhone Duo are UNVERIFIED, but Apple says the device's insets are asymmetric and come from vertical bars on either edge [5]. The rule must hold for the dock, full-height views, and anything else pinned to the edges.
6. **Hold off on `viewport-fit=cover` and on the fold APIs.** High confidence:
   - WebKit calls `viewport-fit=cover` only a possible future route and is "investigating if there's a better way" [1].
   - The posture and segment APIs are a developer preview [1] and still don't reach cross-site iframes [10].
   - A fold-aware layout today would reach only people who have turned on a Safari feature flag.
7. **Add Playwright WebKit runs at the five viewport widths from §A to catch layout regressions** [1][17]. High confidence on scope: Playwright cannot emulate the column, the insets, standalone mode, or posture [18][19][20], so those stay with the simulator.

## Open questions

1. **Viewport size, insets, and side column for a Home Screen web app, in each pose.**
   - How to answer: install the PWA in the Xcode 27.1 iPhone Duo simulator and attach Web Inspector [15].
   - Record `innerWidth`/`innerHeight`, `devicePixelRatio`, the four `env(safe-area-inset-*)` values, and a screenshot.
   - Do it in Closed and Open, in both orientations, and in Split View.
   - No document answers this; only a measurement can.
2. **What `viewport-fit=cover` does on iPhone Duo today**, in Safari and in a Home Screen web app.
   - Answer it with the same simulator run, with and without the meta value, and check for the status-bar blur reported on other iOS 27 devices [11][12].
   - Also watch the WebKit blog: WebKit says "stay tuned" [1].
3. **Partially folded viewport size and segment rectangles.** Check whether the simulator's Settings shows the two feature flags; if it does, read `window.viewport.segments` in Partially Open. Whether the simulator supports this is UNVERIFIED.
4. **Which physical edge the column uses in outer and inner landscape, and its width.** No first-party source gives a number [6]. The simulator screenshots from question 1 would settle it.
5. **Whether 27.2 changed the flag status.** The 27.2 post is silent [8]. Re-read the Safari 27.2 release notes at the next refresh.

## Source appendix

| # | Supports | Publisher | Pub date | Accessed | Confidence |
|---|---|---|---|---|---|
| [1] | Safari tab viewport sizes; side column in Safari; viewport-fit future route; flags; Device Hub pointer | [WebKit — WebKit Features for Safari 27.1](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/) | 2026-10-23 | 2026-10-29 | high (re-fetched, quotes confirmed) |
| [2] | Device Posture and Viewport Segments behind flags; PDF book pose | [Apple — Safari 27.1 Release Notes](https://developer.apple.com/documentation/safari-release-notes/safari-27_1-release-notes) | 2026-10 (undated page) | 2026-10-29 | high |
| [3] | Bar placement per pose; Split View; fold; safe areas; size-class layouts | [Apple — HIG: Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) | 2026-09-09 | 2026-10-29 | high |
| [4] | Bars move together to the side in some poses | [Apple — Preparing your app for iPhone Duo](https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo) | undated | 2026-10-29 | high |
| [5] | Right-edge column (compatibility mode); asymmetric safe areas; left-side buttons in landscape; size classes | [Apple — Tech Talk 111461, Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/) | 2026-09-09 | 2026-10-29 | high |
| [6] | Column fixed width; same position on inner landscape; tied to hardware | [Apple — Tech Talk 111462, Raise the bar with iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111462/) | 2026-09-09 | 2026-10-29 | high |
| [7] | Fold is a division region, zero width when flat | [Apple — Tech Talk 111463, Strike a pose with adaptive layouts on iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111463/) | 2026-09-09 | 2026-10-29 | high |
| [8] | 27.2 released; silent on iPhone Duo topics | [WebKit — WebKit Features for Safari 27.2](https://webkit.org/blog/18515/webkit-features-for-safari-27-2/) | 2026-10-26 | 2026-10-29 | high |
| [9] | Testing hook for viewport fold rects (NEW) | [WebKit Bugzilla — bug 328694](https://bugs.webkit.org/show_bug.cgi?id=328694) | 2026-10-23 | 2026-10-29 | high |
| [10] | Segments missing in cross-site iframes (NEW) | [WebKit Bugzilla — bug 328695](https://bugs.webkit.org/show_bug.cgi?id=328695) | 2026-10-23 | 2026-10-29 | high |
| [11] | iOS 27 Home Screen web app content under status-bar blur (iPhone 16 Pro Max) | [WebKit Bugzilla — bug 325807 (third-party report)](https://bugs.webkit.org/show_bug.cgi?id=325807) | 2026-09-30 | 2026-10-29 | medium |
| [12] | iOS 27 Home Screen web app top blur ~40px (device unnamed) | [WebKit Bugzilla — bug 329103 (third-party report)](https://bugs.webkit.org/show_bug.cgi?id=329103) | 2026-10-27 | 2026-10-29 | low |
| [13] | iPhone Duo Simulator runtime in Xcode 27.1 | [Apple — Xcode 27.1 Release Notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-27_1-release-notes) | undated | 2026-10-29 | high |
| [14] | Device Hub pose buttons, fold slider, rotation | [Apple — Interacting with your app in Device Hub](https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-device-hub) | undated | 2026-10-29 | medium (single source) |
| [15] | Web Inspector on simulators and Home Screen web apps | [Apple — Inspecting iOS and iPadOS](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios) | undated | 2026-10-29 | medium (iPhone Duo not named) |
| [16] | Right-side column, tab bar bottom-aligned, inner portrait horizontal, sidebar option, fold guidance | [Apple — Tech Talk 111466, Design for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111466/) | 2026 (undated) | 2026-10-29 | high |
| [17] | Version 1.64 bundles WebKit 27.2; 1.60–1.64 notes silent on fold/safe-area/display-mode; `screen` forwarding | [Playwright — release notes](https://github.com/microsoft/playwright/blob/main/docs/src/release-notes-js.md) | main, 2026-10 (undated sections) | 2026-10-29 | high |
| [18] | No iPhone Duo descriptor; foldables are Z Fold/Flip 6 and 7; descriptor fields | [Playwright — deviceDescriptorsSource.json](https://raw.githubusercontent.com/microsoft/playwright/main/packages/isomorphic/deviceDescriptorsSource.json) | main, 2026-10 | 2026-10-29 | high |
| [19] | `emulateMedia` options | [Playwright — class Page docs](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-page.md) | main, 2026-10 | 2026-10-29 | high |
| [20] | Emulation guide has no safe-area/display-mode/posture/segments | [Playwright — emulation guide](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/emulation.md) | main, 2026-10 | 2026-10-29 | high |
| [21] | Latest Playwright release v1.64.1 and its date | [Playwright — GitHub release v1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1) | 2026-10-14 | 2026-10-29 | high |

## Staleness map

A one-month window applies to viewport, safe-area, API-availability, and tooling claims, which are tied to versions. Design guidance gets 12 months. Undated Apple tooling pages use the access date.

| Claim | Class | Pub | Re-check |
|---|---|---|---|
| Playwright has no Duo descriptor or posture/segment/safe-area/display-mode emulation | tooling | 2026-10-14 | 2026-11-14 |
| Safari 27.1 tab viewport sizes | viewport-size | 2026-10-23 | 2026-11-23 |
| Home Screen web app sizes not covered by any first-party source | viewport-size | 2026-10-23 | 2026-11-23 |
| Page kept out of the side column; viewport-fit=cover future-only | safe-area | 2026-10-23 | 2026-11-23 |
| Side column on the right in outer portrait | safe-area | 2026-10-23 | 2026-11-23 |
| Posture and segments behind feature flags | api-availability | 2026-10-23 | 2026-11-23 |
| Segments missing in cross-site iframes (bug 328695) | api-availability | 2026-10-23 | 2026-11-23 |
| Device Hub pose controls; Web Inspector in simulator | tooling | 2026-10-29 | 2026-11-29 |
| HIG bar placement per pose | design-guidance | 2026-09-09 | 2027-09-09 |

The earliest re-check is **2026-11-14**, for the Playwright tooling claim.
