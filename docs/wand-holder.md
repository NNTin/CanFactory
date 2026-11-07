# Wand holder

An original printable holder (`wand-holder`, `models/wand-holder/generator.scad`, `packages/contracts/src/wandHolder.ts`) for a
cat's feather or spring wand toy (issue #149). It **snaps onto a sisal scratching post from the side**, at any height, and holds
the wand's rigid handle end **upright in a socket**, parallel to the post. One printed part, no hardware.

The owner's decisions (#149):

1. **Radial snap clip.** It flexes open and snaps shut round the post from the side, so it goes on at any height. Nothing slides
   on over the post's top, which a platform or a toy usually blocks.
2. **One fixed design** for the usual ~10 cm post with its rope: the clip's own spring takes up the diameter. There is no
   diameter setting.
3. **The 8 mm hole is a socket** for the wand's rigid handle end, deep and snug enough to hold it by friction against a cat
   tugging on the feather. It is not a loose guide for the wire.
4. **Straight up**: the socket's axis is parallel to the post.

## The clip

A C-shaped band, 3.5 mm thick (behind its ridges) and 36 mm high along the post, wraps 270° round it, relaxed, with its mouth
facing away from the socket. Relaxed, the ridges' crests are **88 mm across**, less than the thinnest post it is for. So on any
post in the range the band is opened a little and squeezes the post. That grip, and the ridges pressing into the rope, hold it
up.

**It grips posts 90 to 110 mm across the rope.** That is TRIXIE's ø 9 cm replacement trunks (the most common size; article
43991, listed "ø 9 × 40 cm") up to its ø 11 cm ones, around the owner's "10 cm with sisal rope". Below 90 mm the band no longer
squeezes the post. Above 110 mm the tips sit too little past the post's widest line, and the bend going on grows past the strain
limit below.

