# iPhone Duo: observed layouts

What the owner's screenshots of the Duo showed on 2026-10-29. The screenshots carry real names and stay out of this public repo; this file is the record.

## My-Love in the native shell today

| Pose | Side column | HTML header | HTML dock |
|---|---|---|---|
| Folded (outer display, portrait) | Right edge; holds only the time and status | Spans the width left of the column | Floats at the bottom, left of the column, over content |
| Unfolded portrait (inner) | None; status sits in a strip above the header | Full width | Floats at the bottom over content |
| Unfolded landscape (inner) | Right edge; holds only the time and status | Spans the width left of the column | Floats centred at the bottom of the content area, over content |

## My-Love in the native shell, 2026-10-30

On the owner's Duo running the current shell, web content draws into the side column: the header and cards run under iOS's status capsule. This contradicts the 2026-10-29 rows above, where content stopped at the column; story 7 records per pose, on the simulator and the device, where content actually stops.

## Other apps, all unfolded landscape

Instagram, Facebook, Netflix, Fox One, and a family location-sharing app all fill the right column the same way, top to bottom:

1. Time and status.
2. A capsule of top-toolbar actions (Instagram: new post, activity; Netflix: cast, downloads, notifications; Facebook: create, search, Messenger).
3. A capsule of tabs, bottom-aligned.

| App | Tabs in the bottom capsule |
|---|---|
| Instagram | 5 |
| Fox One | 5 |
| Netflix | 4 |
| Facebook | 6 |
| Location-sharing app | 4 |

- Tabs show icons only, no labels; the selected tab sits on a highlight disc.
- Badges (a dot or a count such as "9+" or "14") show on column items.
- Five tabs fit in the unfolded-landscape column.
