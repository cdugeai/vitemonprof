/**
 * The focus dance a `<Select>` needs when its dropdown contains a search field.
 *
 * Extracted because getting it right took two non-obvious fixes, and a copy of
 * those in every searchable select is a copy that will drift the moment one of
 * them is touched. Both selectors in this form call it; a third would too.
 *
 * The two halves cover the two ways a dropdown opens:
 *
 * - **Keyboard** (Enter / Space / ArrowDown) is handled by `field`, an attachment
 *   that focuses the input as it mounts. It has to be an attachment rather than
 *   the `autofocus` attribute, because `Select.Content` unmounts on close — so
 *   this needs to re-run on *every* open, not once. `requestAnimationFrame` lets
 *   the popper finish positioning first; focusing sooner can scroll the page to
 *   where the content *was*, and `preventScroll` covers what's left.
 *
 * - **Mouse** is handled by `onTriggerFocus`. bits-ui parks focus on the trigger
 *   and re-focuses it from its own `onclick`, which fires *after* the content has
 *   mounted — so on a real click, where pointerdown and click straddle a frame,
 *   the attachment above loses the race. Rather than fight it with a longer timer,
 *   bounce focus into the search field whenever the trigger receives it while the
 *   dropdown is open.
 *
 * `isOpen` is passed as a getter, not a boolean: the caller's `open` is `$state`,
 * and a plain boolean would be read once at call time and then never update. The
 * getter keeps the read inside the reactive context that owns it.
 */
export function createSelectSearchFocus(isOpen: () => boolean) {
  // Not `$state`: only ever read from event handlers, never from a template.
  let searchInput: HTMLInputElement | null = null;

  return {
    field(node: HTMLInputElement) {
      searchInput = node;
      const frame = requestAnimationFrame(() => node.focus({ preventScroll: true }));

      return () => {
        cancelAnimationFrame(frame);
        searchInput = null;
      };
    },

    onTriggerFocus() {
      // The `isOpen` guard keeps this inert once closed, so the trigger holds
      // focus normally then.
      if (isOpen()) searchInput?.focus({ preventScroll: true });
    },
  };
}