How it goes on: press its mouth flat against the post at the height you want. The **flared lips** at the tips (18 mm long, 40°
out from the mouth's axis) meet the post on their inner faces and act as a wedge. Each spreads its arm with about 1.2 times the
push (1/tan 40°). A post of diameter D touches a lip where the lip's normal points at the post's centre, D/2 · cos 40° off the
axis. That is 34.5 to 42.1 mm for 90 to 110 mm posts, which lies on the lips' faces (31 to 43 mm) for every post in the range.
Once the post's widest line is past the tips, the arms spring back round it. To take it off or move it, pull it straight back by
the socket: the post spreads the arms again from inside. The lips double as finger tabs.

| Post (across the rope) | Seated wrap | Tips past the widest line | Strain going on | Strain seated |
|---|---|---|---|---|
| 90 mm (TRIXIE ø 9 cm) | 264° | 11.6 mm | 0.8 % | 0.1 % |
| 100 mm (nominal) | 238° | 6.2 mm | 1.0 % | 0.4 % |
| 110 mm (TRIXIE ø 11 cm) | 216° | 2.7 mm | 1.3 % | 0.7 % |

`wandHolderFlex` works these out, and `wandHolder.test.ts` checks every millimetre of the range. Each arm is a curved cantilever
on the band's middle radius, from the end of the stiff web behind the socket (±12° about the back) to its tip. Going on, the
tips spread until they are D apart. Linear curved-beam theory gives the strain at the arm's root from a sideways tip load: the
deflection is P/EI ∫ (x_tip − x)² ds and the root moment is P (x_tip − x_root). Seated, the band is bent from its relaxed radius
to the post's, a uniform strain. It is an estimate, because the spread is large for linear theory. It also ignores the rope's
give, which only lowers the strain. The test holds it under **1.5 %**.

### Material: PETG

PETG is linear to about 2.4 % strain (≈ 50 MPa yield over ≈ 2.1 GPa modulus) and yields at about 4 %. So 1.3 % going on and
0.7 % seated leave room for many on/off cycles. PLA is stiffer and more brittle: it is linear to about 1.7 % and cracks soon
after, so it is not recommended for the clip. The print notes say so.

The clip prints standing on its bottom face, with no supports. Its arms then bend in the plane of the layers, along the printed
lines, so a bend never pulls layers apart. Four perimeters (or 100 % infill) make the 3.5 mm band solid plastic.

### Grip face for sisal rope

Sisal rope is soft and uneven, not a smooth cylinder, so the inside is not a smooth bore. It has **horizontal ridges**, 0.8 mm
proud and 4 mm apart, with 45° flanks and a 0.4 mm flat on each crest. They press into the rope between its turns and keep the
clip from sliding down the post when the wand is tugged. They print without supports. The ridges stay rounded off rather than
sharp, so they do not fray the rope, and the band's squeeze stays the same along the post.

## The socket

A tube at the back of the clip, opposite its mouth, standing upright beside the post. The web that joins the tube to the band is
also the clip's stiff back, which the arms bend from.

- **Bore** `handleDiameter + 2 × clearance`: 8.4 mm with the defaults (8 mm handle, 0.2 mm play each side). The mouth has a
  0.8 mm chamfer.
- **Three crush ribs**, 1.2 mm wide, stand `clearance + squeeze` proud of the bore, so the handle squeezes each by `squeeze`
  (0.15 mm by default) whatever the clearance. This is the precedent of the cigarette case's crush ribs
  ([cigarette-case-snap.md](cigarette-case-snap.md)): the feature that reaches the mating part is sized from the clearance, so
  it always engages the same amount. Their tops ramp back into the wall 3 mm below the mouth, as a lead-in. Raise the clearance
  if your printer prints holes small; lower the squeeze if the handle is too hard to push in.
- **Closed floor**, 2 mm, with a 2 mm vent hole so the handle does not pump air in and out.
- **Depth 40 mm** by default (25 to 60 mm). That is five handle diameters, and at least three are required
  (`wandHolderIssues`). The choice of 40 mm rests on how a cat pulls: a tug on the feather reaches the handle through the
  flexible wire or spring, mostly as a **sideways pull and a bending moment**, not a straight pull up the socket. The socket
  holds that moment as two opposing contact forces, near its mouth and near its floor, about one depth apart. A deep socket
  keeps them small: about 1.5 N·m from a hard 5 N pull 30 cm out along a bent wire gives roughly 40 N at each end over 40 mm.
  Small forces mean the handle does not tilt and work itself loose, and the ribs' friction is left for the remaining upward
  pull. At three diameters (24 mm for an 8 mm handle) the forces are two thirds higher, and a shallow socket rocks. Most of a
  wand's handle still stands out of a 40 mm socket to grab.

The tube's wall is 3 mm. Where it stands above the band (6 mm with the defaults) it carries the wand's moment in bending, at
about 6 MPa for the 1.5 N·m above, far below PETG's strength.

## The post

The assembly preview shows the clip on the parts library's `trixie-43991-sisal-trunk`: TRIXIE's replacement sisal trunk, 90 ×
400 mm (the listings, read on heise preisvergleich: "Abmessungen 40x9x9cm", "ø 9 × 40 cm … inkl. Gewindestange M8 und 2
Schrauben"). That is the thinnest post in the range. The rope's thickness, about 6 mm, is an estimate. The rope is drawn as rings,
one per turn, rather than as a helix, and the M8 fixings are left out. It is a reference object, so it is never printed. It stands
in for your own post, and the bill of materials lists it only as that.

## Assembly preview

Two steps. First the clip comes from the side, its arms spread, and passes over the post. Then the arms spring shut round it. The
preview moves parts rigidly, so the clip's scale stands in for its bend. Spread, it is scaled along Y until its tips clear the
post. Seated, it is scaled to the post's diameter (90/88). `npm run check:assembly -- wand-holder` finds no shared volume
(0 mm³) in the assembled and exploded states or along either step.

## Settings

| Setting | Default | Range | What it does |
|---|---|---|---|
| Wand handle diameter | 8 mm | 5 to 12 | The handle end's diameter; the bore and ribs are sized from it |
| Socket depth | 40 mm | 25 to 60 | How deep the handle sits; at least 3 handle diameters |
| Socket clearance (advanced) | 0.2 mm | 0.1 to 0.5 | Play between the handle and the bore on each side |
| Rib squeeze (advanced) | 0.15 mm | 0 to 0.4 | How far the handle squeezes each rib; 0 is a loose guide hole |

The clip itself has no settings (decision 2).
