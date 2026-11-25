# Tecnología community transition

On a local CHILE2 instance with the Tecnología community in its catalog, open
`/comunidades?community-transition=1` and activate its card. Compare with
`/comunidades`. The flag applies on loopback hosts and `chile2.cl` and only to
the catalog card for `/2/tecnologias`. See [local setup](LOCAL_SETUP.md) for the
app and database.

Next.js 14.2.35 and React 18.3.1 use separate caches for the App Router segment and
the SWR community detail. The opt-in catalog prefetches the full Tecnología route
at hydration. The detail request can still be cold.
A direct load initially renders the existing header skeleton. On a pilot
navigation, the title comes from the clicked card and renders in the real
destination heading on first commit. The detail response supplies the rest of
the page. A loading card occupies that space until editorial content and the
feed can appear without moving already visible controls.

The title moves for 220 ms. The incoming page dissolves over the opaque outgoing
page in 110 ms, starting 18 ms into the animation. Only one title is painted.
If the heading misses the 150 ms route commit deadline, the browser skips the
animation and Next continues the navigation.

## Local verification

Tested November 24, 2026 on a local production build with the existing editorial
review database in read-only mode. The catalog, detail and feed used the real
Next → Express → PostgreSQL path.

| Condition | Observed result |
| --- | --- |
| Chromium 155, 1440 × 900, fresh tab and warm revisit | Click and Enter opened Tecnología. Both ran the transition with one named title in each snapshot. |
| Chromium 155, 390 × 844, touch emulation | A tap animated while the detail request was held. Releasing the request left the title bounds unchanged and produced no layout-shift entries. Frame capture confirmed a single moving title with no white flash. |
| Chromium 155, route response delayed by 520 ms | The animation skipped about 173 ms after activation, and the detail page opened when the response arrived. |
| Back, Forward, direct entry, refresh, Ctrl+click | Standard navigation reached the correct route without replaying the animation. |
| Reduced motion, flag absent, or another community (`/2/chile`) | The link used standard navigation. |
| Firefox 146.0.1, 1280 × 800 | Enter animated on a fresh visit and a warm revisit. With the native View Transition preference disabled, the same link worked without motion. |

## Production pilot

The [opt-in pilot](https://chile2.cl/comunidades?community-transition=1) went live
on November 24, 2026 in release `72dcfbb`. Chromium verified the transition on
the first visit and on a revisit with the production label **Tecnologías**.
The regular catalog URL and reduced-motion mode both used standard navigation.
All 42 production contract checks passed.

## Launch recommendation

Keep standard navigation for launch until the Tecnología pilot is reviewed on a
physical phone. If it passes, enable it for this path first. Keep a recognizable
card title and render the destination heading in the route's first committed
view, before the detail response. Keep loading content below the heading from
displacing visible controls. Use the single-path result before expanding to
other communities.
