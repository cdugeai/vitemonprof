import { describe, expect, it } from 'vitest';
import type { MissedHour } from '$lib/types/missedHours';
import { insertMissedHour, listMissedHours, statsMissedHours } from './missedHourQueries';

const REPORT: MissedHour = {
  uuid: '00000000-0000-4000-8000-000000000001',
  schoolId: '0761322Z',
  class: '1ere',
  classGroup: 'C',
  discipline: 'maths',
  date_: '2026-08-17',
  nbHours: 2,
  createdAt: '2026-08-18T09:00:00.000Z',
};

describe('insertMissedHour', () => {
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
    const { parameters } = insertMissedHour({ ...REPORT, classGroup: null, discipline: null });

    expect(parameters.filter((p) => p === null)).toHaveLength(2);
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

  it('casts uuid and date to text so no driver wrapper reaches the domain', () => {
    const { sql } = listMissedHours('duckdb');

    expect(sql).toContain('"uuid"::text');
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
