import type { InjectionKey, Ref } from 'vue';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';

/**
 * A reactive set of the element addresses sounding right now, keyed by
 * `addressKey`, provided by the interactive score display and injected by the
 * note/chord views so a playing element can tint itself. Addresses here are in
 * *display* coordinates (the projected score the renderer lays out), so the
 * provider converts from the real score's staff indices first. An absent
 * provider (read-only renders, Storybook) leaves an empty set.
 */
export const playingAddressesKey: InjectionKey<Ref<ReadonlySet<string>>> =
  Symbol('playingAddresses');

/** A stable string key for an address, for set membership. */
export const addressKey = (address: ScoreAddress): string =>
  `${address.measure}:${address.staff}:${address.voice}:${address.element}`;
