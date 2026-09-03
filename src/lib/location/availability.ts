import type { BranchSchedule, ScheduleBlock, Weekday } from "@/data/branches";

export interface AvailabilitySnapshot {
  /** Whether the branch is currently open in its own timezone. */
  isOpen: boolean;
  /** Current local time at the branch, e.g. "14:05". */
  localTime: string;
  /** ISO timestamp of the next transition (closure if open, opening if closed), or null. */
  nextTransition: string | null;
  /** Labels for human consumption, e.g. "closes 23:00" / "opens 08:00". */
  label: string;
}

const WEEKDAY_ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MINUTES_PER_DAY = 24 * 60;

/**
 * Normalize a schedule value coming off the wire (Prisma JSON / seed / client
 * payload). Accepts the keyed `{ mon: [{ open, close }] }` shape. Malformed
 * entries are dropped so an empty schedule degrades to "always closed"
 * instead of throwing.
 */
export function parseSchedule(raw: unknown): BranchSchedule {
  if (!raw || typeof raw !== "object") return emptySchedule();
  const source = raw as Record<string, unknown>;
  const schedule = emptySchedule();
  for (const day of WEEKDAY_ORDER) {
    const blocks = source[day];
    schedule[day] = Array.isArray(blocks)
      ? blocks.filter(isScheduleBlock)
      : [];
  }
  return schedule;
}

function emptySchedule(): BranchSchedule {
  const s = {} as BranchSchedule;
  for (const day of WEEKDAY_ORDER) s[day] = [];
  return s;
}

function isScheduleBlock(v: unknown): v is ScheduleBlock {
  if (!v || typeof v !== "object") return false;
  const b = v as ScheduleBlock;
  return (
    Number.isFinite(b.open) &&
    Number.isFinite(b.close) &&
    b.open >= 0 &&
    b.open <= MINUTES_PER_DAY &&
    b.close > b.open &&
    b.close <= MINUTES_PER_DAY + 60
  );
}

interface LocalTime {
  weekday: Weekday;
  minutes: number;
}

function toWeekday(short: string): Weekday {
  return (short.toLowerCase().slice(0, 3) as Weekday) || "sun";
}

/** Local wall-clock time + weekday at a branch (via IANA timezone). Pure, deterministic. */
export function branchLocalTime(date: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) || 0;
  const minute = Number(get("minute")) || 0;

  return {
    weekday: toWeekday(get("weekday")),
    minutes: hour * 60 + minute,
  };
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dayContainsMinutes(blocks: ScheduleBlock[], minutes: number): boolean {
  return blocks.some((b) => minutes >= b.open && minutes < b.close);
}

export interface NextTransition {
  at: Date | null;
  /** True when the transition is a closure (currently open). */
  closesAt: boolean;
  /** Human label like "opens 11:00" or "closes 23:00". */
  label: string;
}

/**
 * Scan the schedule forward from `date` (branch-local) to find the next
 * open→close or close→open transition. Handles overnight splits (Friday night
 * spillover into a `sat [{ open: 0, close: 60 }]` block) by scanning the same
 * calendar day until midnight, then continuing onto the following day.
 */
export function nextTransition(
  schedule: BranchSchedule,
  timeZone: string,
  date: Date,
  currentlyOpen: boolean
): NextTransition {
  let cursor = new Date(date);
  // Look far enough ahead to cover a full week (guard against a degenerate schedule).
  for (let i = 0; i < 8; i++) {
    const { weekday, minutes } = branchLocalTime(cursor, timeZone);
    const blocks = schedule[weekday] ?? [];
    // For the current day, only consider times strictly after `now`.
    const startMinute = i === 0 ? minutes + 1 : 0;

    for (const block of blocks) {
      for (const boundary of [block.open, block.close]) {
        if (boundary < startMinute) continue;

        const at = transitionInstant(cursor, timeZone, weekday, boundary);

        // Skip boundaries that already passed (or a same-day open that equals now)
        if (!at || at.getTime() <= date.getTime()) continue;

        const closesAt = boundary === block.close;
        return {
          at,
          closesAt,
          label: closesAt ? `closes ${formatClock(block.close)}` : `opens ${formatClock(block.open)}`,
        };
      }
    }

    cursor = new Date(cursor.getTime() + MINUTES_PER_DAY * 60_000);
  }

  return { at: null, closesAt: false, label: currentlyOpen ? "closes soon" : "opens soon" };
}

/**
 * Resolve a wall-clock (day + minutes-since-midnight, in the branch timezone)
 * into an absolute UTC instant. Uses Intl timezone offset math (cheap, no DST
 * libraries). Returns null if the instant cannot be reliably computed.
 */
function transitionInstant(
  baseDate: Date,
  timeZone: string,
  weekday: Weekday,
  minutes: number
): Date | null {
  // Walk forward from the scanned day to a real calendar date matching `weekday`.
  let dayCursor = new Date(baseDate);
  let guard = 0;
  while (branchLocalTime(dayCursor, timeZone).weekday !== weekday && guard < 8) {
    dayCursor = new Date(dayCursor.getTime() + MINUTES_PER_DAY * 60_000);
    guard++;
  }

  // Approximate: take the branch's wall clock, strip the tz, assume UTC, then
  // correct by the tz offset at that instant (iterated once for DST edges).
  const zoneParts = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value) || 0;
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
  };
  const resolveOffset = (utcMillis: number) => {
    const d = new Date(utcMillis);
    const p = zoneParts(d);
    const approx = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0);
    return approx - utcMillis;
  };

  const localOnMaybeSameDay = branchLocalTime(dayCursor, timeZone);
  // Target wall clock: fixed (weekday, minutes). dayCursor now has that weekday.
  const day = zoneParts(dayCursor);
  if (localOnMaybeSameDay.weekday !== weekday) return null;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const guess = Date.UTC(day.year, day.month - 1, day.day, hours, mins, 0);
  const corrected = guess - resolveOffset(guess);
  // One refinement pass to handle DST boundary shifts.
  const final = corrected - resolveOffset(corrected);
  const result = new Date(final);
  // Ensure the resolved instant really lands on the requested wall clock.
  const check = branchLocalTime(result, timeZone);
  if (check.weekday !== weekday || check.minutes !== minutes) return null;
  return result;
}

/** Full availability snapshot for a branch at a given instant. */
export function getBranchStatus(
  schedule: BranchSchedule,
  timeZone: string,
  at: Date = new Date()
): AvailabilitySnapshot {
  const normalized = parseSchedule(schedule);
  const { weekday, minutes } = branchLocalTime(at, timeZone);
  const isOpen = dayContainsMinutes(normalized[weekday], minutes);

  const transition = nextTransition(normalized, timeZone, at, isOpen);
  return {
    isOpen,
    localTime: formatClock(minutes),
    nextTransition: transition.at ? transition.at.toISOString() : null,
    label: transition.label,
  };
}