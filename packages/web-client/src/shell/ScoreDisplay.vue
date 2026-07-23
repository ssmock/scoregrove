<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { Fraction } from '@scoregrove/domain/Fraction';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { Pitch } from '@scoregrove/domain/Pitch';
import type { Score } from '@scoregrove/domain/Score';
import { DisplayProjection } from '@scoregrove/editing/DisplayProjection';
import { InteractionGeometry, type StaffHit } from '@scoregrove/editing/InteractionGeometry';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import GlyphView from '../music/GlyphView.vue';
import { addressKey, playingAddressesKey } from '../music/playbackHighlight';
import ScoreView, { type HoverPoint } from '../music/ScoreView.vue';
import SystemView from '../music/SystemView.vue';
import { canvasTextMeasurer } from '../music/textMeasure';
import { useEditorStore } from '../store/useEditorStore';
import { useHotkeys } from '../ui/composables/useHotkeys';
import ElementEditorFlyout from './ElementEditorFlyout.vue';
import PlaybackBarFlyout from './PlaybackBarFlyout.vue';

/**
 * The score however the current flow preset wants it shown: vertical
 * (line-broken, wrapping to the container's width — ScoreView already
 * handles that) or horizontal (one unbroken system, scrolling). Staff
 * visibility is display-only here — projecting never touches the real
 * score, just what gets laid out and rendered.
 *
 * `interactive` turns this into the editor's clickable staff: hover
 * highlight/ghost preview, click to place or erase, right-click to edit an
 * existing note, and the hover-scoped hotkeys. The performance view and
 * Storybook leave it false and get a read-only display with no store
 * dependency exercised.
 */
const props = withDefaults(
  defineProps<{
    score: Score;
    flow?: 'vertical' | 'horizontal';
    hiddenStaves?: ReadonlySet<number>;
    scale?: number;
    interactive?: boolean;
  }>(),
  { flow: 'vertical', hiddenStaves: () => new Set(), scale: 10, interactive: false },
);

const store = useEditorStore();

const measureText = canvasTextMeasurer();

const projection = computed(() => DisplayProjection.project(props.score, props.hiddenStaves));
const projected = computed(() => projection.value.score);

/**
 * The sounding notes/chords, in the *display* coordinates the renderer lays
 * out: the store reports real-score addresses, so each is mapped to its
 * display staff (dropped if that staff is hidden). Provided down to the
 * note/chord views, which tint themselves when their address is in the set.
 */
const playingAddresses = computed(() => {
  const staffMap = projection.value.staffMap;
  const keys = new Set<string>();

  for (const address of store.state.playback.sounding) {
    const displayStaff = staffMap.indexOf(address.staff);

    if (displayStaff === -1) continue;

    keys.add(addressKey({ ...address, staff: displayStaff }));
  }

  return keys;
});

provide(playingAddressesKey, playingAddresses);

const unbrokenSystem = computed(() =>
  props.flow === 'horizontal' ? SystemLayout.unbroken(projected.value, { measureText }) : null,
);

const hover = ref<HoverPoint | null>(null);
const flyout = ref<{
  at: { x: number; y: number };
  location: { measure: number; staff: number; voice: number };
  onset: Fraction;
  pitch: Pitch | null;
} | null>(null);

/** The right-click playback menu on a bar handle */
const barFlyout = ref<{ at: { x: number; y: number }; measure: number } | null>(null);

/** Left-click a bar handle: seek the playhead there */
function onBarClick(payload: { measureIndex: number }): void {
  store.seekToMeasure(payload.measureIndex);
}

/** Right-click a bar handle: open the seek/loop menu */
function onBarContextmenu(payload: {
  measureIndex: number;
  clientX: number;
  clientY: number;
}): void {
  barFlyout.value = {
    at: { x: payload.clientX, y: payload.clientY },
    measure: payload.measureIndex,
  };
}

/** The real-score address a hit's `staffIndex` corresponds to, through the display projection */
function realAddress(hit: StaffHit): ScoreAddress {
  return {
    measure: hit.measureIndex,
    staff: projection.value.staffMap[hit.staffIndex],
    voice: 0,
    element: hit.elementIndex,
  };
}

