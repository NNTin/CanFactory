# Spring ball detent

`spring-ball-detent` is a printed spring plunger: a body holds a bought steel ball part-way out of its nose on a bought
compression spring. The body has a metric thread on the outside, to screw into a tapped hole, or is a plain cylinder, to press or
glue into a hole. The ball clicks into a dimple or a hole in the mating part. Use it for indexing, positioning, or holding a lid or slide shut until it is pushed past. It does the job of Ganter's
GN 615 and GN 615.3 spring plungers, but it is an original design (CC BY 4.0, see
[models/spring-ball-detent/ATTRIBUTION.md](../models/spring-ball-detent/ATTRIBUTION.md)). Instead of a steel body with a rolled
nose, it is a printed body generated round the ball and spring you choose. The back is closed by a printed cap or a set screw,
or the back is solid and the ball and spring go in through an opening in the side, where the spring holds itself and the ball.
One parametric file, `models/spring-ball-detent/generator.scad`, makes both parts. The model downloads as a ZIP of the **body**
and, for the press cap, the **press cap**.

It follows the toggle latch's pattern (`packages/contracts/src/toggleLatchMechanism.ts`, `apps/web/src/catioCoupling.ts`, issues
#45 and #46): the printed parts carry real hardware from the [parts library](adding-parts.md). The ball, spring and set screw are
parts-library entries, so their real dimensions size the geometry and they appear on the model's hardware list.

## How it works

The body prints standing on its back face, nose up. From the back:

1. **Tool feature.** A screwdriver slot across the back face, a hex socket for a key, or none (for a plain body).
2. **Retention.** A press cap or a set screw closes the back; or, with the side opening, the back is solid.
3. **Spring.** It sits between the retention (or the floor of its pocket) and the ball.
4. **Ball.** It rests on the nose's lip. A 45° cone narrows the bore to an opening that the ball touches 0.2 mm below the nose
   face, so the ball stands **Protrusion** out.

The nose's lip is printed, so nothing is rolled or peened. The ball and spring go in from the back, or through the side opening.

### Side opening

With **Retention** set to **Side opening**, there is no cap or screw:

- The back is solid. The bore starts at a short pocket, and above the pocket an opening runs out through the side of the body,
  towards −Y (the front in the preview).
- The ball goes in through the opening and is pushed up the bore onto the lip.
- The spring is squeezed short enough to fit the opening, put in, and let go. One end drops into the pocket below the opening, and
  the other stretches up the bore to the ball.
- Each end stays 1.5 mm inside the closed bore beyond the opening, even with the ball pushed fully in. So the spring cannot come out
  sideways, and the ball cannot come out past the lip: the spring holds both.
- On a threaded body, the thread is cleared to a plain land round the opening, so its edges do not cut through thread flanks.

## Settings

| Setting | Default | What it sets |
| --- | --- | --- |
| Body | Threaded | **Threaded** (screws into a tapped hole) or **Plain** (a cylinder, pressed or glued into a hole). |
| Thread | M10 | Threaded body only. Its ISO 261 coarse thread (M6, M8, M10 or M12), printed on the outside. |
| Body diameter | 10 mm | Plain body only. Its outside diameter (5–20 mm). |
| Ball | Steel ball 4.5 mm G100 | A ball from the library. Its bore is its largest diameter plus the clearance. |
| Spring | Gutekunst D-107 (0.63 × 4.63 × 9.6) | A compression spring from the library. |
| Protrusion | 0.8 mm | How far the ball stands out of the nose. |
| Travel | 1 mm | How far the ball can be pushed in. |
| Retention | Press cap | **Press cap** (no tools; the design sets the preload), **Set screw** (adjustable preload), or **Side opening** (no cap or screw; the spring holds itself and the ball). |
| Set screw | ISO 4026 M6 × 6 | Shown only with the set screw. A flat-point set screw from the library. |
| Body length | 22 mm | From the back face to the nose, without the ball. |
| Tool feature | Slot | **Slot** (as GN 615), **Hex socket** (as GN 615.3), or **None** (plain body only). |
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
  - Round a side opening, the thread is cleared to the same diameter, 1 mm past the opening on every side.
- **A plain body** is a cylinder of **Body diameter** with a 0.5 mm chamfer round both ends. Its own diameter takes the place of the
  thread's root in the wall checks.
- **The lip.** The ball touches the lip's edge 0.2 mm under the nose face. The opening's diameter follows from the protrusion.
- **The spring** rests on the ball where the inner edge of its end coil touches it. With the ball out, it is compressed to its
  installed length: a quarter of the way from the shortest allowed (its least length *Ln* with the ball pushed **Travel** in) to
  the longest (its free length less the least preload, the larger of 0.3 mm and a tenth of its deflection). The cap's face, the
  set screw's point at its nominal setting, or the floor of the side opening's pocket lies that far behind it.
- **The side opening** runs from 1.5 mm above the pocket's floor to 1.5 mm below the spring's top with the ball pushed in. It is
  the bore's width plus 0.2 mm across. It must take the ball, and the spring squeezed to its least length plus 0.5 mm, so the
  shortest installed length is that opening, both 1.5 mm engagements and the travel. Behind the pocket the back is solid, at least
  1.2 mm under the tool feature. The opening's ceiling prints as a short bridge.
- **The press cap** is a core 0.1 mm under the bore with six crush ribs that stand out to the bore plus the **Cap interference**,
  with a lead-in at its leading end. Its length takes it from the tool feature's floor to the spring's seat. Press it in until it
  is flush with that floor.
- **The set screw** turns in a hole tapped from its tap drill (d − P) up to where it gives the shortest installed length. Tap it
  by hand. Backed out to the least preload, the screw's back end must still stay below the tool feature.
