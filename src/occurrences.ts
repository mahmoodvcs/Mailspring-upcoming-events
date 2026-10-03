import IcalExpander from 'ical-expander';
import {
  Rx,
  Event,
  Matcher,
  Contact,
  DatabaseStore,
  CalendarUtils,
  CalendarDate,
  CalendarDateUtils,
  ICSEventHelpers,
} from 'mailspring-exports';

interface OccurrenceBase {
  id: string;
  calendarId: string;
  title: string;
  location: string;
  /** The days covered, inclusive both ends. */
  startDate: CalendarDate;
  endDate: CalendarDate;
  isCancelled: boolean;
  /** Tentative, or an invitation I haven't answered. */
  isPending: boolean;
}

export interface AllDayOccurrence extends OccurrenceBase {
  isAllDay: true;
}

export interface TimedOccurrence extends OccurrenceBase {
  isAllDay: false;
  start: number;
  end: number;
}

export type EventOccurrence = AllDayOccurrence | TimedOccurrence;

export function isTimed(e: EventOccurrence): e is TimedOccurrence {
  return e.isAllDay === false;
}

export function occurrenceStartUnix(e: EventOccurrence): number {
  return isTimed(e) ? e.start : CalendarDateUtils.dayStartUnix(e.startDate);
}

/** Exclusive: the midnight after an all-day occurrence's last day. */
export function occurrenceEndUnix(e: EventOccurrence): number {
  return isTimed(e) ? e.end : CalendarDateUtils.nextDayStartUnix(e.endDate);
}

/**
 * A live list of the occurrences overlapping [startUnix, endUnix], with recurring series
 * expanded. Mirrors the query the calendar window runs so both show the same events.
 */
export function observeOccurrences({
  startUnix,
  endUnix,
  disabledCalendars,
}: {
  startUnix: number;
  endUnix: number;
  disabledCalendars: string[];
}) {
  const start = Event.attributes.recurrenceStart;
  const end = Event.attributes.recurrenceEnd;

  let matcher = new Matcher.Or([
    new Matcher.And([start.lte(endUnix), end.gte(startUnix)]),
    new Matcher.And([start.lte(endUnix), start.gte(startUnix)]),
    new Matcher.And([end.gte(startUnix), end.lte(endUnix)]),
    new Matcher.And([end.gte(endUnix), start.lte(startUnix)]),
  ]);
  if (disabledCalendars.length) {
    matcher = new Matcher.And([matcher, Event.attributes.calendarId.notIn(disabledCalendars)]);
  }

  return Rx.Observable.fromQuery(DatabaseStore.findAll<Event>(Event).where(matcher)).map(
    (events: Event[]) => occurrencesForEvents(events, startUnix, endUnix)
  );
}

function dateFromICALTime(time: any): CalendarDate {
  return CalendarDateUtils.calendarDateFromParts(time.year, time.month, time.day);
}

function occurrenceFromICS(id: string, event: Event, item: any, startTime: any, endTime: any) {
  const startUnix = startTime.toJSDate().getTime() / 1000;
  const endUnix = endTime.toJSDate().getTime() / 1000;

  const statusValue = item.component?.getFirstPropertyValue('status');
  const status = (typeof statusValue === 'string' ? statusValue : '').toUpperCase();

  const me = (item.attendees as any[])
    .map((a) => ({
      email: String(a.getFirstValue() || '').replace(/^mailto:/i, ''),
      partstat: String(a.getFirstParameter('partstat') || 'NEEDS-ACTION').toUpperCase(),
    }))
    .find((a) => a.email && new Contact({ email: a.email }).isMe());
  const isAwaitingMyResponse = !!me && me.partstat !== 'ACCEPTED' && me.partstat !== 'DECLINED';

  const isAllDay = !!startTime.isDate;
  const startDate = isAllDay
    ? dateFromICALTime(startTime)
    : CalendarDateUtils.calendarDateFromUnix(startUnix);
  const endDate = isAllDay
    ? (Math.max(
        CalendarDateUtils.addCalendarDays(dateFromICALTime(endTime), -1),
        startDate
      ) as CalendarDate)
    : // the end instant is exclusive, so step inside it before reading the date
      CalendarDateUtils.calendarDateFromUnix(Math.max(endUnix - 1, startUnix));

  const base: OccurrenceBase = {
    id,
    calendarId: event.calendarId,
    title: item.summary || '',
    location: item.location || '',
    startDate,
    endDate,
    isCancelled: status === 'CANCELLED',
    isPending: status === 'TENTATIVE' || isAwaitingMyResponse,
  };
  return isAllDay
    ? ({ ...base, isAllDay: true } as AllDayOccurrence)
    : ({ ...base, isAllDay: false, start: startUnix, end: endUnix } as TimedOccurrence);
}

function occurrencesForEvents(results: Event[], startUnix: number, endUnix: number) {
  const occurrences: EventOccurrence[] = [];

  const eventsByUid = new Map<string, Event[]>();
  for (const event of results) {
    if (!eventsByUid.has(event.icsuid)) {
      eventsByUid.set(event.icsuid, []);
    }
    eventsByUid.get(event.icsuid).push(event);
  }

  for (const events of eventsByUid.values()) {
    const master = events.find((e) => !e.recurrenceId);
    const exceptions = events.filter((e) => e.recurrenceId);

    // Exceptions stored inline in the master's ICS come out of the expansion, and the sync
    // engine may also store them as separate rows; skip the rows the expansion already covered.
    const expandedStartTimes = new Set<number>();

    if (master) {
      try {
        const expander = new IcalExpander({
          ics: master.ics,
          maxIterations: ICSEventHelpers.expansionIterationBudget(
            master.ics,
            master.recurrenceStart,
            endUnix
          ),
        });
        const expanded = expander.between(new Date(startUnix * 1000), new Date(endUnix * 1000));
        for (const e of [...expanded.events, ...expanded.occurrences]) {
          const start = e.startDate.toJSDate().getTime() / 1000;
          expandedStartTimes.add(start);
          const item = 'item' in e ? e.item : e;
          occurrences.push(
            occurrenceFromICS(`${master.id}-e${Math.round(start)}`, master, item, e.startDate, e.endDate)
          );
        }
      } catch (err) {
        console.error(`upcoming-events: failed to expand ICS for event ${master.id}`, err);
      }
    }

    for (const exception of exceptions) {
      if (expandedStartTimes.has(exception.recurrenceStart)) {
        continue;
      }
      try {
        const { event: icsEvent } = CalendarUtils.parseICSString(exception.ics);
        const occStart = icsEvent.startDate.toJSDate().getTime() / 1000;
        const occEnd = icsEvent.endDate.toJSDate().getTime() / 1000;
        if (occEnd < startUnix || occStart > endUnix) {
          continue;
        }
        occurrences.push(
          occurrenceFromICS(`${exception.id}-e0`, exception, icsEvent, icsEvent.startDate, icsEvent.endDate)
        );
      } catch (err) {
        console.error(`upcoming-events: failed to parse ICS for exception ${exception.id}`, err);
      }
    }
  }

  return occurrences;
}
