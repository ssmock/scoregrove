<script setup lang="ts">
import { computed, ref } from 'vue';
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
import ScoreView, { type HoverPoint } from '../music/ScoreView.vue';
import SystemView from '../music/SystemView.vue';
import { canvasTextMeasurer } from '../music/textMeasure';
import { useEditorStore } from '../store/useEditorStore';
import { useHotkeys } from '../ui/composables/useHotkeys';
import ElementEditorFlyout from './ElementEditorFlyout.vue';

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

const unbrokenSystem = computed(() =>
  props.flow === 'horizontal' ? SystemLayout.unbroken(projected.value, { measureText }) : null,
);

const hover = ref<HoverPoint | null>(null);
const flyout = ref<{
  at: { x: number; y: number };
  location: { measure: number; staff: number; voice: number };
  onset: Fraction;
} | null>(null);

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

function onActivate({ hit }: { hit: StaffHit }): void {
  if (!props.interactive) return;

  if (store.state.eraserMode === 'bar') {
    store.eraseBar(hit.measureIndex);

    return;
  }

  if (store.state.eraserMode === 'element') {
    eraseAt(hit);

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

  if (elements?.[hit.elementIndex]?.kind !== 'note') return;

  flyout.value = {
    at: { x: clientX, y: clientY },
    location: { measure: hit.measureIndex, staff: staffIndex, voice: 0 },
    onset: hit.onset,
  };
}

const ghostGlyph = computed(() => {
  if (!props.interactive || !hover.value?.hit || store.state.eraserMode) return null;

  const tool = store.state.activeTool;

  if (!tool) return null;

  return tool.kind === 'note'
    ? Glyphs.forNotehead(tool.duration.noteValue)
    : Glyphs.forRest(tool.duration.noteValue);
});

const showEraseHighlight = computed(
  () => props.interactive && !!hover.value?.hit && !!store.state.eraserMode,
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

      const elements =
        projected.value.measures[hit.measureIndex]?.contents[hit.staffIndex]?.voices[0]?.elements;
      const target = elements?.[hit.elementIndex];

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
      eraseAt(hit);
    },
    Delete(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();
      eraseAt(hit);
    },
    ArrowUp(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();
      store.transposeNote(realAddress(hit), 1);
    },
    ArrowDown(event) {
      const hit = hover.value?.hit;

      if (!hit) return;

      event.preventDefault();
      store.transposeNote(realAddress(hit), -1);
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
      @hover="onHoverVertical"
      @leave="onLeave"
      @activate="onActivate"
      @contextmenu="onContextmenu"
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
        </template>
      </template>
    </ScoreView>
    <div v-else class="score-display__scroll">
      <SystemView
        v-if="unbrokenSystem"
        :system="unbrokenSystem"
        :scale="scale"
        @hover="onHoverHorizontal"
        @leave="onLeave"
        @activate="onActivateHorizontal"
        @contextmenu="onContextmenuHorizontal"
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
          </template>
        </template>
      </SystemView>
    </div>

    <ElementEditorFlyout
      :open="!!flyout"
      :at="flyout?.at ?? null"
      :location="flyout?.location ?? null"
      :onset="flyout?.onset ?? null"
      @close="flyout = null"
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
</style>
