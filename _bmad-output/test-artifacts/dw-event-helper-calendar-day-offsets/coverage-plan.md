DW-84 selective coverage plan

| ID | Priority | Level | Scenario and independent oracle |
| --- | --- | --- | --- |
| DW84-API-001 | P1 | API | Actual Nuuk helper +1 output is POSTed by owner and read by partner; both responses retain literal `2026-03-28`. |
| DW84-E2E-001 | P1 | E2E | Actual helper +1 output enters Settings form; POST, Zustand local date, rendered date, reload and edit prefill retain March 28, 2026. |

Both protect a shared setup integration boundary. No P0 security or critical production code is changed. No P2/P3 matrix is added: 21 existing unit cases cover calendar edges cheaply, including five isolated Nuuk offsets. Unit acceptance checks will be rerun. Existing API/E2E suites use ordinary relative anchors; the predecessor artifact tests midnight crossing, not the late-evening DST gap.

Use one date-case factory with faker identity, a fixed regression anchor in an isolated child Node process, and literal expected dates. It imports the real changed helper and unchanged complementary factory; it does not copy the date calculation. Reuse coupleEvents for checked worker-pair cleanup and established authentication. The API GET uses partner auth to check persisted date across the couple's read boundary. E2E exercises the real form and loader with interception before action, response then store then UI assertions.

Browser probe: Chromium CLI launches. Pre-generation navigation to localhost:5173/settings returned ERR_CONNECTION_REFUSED (no dev server running). Source confirms testids and existing E2E paths; Playwright's unchanged webServer will start the app for execution. No selectors are guessed. Browser context uses existing auth fixture and real timezone/clock; no Nuuk browser emulation claim, because auth fixture does not forward timezoneId. Past events remain accessible in Settings with this empty pair.

No API rejection matrix, Pact suite, new unit matrix, production change, root fixture/config change, or package script change is warranted. API/E2E files and factory are stored under this artifact bundle in tests/ layout, temporarily staged with exclusive-file creation into normal tests/ for verification and removed afterward. Documentation and evidence remain under the configured test_artifacts directory.