/** The pitch a hit's staff position implies — same derivation `place` uses, needed again to pick a tone out of a chord when erasing */
function pitchAt(hit: StaffHit): Pitch {
  const { clef } = ContextWalk.walk(projected.value)[hit.measureIndex][hit.staffIndex];

  return StaffPosition.pitch(clef, hit.position);
}

/** Erases whatever's at `hit`; if it's a chord, only the tone nearest `hit`'s pitch comes out */
function eraseAt(hit: StaffHit): void {
  store.erase(realAddress(hit), pitchAt(hit));
}

/**
 * Re-resolves a hit's address by onset rather than trusting `hit.elementIndex`
 * directly. A fresh click's hit is always accurate at the moment it's used
 * (`onActivate`/`onContextmenu` resolve it synchronously from the current
 * layout), but the hotkeys below reuse the last hover position — updated
 * only on pointermove — which can go stale the instant one hotkey's own
 * mutation reshapes the elements array (erase merges/re-decomposes
 * surrounding rests) without the mouse having moved for a second press to
 * pick up. Onset doesn't drift the way an index can, so re-resolving
 * through it (the same trick `store.resolveAddress` already applies for the
 * right-click flyout) keeps repeated hotkey presses acting on whatever's
 * actually there now. Like any onset lookup, this skips dynamics — a hotkey
 * acts on the sounding note/rest/chord at this onset, never a dynamic mark;
 * erasing a dynamic still works precisely via a click.
 */
function hoveredAddress(hit: StaffHit): ScoreAddress | undefined {
  const staff = projection.value.staffMap[hit.staffIndex];

  return store.resolveAddress({ measure: hit.measureIndex, staff, voice: 0 }, hit.onset);
}

/** The hotkey counterpart to `eraseAt`, re-resolving first since the hover it acts on may be stale */
function eraseHovered(hit: StaffHit): void {
  const address = hoveredAddress(hit);

  if (address) store.erase(address, pitchAt(hit));
}

function onHoverVertical(point: HoverPoint): void {
  if (props.interactive) hover.value = point;
}

/** The horizontal branch renders its own single `SystemView` directly (no `ScoreView` to resolve for it), so it resolves hits itself the same way `ScoreView` does internally */
function resolveHorizontal(point: { x: number; y: number }): StaffHit | undefined {
  if (!unbrokenSystem.value) return undefined;

  return InteractionGeometry.locate({
    system: unbrokenSystem.value,
    measures: projected.value.measures,
    ...point,
  });
}

function onHoverHorizontal(point: { x: number; y: number }): void {
  if (!props.interactive || !unbrokenSystem.value) return;

  const hit = resolveHorizontal(point);
  const y = hit
    ? (unbrokenSystem.value.staffYs[hit.staffIndex] ?? 0) + StaffPosition.y(hit.position)
    : point.y;

  hover.value = { systemIndex: 0, hit, x: point.x, y };
}

function onActivateHorizontal(point: { x: number; y: number }): void {
  const hit = resolveHorizontal(point);

  if (hit) onActivate({ hit });
}

function onContextmenuHorizontal(point: {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}): void {
  const hit = resolveHorizontal(point);

  if (hit) onContextmenu({ hit, clientX: point.clientX, clientY: point.clientY });
}

function onLeave(): void {
  hover.value = null;
}

function place(hit: StaffHit): void {
  const tool = store.state.activeTool;

  if (!tool) return;

  if (tool.kind === 'timeSignature') {
    store.placeTimeSignature(hit.measureIndex, tool.time);

    return;
  }

  const address = {
    measure: hit.measureIndex,
    staff: projection.value.staffMap[hit.staffIndex],
    voice: 0,
    onset: hit.onset,
  };

  if (tool.kind === 'rest') {
    store.place(address, { kind: 'rest', duration: tool.duration });

    return;
  }

  const pitch = pitchAt(hit);
  const notations = tool.articulations?.length
    ? { articulations: NonEmptyArray.of([...tool.articulations]) }
    : undefined;

  store.place(address, { kind: 'note', pitch, duration: tool.duration, notations });
}