- **The hex socket** takes the smallest ISO 2936 key (1.5 to 8 mm) whose socket, 0.15 mm over the key, passes what goes in
  through it: the cap's ribs, or the set screw's thread. Behind a solid back (side opening) it takes the largest key up to half
  the body's size, as GN 615.3 does (M10: 5 mm). It is as deep as the key, and at least 2 mm.
- **The slot** is d/5 wide (at least 1.2 mm) and d/4 deep.

The editor's notes give the spring's force with the ball out and pushed in (its rate times its compression). With the set screw,
they also give the depth to set it to and the range it adjusts over. With the side opening, they give where the opening runs and
how short to squeeze the spring to put it in. At the defaults the spring pushes 11.8 N with the ball out
and 16.4 N with it pushed in, against GN 615 M8's 18 N and 31 N for its standard spring. For more force, a 5 mm ball with the
stiffer D-139 in the same M10 body pushes 19.5 N with the ball out and 31.4 N with it pushed in.

## Validation

Every setting the body cannot be built with is refused, with the setting to change and what to change it to.

| Check | Field | Rule |
| --- | --- | --- |
| Ball and thread | `ball` | The ball's bore must leave 0.8 mm of wall (two 0.4 mm lines) to the printed thread's root, or to a plain body's outside. |
| Spring fits the bore | `spring` | The spring's largest outer diameter fits the ball's bore. |
| Spring is guided | `spring` | The spring is at least 60 % as wide as the bore. |
| Ball rests on the spring | `spring` | The spring's inner diameter is at most 80 % of the ball's, so the ball rests on its end coil. |
| Lip reach | `protrusion` | The lip still reaches a tenth of the ball's diameter (0.2–0.3 mm) over the smallest ball of its grade. |
| Lip contact | `protrusion` | The ball touches the lip's edge, at most 45° up, not the cone below it. |
| Flush when pushed | `travel` | The travel is at least the protrusion, so the ball can be pushed in flush. |
| Spring never solid | `travel` | Travel plus the least preload fit within the spring's deflection from *L0* to *Ln*. |
| Room for the cap | `bodyLength` | The body leaves a press cap at least 3 mm long. |
| Room for the set screw | `bodyLength` | The backed-out set screw stays below the tool feature. |
| Spring spans the opening | `spring` | Side opening: the spring squeezed to fit the opening still reaches 1.5 mm past both its ends when let go, also with the ball pushed in, within its least preload. |
| Solid back | `bodyLength` | Side opening: at least 1.2 mm of solid back behind the pocket, under the tool feature. |
| Set screw thread | `setScrew` | The set screw's thread leaves the wall. |
| Ball passes the tap hole | `setScrew` | The ball passes its tap hole. |
| Spring seats on the point | `setScrew` | The flat point is wider than the spring's inside, so the spring cannot slip over it. |
| Hex socket wall | `toolFeature` | The hex socket's corners leave the wall. |
| Something to turn it by | `toolFeature` | A threaded body has a slot or a hex socket. |

Every thread has working combinations, from M6 with a 2.5 mm ball to M12 with a 6 mm ball. A test walks every ball, spring,
retention and tool feature for each thread (`springBallDetent.test.ts`). The side opening needs a spring with more working
length than the cap does, and every ball size has one in the library:

| Ball | Springs that span a side opening |
| --- | --- |
| 2.5 mm | D-024, D-027 |
| 3 mm | D-024, D-027, D-040 |
| 3.5 mm | D-040, D-055 |
| 4 mm | D-040, D-055, D-083 |
| 4.5 and 5 mm | D-055, D-077, D-078, D-083, D-108 |
| 6 mm | D-078, D-102, D-108, D-134 |

For the default 4.5 mm ball, D-078 (0.5 × 4.5 × 15) works.

## Assembly

1. Print the body standing on its back face, nose up, with no supports. Use 0.2 mm layers or finer so the thread prints cleanly,
   and 100 % infill. PETG suits it. Print the press cap standing.
2. Run a die over the thread, or screw the body into its tapped hole once to clear it. The thread is printed under size by the
   **Thread play**.
3. Put the ball and the spring in:
   - **Through the back:** turn the body nose down and drop the ball into the back; it comes to rest on the lip. Drop the spring
     in after it.
   - **Through the side opening:** put the ball in through the opening and push it up the bore onto the lip, with a pin or the
     spring's end. Squeeze the spring between two fingers to the length the editor gives, put it in, and let it go. It drops into
     its pocket and pushes the ball onto the lip; nothing else holds them. Steps 4 and 5 do not apply.
4. Close the back:
   - **Press cap:** push it in with a pin punch until it is flush with the floor of the slot or socket. The crush ribs hold it.
     A drop of cyanoacrylate makes it permanent.
   - **Set screw:** tap the back with the set screw's thread (the hole is its tap drill). Turn the screw in to the depth the
     editor gives. Turn it in further for more preload, or out for less, within the range the notes give.
5. Screw a threaded body into the tapped hole with a screwdriver or hex key, until the ball stands where the mating part's dimple
   is. Press or glue a plain body into its hole. In a hole, a side opening is closed by the hole's wall.

The assembly preview shows the steps:

- **Through the back:** the ball goes up the bore onto the lip, then the spring, then the press cap or the set screw.
- **Through the side opening:** the ball goes in and is pushed up. Then the spring comes in squeezed and is let go into place.

The spring is drawn at its free length, squeezed to its installed length (a pose `scale`; see
[adding-models.md](adding-models.md#multi-part-assemblies)). After the steps, a movement pushes the ball in flush, loading the
spring by the travel, and lets it go. Hide the body in the parts list to see inside. The ball, spring and set screw are the
hardware list.
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
