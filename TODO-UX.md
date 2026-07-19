# UX

The UX will not handle all musical notation editing to start, instead favoring a solid foundation to start out.

## Views

To start off, there will be two full-page views.

### Editor

Show a small (max 300px) sidebar at left for controls, which will include view switching (top), project management (bottom), and pallet (middle).

The rest is the interactive staff. Details to follow.

### Performance

To start, just hide the sidebar, and revert to vertical (wrap) flow for the staff (explained below). Hovering over the lower left shows a menu
(fade in) that includes an "Edit" button (return to editor view), "Print" button, and "Staff" button, which launches the staff dialog described below.
The menu flows up from the bottom to make addition easy.

## Interactive Staff

## Step 1: Staff setup

The pallet includes a prominent button for staff management. It launches a dialog box where users can do two things.

1. **Staff list editor**: Staves can be added and removed. Allow clefs and labels for existing staffs to be changed. Also show a checkbox for each
   staff indicating whether it's displayed in the current view.
2. **Flow**: Pick a staff display flow preset from a dropdown: vertical (wrapping, sheet-music width), or horizontal, where each staff gets a single
   line, and the view scrolls horizontally.

## Step 2: Notes, rests, and eraser

### New notes and rests

Users click the pallet to choose a note or rest, then optionally click a flyout to choose a duration, then start placing elements
on the staff. After a note or rest has been placed, the note/rest with duration is added to a "recent selections" pallet
area; just keep the last 12 selections, cycling out old ones.

The pallet never represents pitches. Articulations can only be added to existing notes or from "recent selections" (more below).

### Eraser

Two erasers should be available to start off: element (erases notes and rests) and bar eraser (erases entire measures).

### Editing existing notes and rests

#### Flyout

Notes already on the pallet can be right-clicked to show a flyout including:

- Articulations
- Dots (duration)
- Accidentals
- Removal

New articulations and dot selections add the note duration with the dot/articulation to "recent" selections.

#### Hotkeys

Support hotkey editing while hovering over an element.

"p" - add the note/rest duration
"-" and "=" - decrease or increase duration of a note or rest (respectively)
Up and down arrows - increase or decrease pitch of a note (respectively) by semitones
Backspace and delete - Remove the element (any element)