/**
 * The tie tool's click: the first click on an untied note or chord tone
 * starts the tie, the second click on another note or chord closes it (or
 * fails and leaves the first one still pending, so a misclick isn't
 * costly). A chord click derives its tone the same way `eraseAt` does, via
 * `pitchAt`; ignored on the closing side, since the tie's pitch is already
 * fixed by whichever tone started it. Clicking a rest or dynamic is a no-op.
 */
function tieClickAt(hit: StaffHit): void {
  const elements =
    projected.value.measures[hit.measureIndex]?.contents[hit.staffIndex]?.voices[0]?.elements;
  const target = elements?.[hit.elementIndex];

  if (target?.kind !== 'note' && target?.kind !== 'chord') return;

  const address = realAddress(hit);

  if (!store.state.pendingTie) {
    store.startTie(address, target.kind === 'chord' ? pitchAt(hit) : undefined);
  } else {
    store.closeTie(address);
  }
}

function onActivate({ hit }: { hit: StaffHit }): void {
  if (!props.interactive) return;

  if (store.state.eraserMode === 'bar') {
    store.eraseBar(hit.measureIndex);

    return;
  }

  if (store.state.eraserMode === 'element') {
    if (hit.timeSignature) store.eraseTimeSignature(hit.measureIndex);
    else eraseAt(hit);

    return;
  }

  if (store.state.tieMode) {
    tieClickAt(hit);

    return;
  }

  place(hit);
}

function onContextmenu({
  hit,
  clientX,
  clientY,
}: {
  hit: StaffHit;
  clientX: number;
  clientY: number;
}): void {
  if (!props.interactive) return;

  const staffIndex = projection.value.staffMap[hit.staffIndex];
  const elements =
    projected.value.measures[hit.measureIndex]?.contents[hit.staffIndex]?.voices[0]?.elements;
  const target = elements?.[hit.elementIndex];

  if (target?.kind !== 'note' && target?.kind !== 'chord') return;

  flyout.value = {
    at: { x: clientX, y: clientY },
    location: { measure: hit.measureIndex, staff: staffIndex, voice: 0 },
    onset: hit.onset,
    pitch: target.kind === 'chord' ? pitchAt(hit) : null,
  };
}

const ghostGlyph = computed(() => {
  if (!props.interactive || !hover.value?.hit || store.state.eraserMode || store.state.tieMode) {
    return null;
  }

  const tool = store.state.activeTool;

  // A time signature is measure-wide, not a staff position — no notehead
  // ghost makes sense for it the way it does for a note/rest
  if (!tool || tool.kind === 'timeSignature') return null;

  return tool.kind === 'note'
    ? Glyphs.forNotehead(tool.duration.noteValue)
    : Glyphs.forRest(tool.duration.noteValue);
});

const showEraseHighlight = computed(
  () => props.interactive && !!hover.value?.hit && !!store.state.eraserMode,
);

const showTieHighlight = computed(
  () => props.interactive && !!hover.value?.hit && store.state.tieMode,
);

function undoRedo(event: KeyboardEvent): void {
  if (!event.ctrlKey && !event.metaKey) return;

  event.preventDefault();

  if (event.shiftKey) store.redo();
  else store.undo();
}

/** Hover-scoped editing hotkeys: act on whatever's currently hovered, or the active tool */
useHotkeys(
  {
    p(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();

      const address = hoveredAddress(hit);

      if (!address) return;

      const elements =
        store.state.score.measures[address.measure]?.contents[address.staff]?.voices[address.voice]
          ?.elements;
      const target = elements?.[address.element];

      if (target?.kind !== 'note' && target?.kind !== 'rest') return;

      store.selectTool({
        kind: target.kind,
        duration: target.duration,
        ...(target.kind === 'note' && target.articulations
          ? { articulations: target.articulations }
          : {}),
      });
    },
    '-'(event) {
      event.preventDefault();
      store.cycleActiveDuration('shorter');
    },
    '='(event) {
      event.preventDefault();
      store.cycleActiveDuration('longer');
    },
    Backspace(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();
      eraseHovered(hit);
    },
    Delete(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();
      eraseHovered(hit);
    },
    ArrowUp(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();

      const address = hoveredAddress(hit);

      if (address) store.transposeNote(address, 1);
    },
    ArrowDown(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();

      const address = hoveredAddress(hit);

      if (address) store.transposeNote(address, -1);
    },
    // `event.key` reflects Shift, so Ctrl+Shift+Z reports "Z", not "z" —
    // both map to the same handler rather than relying on one key casing
    z: undoRedo,
    Z: undoRedo,
    a(event) {
      event.preventDefault();
      store.addMeasure();
    },
    s(event) {
      event.preventDefault();
      store.removeLastMeasure();
    },
  },
  computed(() => props.interactive),
);
</script>

