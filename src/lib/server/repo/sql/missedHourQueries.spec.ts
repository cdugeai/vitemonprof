import { describe, expect, it } from 'vitest';
import type { NewMissedHour } from '$lib/types/missedHours';
import {
  insertMissedHour,
  listMissedHours,
  statsMissedHours,
  topMissedHours,
} from './missedHourQueries';

const REPORT: NewMissedHour = {
  schoolId: '0761322Z',
  class: '1ere',
  classGroup: 'C',
  discipline: 'maths',
  date_: '2026-08-17',
  nbHours: 2,
  createdAt: '2026-08-18T09:00:00.000Z',
  departement: '76',
};

describe('insertMissedHour', () => {
  it('leaves the id to the sequence', () => {
    const { sql } = insertMissedHour(REPORT);

    // The column list, not the whole statement: `insert into "missed_hour"` is
    // not a match, but a stray `"id"` among the columns would be. Naming it here
    // would take the value from the caller and leave `missed_hour_id_seq`
    // trailing behind the table.
    const [, columns = ''] = /\(([^)]*)\)\s*values/i.exec(sql) ?? [];

    expect(columns).not.toContain('"id"');
    expect(columns).toContain('"school_id"');
  });

  it('binds every value instead of interpolating it', () => {
    const { sql, parameters } = insertMissedHour(REPORT);

    // The point of the assertion: no user-supplied value may appear in the SQL
    // text. If a future edit switches to string concatenation, this fails.
    expect(sql).not.toContain('0761322Z');
    expect(parameters).toContain('0761322Z');

    // Every value is bound, and the placeholders are a complete `$1..$n` run
    // matching the parameter list.
    //
    // Derived from `parameters` rather than hardcoded as `$1..$8`. The property
    // under test is "each value travels as a binding", which has nothing to say
    // about how many columns the table has — so adding one should not break this
    // test. It used to, which meant the assertion was really checking the column
    // count under a misleading name.
    const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));

    expect(placeholders).toEqual(parameters.map((_, index) => index + 1));
  });

  it('passes null through for the optional columns', () => {
    const { parameters } = insertMissedHour({
      ...REPORT,
      classGroup: null,
      discipline: null,
      departement: null,
    });

    expect(parameters.filter((p) => p === null)).toHaveLength(3);
  });
});

describe('listMissedHours', () => {
  it('differs between the two dialects only in the created_at expression', () => {
    // This is the architectural claim the whole shared-SQL layer rests on: one
    // query, one engine-specific expression. If a second difference ever creeps
    // in, this test is what notices.
    const duckdb = listMissedHours('duckdb').sql;
    const postgres = listMissedHours('postgres').sql;

    expect(duckdb).toContain('epoch_ms("created_at")');
    expect(postgres).toContain('extract(epoch from "created_at")');

    const normalise = (s: string) =>
      s
        .replace('epoch_ms("created_at")', 'CREATED_AT_MS')
        .replace('(extract(epoch from "created_at") * 1000)::bigint', 'CREATED_AT_MS');

    expect(normalise(duckdb)).toBe(normalise(postgres));
  });

  it('casts date to text so no driver wrapper reaches the domain', () => {
    const { sql } = listMissedHours('duckdb');

    expect(sql).toContain('"date"::text');
  });

  it('orders newest first, which the recent-reports list depends on', () => {
    expect(listMissedHours('postgres').sql).toContain('order by "created_at" desc');
  });
});

describe('statsMissedHours', () => {
  it('scopes the rolling window with a FILTER clause and a bound parameter', () => {
    const { sql, parameters } = statsMissedHours(7);

    expect(sql).toContain('filter(where "created_at" >=');
    // Bound, not baked into the string — the reason this survives a change of
    // window length without touching the SQL.
    expect(parameters).toEqual([7]);
  });

  it('coalesces the sums, because sum() is NULL over an empty table', () => {
    expect(statsMissedHours().sql).toMatch(/coalesce\(sum\("nb_hours"\), 0\)/);
  });

  it('counts distinct schools and classes rather than rows', () => {
    const { sql } = statsMissedHours();

    expect(sql).toContain('count(distinct "school_id")');
    expect(sql).toContain('count(distinct "class")');
  });

  it('quotes `class`, which is a reserved word in plenty of engines', () => {
    expect(statsMissedHours().sql).not.toMatch(/distinct class\b/);
  });
});

describe('topMissedHours', () => {
  const query = (overrides = {}) =>
    topMissedHours({ departement: '75', dimension: 'school', limit: 5, ...overrides });

  it('groups by school for the school dimension and by discipline for the other', () => {
    expect(query({ dimension: 'school' }).sql).toContain('group by "school_id"');
    expect(query({ dimension: 'discipline' }).sql).toContain('group by "discipline"');
  });

  it('ranks by total hours, not by number of reports', () => {
    // The distinction matters: hours is the quantity the site measures, and the
    // one that is harder to inflate by filing many small reports.
    expect(query().sql).toContain('order by sum("nb_hours") desc');
  });

  it('breaks ties on the key so two reloads agree', () => {
    // Without this the engine returns equal groups in whatever order its hash
    // aggregate produced, which is not stable even between runs of one query.
    expect(query().sql).toMatch(/order by sum\("nb_hours"\) desc, "school_id" asc/);
  });

  it('drops rows with no value for the grouped column', () => {
    // Reports that named no discipline would otherwise rank first under a label
    // that names no subject.
    expect(query({ dimension: 'discipline' }).sql).toContain('"discipline" is not null');
  });

  it('binds the département rather than splicing it into the SQL', () => {
    const { sql, parameters } = query({ departement: '2A' });

    expect(sql).not.toContain('2A');
    expect(parameters).toContain('2A');
  });

  it('omits the filter entirely for a national ranking', () => {
    // Not `departement is null`, which would match only the rows written before
    // migration 006 and never backfilled.
    const { sql } = query({ departement: null });

    expect(sql).not.toContain('"departement"');
  });

  it('binds the limit too, and applies it in SQL', () => {
    const { sql, parameters } = query({ limit: 5 });

    expect(sql).toContain('limit');
    expect(parameters).toContain(5);
  });
});
