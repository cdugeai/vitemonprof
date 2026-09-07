import { normalizeText } from '$lib/utils';

/**
 * The registry's own nature codes for a maternelle.
 *
 * `101` is `ECOLE MATERNELLE` (12,269 schools) and `103` is
 * `ECOLE MATERNELLE D APPLICATION` (51). This is the authoritative
 * classification — `Code nature de l'UAI` — rather than anything inferred from
 * the school's name.
 */
export const MATERNELLE_NATURE_CODES: ReadonlySet<string> = new Set(['101', '103']);

/**
 * A name that *begins* by declaring itself a maternelle.
 *
 * Anchored at the start on purpose. A contains-match would also catch
 * « Ecole primaire privée Montessori - Little maternelle - Lyon confluence » and
 * « Ecole Tachbar maternelle et élémentaire privée » — a primaire and a school
 * that runs both cycles, each of which teaches the older children this app is
 * about. Both survive the anchored rule; verified against the registry.
 */
const MATERNELLE_NAME = /^(ecole\s+)?maternelle\b/;

/**
 * Whether a registry row is a maternelle, and so out of scope for this app.
 *
 * **Two rules, because neither is complete on its own.** Measured over the whole
 * 63,985-row file:
 *
 * - The nature code catches **12,320** schools and is the right backbone: it is
 *   the ministry's own classification, and **454** maternelles carry a name that
 *   never says so (« ECOLE DE LESCHEROUX », « Ecole élémentaire »), which a
 *   name-only filter would leave in the list.
 * - The name catches **91 more** whose nature code says otherwise — rows named
 *   « Ecole maternelle Léon Blum » but filed as `151 ECOLE DE NIVEAU
 *   ELEMENTAIRE`. Upstream data-entry slips, and a parent searching for their
 *   child's school would still find one and wonder why.
 *
 * Together: 12,411 of 63,985 excluded, leaving 51,574.
 */
export function isMaternelle(school: { natureCode: string; name: string }): boolean {
  return (
    MATERNELLE_NATURE_CODES.has(school.natureCode.trim()) ||
    MATERNELLE_NAME.test(normalizeText(school.name).trim())
  );
}
