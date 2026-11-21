import assert from 'node:assert/strict';
import {
	ATTENDANCE_TOLERANCE_MS,
	ATTENDANCE_WINDOW_MS,
	attendanceCodeText,
	attendanceWindow,
	csvCell,
	isAttendanceTime,
	isEventType,
	normalizeEventStatus,
	normalizeEventType,
	parseAttendanceCode,
	parseTicketCode,
	ticketCodeText,
	toCsv,
	windowRemainingMs,
} from '../../src/lib/events.ts';
import {
	APPLICATION_NOTE_MAX,
	EXPERTISE_MAX,
	buildApplicationNote,
	capacityProblem,
	isCategory,
	isParticipationType,
	isTeamStatus,
	normalizeRole,
} from '../../src/lib/teams.ts';
import { myOpenTasks, nextEvent } from '../../src/lib/mobileCockpit.ts';
import { DEFAULT_TEAM_CATEGORIES, normalizeTeamCategories } from '../../src/lib/teamCategories.ts';
import { check } from './runner.mjs';

export function runEventsAndTeamsChecks() {
	check('attendance codes round-trip and reject look-alikes', () => {
		const k = { eventId: 'evt_04', window: 59708013, signature: 'IANoK_gYemiyKv0ytCbbfC' };
		const text = attendanceCodeText(k);
		assert.deepEqual(parseAttendanceCode(text), k);
		// The link a phone camera opens carries the same token.
		assert.deepEqual(parseAttendanceCode(`https://portal.example.org/checkin/${encodeURIComponent(text)}`), k);
		assert.equal(parseAttendanceCode('evt_04'), null);
		assert.equal(parseAttendanceCode('BY1.evt_04.x.IANoK_gYemiyKv0ytCbbfC'), null);
		assert.equal(parseAttendanceCode('BY1.evt 04.1.IANoK_gYemiyKv0ytCbbfC'), null);
		assert.equal(parseAttendanceCode('BY1.evt_04.1.short'), null);
		assert.equal(parseAttendanceCode(null), null);
		const b = { eventId: 'evt_01', userId: 'usr_mem_04', signature: 'abcdefghijklmnopqrstuv' };
		assert.deepEqual(parseTicketCode(ticketCodeText(b)), b);
		// A ticket is not a projector code and vice versa.
		assert.equal(parseAttendanceCode(ticketCodeText(b)), null);
		assert.equal(parseTicketCode(text), null);
	});

	check('check-in windows and timing', () => {
		const t0 = 1_790_000_000_000;
		assert.equal(attendanceWindow(t0), Math.floor(t0 / ATTENDANCE_WINDOW_MS));
		assert.ok(windowRemainingMs(t0) > 0 && windowRemainingMs(t0) <= ATTENDANCE_WINDOW_MS);
		const start = t0;
		const end = t0 + 3_600_000;
		assert.equal(isAttendanceTime(start, end, start - ATTENDANCE_TOLERANCE_MS), true);
		assert.equal(isAttendanceTime(start, end, start - ATTENDANCE_TOLERANCE_MS - 1), false);
		assert.equal(isAttendanceTime(start, end, end + ATTENDANCE_TOLERANCE_MS), true);
		assert.equal(isAttendanceTime(start, end, end + ATTENDANCE_TOLERANCE_MS + 1), false);
	});

	check('CSV: quoting, separators and spreadsheet formula injection', () => {
		assert.equal(csvCell('Ege K\u0131l\u0131\u00e7'), 'Ege K\u0131l\u0131\u00e7');
		assert.equal(csvCell('a;b'), '"a;b"');
		assert.equal(csvCell('say "hi"'), '"say ""hi"""');
		assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
		assert.equal(csvCell('+90 555'), "'+90 555");
		assert.equal(csvCell('@cmd'), "'@cmd");
		assert.equal(csvCell(null), '');
		assert.equal(toCsv(['a', 'b'], [[1, 'x\ny']]), 'a;b\r\n1;"x\ny"');
	});

	check('event vocabulary: types, aliases and statuses', () => {
		assert.equal(normalizeEventType('workshop'), 'workshop');
		assert.equal(normalizeEventType('seminar'), 'seminar');
		assert.equal(normalizeEventType('hackathon'), 'competition');
		assert.equal(normalizeEventType('meeting'), 'meeting');
		assert.equal(normalizeEventType('invalid'), null);
		assert.equal(isEventType('workshop'), true);
		assert.equal(isEventType('invalid'), false);
		assert.equal(normalizeEventStatus('draft'), 'draft');
		assert.equal(normalizeEventStatus('published'), 'published');
		assert.equal(normalizeEventStatus('completed'), 'done');
		assert.equal(normalizeEventStatus('cancelled'), 'cancelled');
		assert.equal(normalizeEventStatus('published'), 'published');
		assert.equal(normalizeEventStatus('bad_status'), null);
	});

	check('team rules: categories, modes, roles and quota', () => {
		assert.ok(isCategory('Web & Mobile') && !isCategory('Space'));
		assert.ok(isParticipationType('approval') && !isParticipationType('closed'));
		assert.ok(isTeamStatus('suspended') && !isTeamStatus('deleted'));
		assert.equal(normalizeRole('  Binary   Exploitation  '), 'Binary Exploitation');
		assert.equal(normalizeRole('   '), null);
		assert.equal(normalizeRole(5), null);
		assert.equal(normalizeRole('x'.repeat(80)).length, 40);
		assert.equal(capacityProblem(6, 3), null);
		assert.equal(capacityProblem(3, 3), null);
		assert.match(capacityProblem(2, 3), /3 active members/);
		assert.match(capacityProblem(0, 0), /between/);
		assert.match(capacityProblem(31, 0), /between/);
		assert.match(capacityProblem(2.5, 0), /between/);
		assert.match(capacityProblem('abc', 0), /between/);
	});

	check('onboarding application note: skills line, free text, caps', () => {
		assert.equal(buildApplicationNote([], ''), null);
		assert.equal(buildApplicationNote(undefined, undefined), null);
		assert.equal(buildApplicationNote(['C++', 'ROS2'], ''), 'Expertise: C++, ROS2');
		assert.equal(buildApplicationNote([], '  Hello  '), 'Hello');
		assert.equal(buildApplicationNote(['PCB'], 'UAV team interest'), 'Expertise: PCB\nUAV team interest');
		// trimmed, de-duplicated case-insensitively (the Turkish way), non-strings dropped
		assert.equal(buildApplicationNote([' c++ ', 'C++', 5, null, '', '\u0131', 'I'], ''), 'Expertise: c++, \u0131');
		assert.equal(buildApplicationNote('C++', ''), null); // not an array
		assert.equal(buildApplicationNote(Array.from({ length: 20 }, (_, i) => `s${i}`), '').split(', ').length, EXPERTISE_MAX);
		assert.equal(buildApplicationNote([], 'x'.repeat(900)).length, APPLICATION_NOTE_MAX);
		assert.ok(buildApplicationNote(['y'.repeat(90)], '').length <= 'Expertise: '.length + 30);
	});

	check('phone cockpit: my open tasks and the next event', () => {
		const task = (id, assignee, status, due) => ({ id, teamId: 't', title: id, status, assigneeMemberId: assignee, dueDate: due });
		const teams = [
			{ name: 'Rocket', tasks: [task('a', 'u1', 'todo', null), task('b', 'u2', 'todo', 1), task('c', 'u1', 'done', 5)] },
			{ name: 'UAV', tasks: [task('d', 'u1', 'in_progress', 200), task('e', 'u1', 'review', 100), task('f', 'u1', 'todo', null)] },
		];
		const mine = myOpenTasks(teams, 'u1');
		assert.deepEqual(mine.map((x) => x.id), ['e', 'd', 'a', 'f']); // deadline first, undated keep board order
		assert.equal(mine[0].teamName, 'UAV');
		assert.deepEqual(myOpenTasks(teams, 'nobody'), []);
		assert.deepEqual(myOpenTasks([], 'u1'), []);

		const ev = (id, status, start, endTime) => ({ id, status, start, endTime });
		const now = 1000;
		assert.equal(nextEvent([], now), null);
		assert.equal(nextEvent([ev('past', 'published', 1, 500)], now), null);
		assert.equal(nextEvent([ev('draft', 'draft', 1100, 1200)], now), null);
		assert.equal(nextEvent([ev('later', 'published', 3000, 4000), ev('soon', 'published', 1500, 2000)], now).id, 'soon');
		assert.equal(nextEvent([ev('soon', 'published', 1500, 2000), ev('live', 'published', 900, 1100)], now).id, 'live');
		assert.equal(nextEvent([ev('live2', 'published', 900, 1900), ev('live1', 'published', 800, 1100)], now).id, 'live1'); // ends first
		assert.equal(nextEvent([ev('edge', 'published', 1, 1000)], now).id, 'edge'); // ends exactly now: still on
	});

	check('team categories: trimmed, de-duplicated and never empty', () => {
		assert.deepEqual(DEFAULT_TEAM_CATEGORIES.slice(0, 2), ['Aviation & UAV', 'Artificial Intelligence']);
		assert.deepEqual(
			normalizeTeamCategories(['  Web  ', 'web', 'Custom Research', '', '<bad>']),
			['Web', 'Custom Research']
		);
		assert.ok(normalizeTeamCategories([]).length > 0);
		assert.ok(normalizeTeamCategories(null).length > 0);
	});
}