<template>
  <div class="score-display" :class="`score-display--${flow}`">
    <ScoreView
      v-if="flow === 'vertical'"
      :score="projected"
      :scale="scale"
      bar-handles
      :loop-start="store.state.playback.loopStartMeasure"
      :loop-end="store.state.playback.loopEndMeasure"
      @hover="onHoverVertical"
      @leave="onLeave"
      @activate="onActivate"
      @contextmenu="onContextmenu"
      @barclick="onBarClick"
      @barcontextmenu="onBarContextmenu"
    >
      <template #overlay="{ systemIndex }">
        <template v-if="hover && hover.systemIndex === systemIndex">
          <GlyphView
            v-if="ghostGlyph"
            :glyph="ghostGlyph"
            :x="hover.x"
            :y="hover.y"
            class="ghost"
          />
          <circle
            v-else-if="showEraseHighlight"
            :cx="hover.x"
            :cy="hover.y"
            r="1.2"
            class="hit-highlight"
          />
          <circle
            v-else-if="showTieHighlight"
            :cx="hover.x"
            :cy="hover.y"
            r="1.2"
            class="tie-highlight"
          />
        </template>
      </template>
    </ScoreView>
    <div v-else class="score-display__scroll">
      <SystemView
        v-if="unbrokenSystem"
        :system="unbrokenSystem"
        :scale="scale"
        bar-handles
        is-last-system
        :loop-start="store.state.playback.loopStartMeasure"
        :loop-end="store.state.playback.loopEndMeasure"
        @hover="onHoverHorizontal"
        @leave="onLeave"
        @activate="onActivateHorizontal"
        @contextmenu="onContextmenuHorizontal"
        @barclick="onBarClick"
        @barcontextmenu="onBarContextmenu"
      >
        <template #overlay>
          <template v-if="hover && hover.systemIndex === 0">
            <GlyphView
              v-if="ghostGlyph"
              :glyph="ghostGlyph"
              :x="hover.x"
              :y="hover.y"
              class="ghost"
            />
            <circle
              v-else-if="showEraseHighlight"
              :cx="hover.x"
              :cy="hover.y"
              r="1.2"
              class="hit-highlight"
            />
            <circle
              v-else-if="showTieHighlight"
              :cx="hover.x"
              :cy="hover.y"
              r="1.2"
              class="tie-highlight"
            />
          </template>
        </template>
      </SystemView>
    </div>

    <ElementEditorFlyout
      :open="!!flyout"
      :at="flyout?.at ?? null"
      :location="flyout?.location ?? null"
      :onset="flyout?.onset ?? null"
      :pitch="flyout?.pitch ?? null"
      @close="flyout = null"
    />

    <PlaybackBarFlyout
      :open="!!barFlyout"
      :at="barFlyout?.at ?? null"
      :measure="barFlyout?.measure ?? null"
      @close="barFlyout = null"
    />
  </div>
</template>

<style scoped>
.score-display {
  width: 100%;
  height: 100%;
}

.score-display__scroll {
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.ghost {
  opacity: 0.35;
  pointer-events: none;
}

.hit-highlight {
  fill: var(--color-danger);
  opacity: 0.3;
  pointer-events: none;
}

.tie-highlight {
  fill: var(--color-accent);
  opacity: 0.3;
  pointer-events: none;
}
</style>
