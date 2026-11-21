import assert from 'node:assert/strict';
import {
	dueStatus,
	normalizeDueDate,
	normalizePriority,
	normalizeStatus,
	normalizeTags,
	orderBetween,
	orderFits,
	toDateInput,
} from '../../src/lib/kanban.ts';
import { isProjectStatus, normalizeHttpUrl, normalizeTechnologies, shortRepo } from '../../src/lib/projects.ts';
import { check } from './runner.mjs';

export function runTasksAndProjectsChecks() {
	check('task states: canonical values, and junk', () => {
		assert.equal(normalizeStatus('review'), 'review');
		assert.equal(normalizeStatus(' Done '), 'done');
		assert.equal(normalizeStatus('review'), 'review');
		assert.equal(normalizeStatus('archived'), null);
		assert.equal(normalizeStatus(3), null);
		assert.equal(normalizePriority('CRITICAL'), 'critical');
		assert.equal(normalizePriority('urgent'), null);
	});

	check('labels are folded, hyphenated, de-duplicated and capped', () => {
		assert.deepEqual(normalizeTags(['  Front End ', '#UX', 'ux', '', '\u0130HA']), ['front-end', 'ux', 'iha']);
		assert.deepEqual(normalizeTags([]), []);
		assert.equal(normalizeTags('ux'), null);
		assert.equal(normalizeTags(['ok', 5]), null);
		assert.equal(normalizeTags(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).length, 6);
		assert.equal(normalizeTags(['x'.repeat(50)])[0].length, 24);
	});

	check('due dates: numbers, ISO days (end of that local day), clearing, junk', () => {
		assert.equal(normalizeDueDate(null), null);
		assert.equal(normalizeDueDate(''), null);
		assert.equal(normalizeDueDate(1_800_000_000_000), 1_800_000_000_000);
		assert.equal(normalizeDueDate(-5), undefined);
		assert.equal(normalizeDueDate(Number.NaN), undefined);
		assert.equal(normalizeDueDate('yar\u0131n'), undefined);
		assert.equal(normalizeDueDate({}), undefined);
		const d = new Date(normalizeDueDate('2026-10-12'));
		assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 9, 12, 23, 59]);
		assert.equal(toDateInput(normalizeDueDate('2026-01-05')), '2026-01-05');
		assert.equal(toDateInput(null), '');
	});

	check('drop position: between, above the first, below the last, empty column', () => {
		assert.equal(orderBetween(10, 20, 0), 15);
		assert.equal(orderBetween(undefined, 20, 0), 20 - 1024);
		assert.equal(orderBetween(10, undefined, 0), 10 + 1024);
		assert.equal(orderBetween(undefined, undefined, -42), -42);
		// Repeated drops into the same gap eventually exhaust float precision at the
		// magnitude real keys have (-epoch ms); orderFits must notice before order breaks.
		let lo = -1_791_000_000_000, hi = lo + 1, steps = 0;
		for (;;) {
			const mid = orderBetween(lo, hi, 0);
			if (!orderFits(lo, mid, hi)) break;
			hi = mid;
			steps += 1;
			assert.ok(steps < 200, 'gap never ran out');
		}
		assert.ok(steps > 5, `only ${steps} drops fit`);
		assert.equal(orderFits(undefined, 5, undefined), true);
		assert.equal(orderFits(5, 5, 9), false);
	});

	check('due state relative to now; done tasks are never late', () => {
		const now = new Date(2026, 9, 5, 12, 0).getTime();
		const at = (d, h = 12) => new Date(2026, 9, d, h, 0).getTime();
		assert.equal(dueStatus(at(4), 'in_progress', now), 'overdue');
		assert.equal(dueStatus(at(4), 'done', now), null);
		assert.equal(dueStatus(at(5, 18), 'todo', now), 'today');
		assert.equal(dueStatus(at(6), 'todo', now), 'upcoming');
		assert.equal(dueStatus(at(7), 'todo', now), 'upcoming');
		assert.equal(dueStatus(at(9), 'todo', now), 'next');
		assert.equal(dueStatus(null, 'todo', now), null);
	});

	check('project links: only http(s) with a real host reach an href', () => {
		assert.equal(normalizeHttpUrl('https://github.com/x/y'), 'https://github.com/x/y');
		assert.equal(normalizeHttpUrl('  http://a.b  '), 'http://a.b/');
		assert.equal(normalizeHttpUrl(''), null);
		assert.equal(normalizeHttpUrl(null), null);
		assert.equal(normalizeHttpUrl('javascript:alert(1)'), undefined);
		assert.equal(normalizeHttpUrl('ftp://a.b/c'), undefined);
		assert.equal(normalizeHttpUrl('https://localhost/x'), undefined);
		assert.equal(normalizeHttpUrl('github.com/x'), undefined);
		assert.equal(normalizeHttpUrl(42), undefined);
	});

	check('technologies: comma list or array, casing kept, duplicates folded, capped', () => {
		assert.deepEqual(normalizeTechnologies('Next.js, PostgreSQL , next.js,,'), ['Next.js', 'PostgreSQL']);
		assert.deepEqual(normalizeTechnologies(['ROS2', 'ros2', '  C++ ']), ['ROS2', 'C++']);
		assert.deepEqual(normalizeTechnologies(''), []);
		assert.equal(normalizeTechnologies(5), null);
		assert.equal(normalizeTechnologies(['ok', {}]), null);
		assert.equal(normalizeTechnologies(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 12);
	});

	check('project status and repo display', () => {
		assert.ok(isProjectStatus('proposed') && isProjectStatus('archived'));
		assert.ok(!isProjectStatus('deleted') && !isProjectStatus(undefined));
		assert.equal(shortRepo('https://www.github.com/beuteknoloji/portal/'), 'github.com/beuteknoloji/portal');
		assert.equal(shortRepo(null), '');
	});
}
