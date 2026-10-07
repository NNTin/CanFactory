# Spring ball detent

`spring-ball-detent` is a printed spring plunger: a body with a metric thread on the outside holds a bought steel ball part-way
out of its nose on a bought compression spring. Screwed into a tapped hole, the ball clicks into a dimple or a hole in the mating
part. Use it for indexing, positioning, or holding a lid or slide shut until it is pushed past. It does the job of Ganter's
GN 615 and GN 615.3 spring plungers, but it is an original design (CC BY 4.0, see
[models/spring-ball-detent/ATTRIBUTION.md](../models/spring-ball-detent/ATTRIBUTION.md)). Instead of a steel body with a rolled
nose, it is a printed body generated round the ball and spring you choose, closed at the back by a printed cap or a set screw.
One parametric file, `models/spring-ball-detent/generator.scad`, makes both parts. The model downloads as a ZIP of the **body**
and, for the press cap, the **press cap**.

It follows the toggle latch's pattern (`packages/contracts/src/toggleLatchMechanism.ts`, `apps/web/src/catioCoupling.ts`, issues
#45 and #46): the printed parts carry real hardware from the [parts library](adding-parts.md). The ball, spring and set screw are
parts-library entries, so their real dimensions size the geometry and they appear on the model's hardware list.

## How it works

The body prints standing on its back face, nose up. From the back:

1. **Tool feature.** A screwdriver slot across the back face, or a hex socket for a key.
2. **Retention.** A press cap, or a set screw, closes the back.
3. **Spring.** It sits between the retention and the ball.
4. **Ball.** It rests on the nose's lip. A 45° cone narrows the bore to an opening that the ball touches 0.2 mm below the nose
   face, so the ball stands **Protrusion** out.

The ball and spring go in from the back. The nose's lip is printed, so nothing is rolled or peened.

## Settings

| Setting | Default | What it sets |
| --- | --- | --- |
| Thread | M10 | The body's ISO 261 coarse thread (M6, M8, M10 or M12), printed on the outside. |
| Ball | Steel ball 4.5 mm G100 | A ball from the library. Its bore is its largest diameter plus the clearance. |
| Spring | Gutekunst D-107 (0.63 × 4.63 × 9.6) | A compression spring from the library. |
| Protrusion | 0.8 mm | How far the ball stands out of the nose. |
| Travel | 1 mm | How far the ball can be pushed in. |
| Retention | Press cap | **Press cap** (no tools; the design sets the preload) or **Set screw** (adjustable preload). |
| Set screw | ISO 4026 M6 × 6 | Shown only with the set screw. A flat-point set screw from the library. |
| Body length | 22 mm | From the back face to the nose, without the ball. |
| Tool feature | Slot | **Slot** (as GN 615) or **Hex socket** (as GN 615.3). |
| Clearance (advanced) | 0.3 mm | The ball's play in its bore, over its largest diameter. |
| Thread play (advanced) | 0.2 mm | How far under the nominal the printed thread's crests are, so that it turns in a tapped hole. |
| Cap interference (advanced) | 0.2 mm | How far the press cap's crush ribs stand out over the bore, across. |

The defaults make an M10 body about the size of a GN 615 M8 (4.5 mm ball, 16 mm long). A printed body needs thicker walls than a
steel one, so it carries the ball of the next smaller steel size.

## Layout and preload

`springBallDetentLayout` in `packages/contracts/src/springBallDetent.ts` lays the body out along its axis. The SCAD file
computes the same, and a test keeps their fixed rules equal.

- **The thread** is ISO 68-1's basic profile: crest flat P/8, 60° flanks, depth 0.61343 P. Its crests are **Thread play** under
  the nominal diameter.
  - It is built as one polyhedron whose radius is clamped to a 45° lead-in at both ends. Nothing is intersected with the thread,
    so no two curved surfaces cross. This keeps the mesh free of float32 slivers.
  - With a slot, the back is a plain collar at the thread's root, as deep as the slot. The slot never cuts through thread flanks.
- **The lip.** The ball touches the lip's edge 0.2 mm under the nose face. The opening's diameter follows from the protrusion.
- **The spring** rests on the ball where the inner edge of its end coil touches it. With the ball out, it is compressed to its
  installed length: a quarter of the way from the shortest allowed (its least length *Ln* with the ball pushed **Travel** in) to
  the longest (its free length less the least preload, the larger of 0.3 mm and a tenth of its deflection). The cap's face, or
  the set screw's point at its nominal setting, lies that far behind it.
- **The press cap** is a core 0.1 mm under the bore with six crush ribs that stand out to the bore plus the **Cap interference**,
  with a lead-in at its leading end. Its length takes it from the tool feature's floor to the spring's seat. Press it in until it
  is flush with that floor.
- **The set screw** turns in a hole tapped from its tap drill (d − P) up to where it gives the shortest installed length. Tap it
  by hand. Backed out to the least preload, the screw's back end must still stay below the tool feature.
- **The hex socket** takes the smallest ISO 2936 key (1.5 to 8 mm) whose socket, 0.15 mm over the key, passes what goes in
  through it: the cap's ribs, or the set screw's thread. It is as deep as the key, and at least 2 mm.
- **The slot** is d/5 wide (at least 1.2 mm) and d/4 deep.

The editor's notes give the spring's force with the ball out and pushed in (its rate times its compression). With the set screw,
they also give the depth to set it to and the range it adjusts over. At the defaults the spring pushes 11.8 N with the ball out
and 16.4 N with it pushed in, against GN 615 M8's 18 N and 31 N for its standard spring. For more force, a 5 mm ball with the
stiffer D-139 in the same M10 body pushes 19.5 N with the ball out and 31.4 N with it pushed in.

## Validation

Every setting the body cannot be built with is refused, with the setting to change and what to change it to.

| Check | Field | Rule |
| --- | --- | --- |
| Ball and thread | `ball` | The ball's bore must leave 0.8 mm of wall (two 0.4 mm lines) to the printed thread's root. |
| Spring fits the bore | `spring` | The spring's largest outer diameter fits the ball's bore. |
| Spring is guided | `spring` | The spring is at least 60 % as wide as the bore. |
| Ball rests on the spring | `spring` | The spring's inner diameter is at most 80 % of the ball's, so the ball rests on its end coil. |
| Lip reach | `protrusion` | The lip still reaches a tenth of the ball's diameter (0.2–0.3 mm) over the smallest ball of its grade. |
| Lip contact | `protrusion` | The ball touches the lip's edge, at most 45° up, not the cone below it. |
| Flush when pushed | `travel` | The travel is at least the protrusion, so the ball can be pushed in flush. |
| Spring never solid | `travel` | Travel plus the least preload fit within the spring's deflection from *L0* to *Ln*. |
| Room for the cap | `bodyLength` | The body leaves a press cap at least 3 mm long. |
| Room for the set screw | `bodyLength` | The backed-out set screw stays below the tool feature. |
| Set screw thread | `setScrew` | The set screw's thread leaves the wall. |
| Ball passes the tap hole | `setScrew` | The ball passes its tap hole. |
| Spring seats on the point | `setScrew` | The flat point is wider than the spring's inside, so the spring cannot slip over it. |
| Hex socket wall | `toolFeature` | The hex socket's corners leave the wall. |

Every thread has working combinations, from M6 with a 2.5 mm ball to M12 with a 6 mm ball. A test walks every ball, spring,
retention and tool feature for each thread (`springBallDetent.test.ts`).

## Assembly

1. Print the body standing on its back face, nose up, with no supports. Use 0.2 mm layers or finer so the thread prints cleanly,
   and 100 % infill. PETG suits it. Print the press cap standing.
2. Run a die over the thread, or screw the body into its tapped hole once to clear it. The thread is printed under size by the
   **Thread play**.
3. Turn the body nose down and drop the ball into the back. It comes to rest on the lip.
4. Drop the spring in after it.
5. Close the back:
   - **Press cap:** push it in with a pin punch until it is flush with the floor of the slot or socket. The crush ribs hold it.
     A drop of cyanoacrylate makes it permanent.
   - **Set screw:** tap the back with the set screw's thread (the hole is its tap drill). Turn the screw in to the depth the
     editor gives. Turn it in further for more preload, or out for less, within the range the notes give.
6. Screw the body into the tapped hole with a screwdriver or hex key, until the ball stands where the mating part's dimple is.

The assembly preview shows the steps: the ball goes up into the bore onto the lip, then the press cap or the set screw. The spring
stands beside the body at its free length, since inside it is compressed. The ball, spring and set screw are the hardware list.
`npm run check:assembly -- spring-ball-detent` checks the parts for collisions. As with the AI duck's ribs, only the press cap's
crush ribs share volume with the bore, by design. With them left off, everything clears:

```sh
npm run check:assembly -- spring-ball-detent --defines '{"CAP_RIBS":false}'
```

## Sources

- The thread's sizes are ISO 261's coarse pitches. The profile is ISO 68-1's.
- The balls, springs and set screws come from the parts library (`packages/contracts/src/parts/`):
  - **Balls:** ISO 3290-1 / DIN 5401 grade G100 chromium-steel balls, with G100's ±47.5 µm boundary dimensions (Kugel Pompel's
    DIN 5401 data sheet).
  - **Springs:** Gutekunst compression springs, with each article's d, De, L0, Ln, Lndyn and rate (federnshop.com).
  - **Set screws:** ISO 4026 flat-point set screws (fasteners.eu's table).
- Ganter's GN 615 and GN 615.3 tables (ganternorm.com, read 2026-10-07) were compared for proportions only. For example, GN 615
  M8 has a 4.5 mm ball, 16 mm length and 1.5 mm travel; GN 615.3 sizes its hex A/F 3/4/5/6 for M6–M12. Their values are not
  copied into the model.
