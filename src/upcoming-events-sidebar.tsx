import { ipcRenderer } from 'electron';
import {
  React,
  Rx,
  Utils,
  Calendar,
  CalendarDate,
  CalendarDateUtils,
  DatabaseStore,
  localized,
} from 'mailspring-exports';
import { ScrollRegion } from 'mailspring-component-kit';
import {
  EventOccurrence,
  isTimed,
  observeOccurrences,
  occurrenceEndUnix,
  occurrenceStartUnix,
} from './occurrences';

const DAYS_AHEAD = 14;
const REFRESH_INTERVAL_MS = 60 * 1000;
const DISABLED_CALENDARS = 'mailspring.disabledCalendars';

interface DayGroup {
  date: CalendarDate;
  events: EventOccurrence[];
}

interface UpcomingEventsSidebarState {
  occurrences: EventOccurrence[];
  disabledCalendars: string[];
  syncedColors: Map<string, string>;
  now: number;
}

function nowUnix() {
  return Date.now() / 1000;
}

function openCalendarWindow() {
  ipcRenderer.send('command', 'application:show-calendar');
}

function formatTime(unix: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: AppEnv.config.get('core.workspace.use24HourClock') ? 'h23' : 'h12',
  }).format(new Date(unix * 1000));
}

function formatDay(date: CalendarDate) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(CalendarDateUtils.dayStartUnix(date) * 1000));
}

/**
 * Lists the occurrences that haven't ended yet, from now through the next DAYS_AHEAD days,
 * grouped by day. An event already in progress is listed under today rather than the day it
 * began, and a multi-day event is listed once rather than on every day it covers.
 */
export class UpcomingEventsSidebar extends React.Component<
  Record<string, unknown>,
  UpcomingEventsSidebarState
> {
  static displayName = 'UpcomingEventsSidebar';

  static containerStyles = {
    order: 2,
    flexShrink: 0,
    minWidth: 200,
    maxWidth: 400,
  };

  _calendarsSub?: { dispose(): void };
  _eventsSub?: { dispose(): void };
  _subscribedDay?: CalendarDate;
  _timer?: ReturnType<typeof setInterval>;

  state: UpcomingEventsSidebarState = {
    occurrences: [],
    disabledCalendars: [],
    syncedColors: new Map(),
    now: nowUnix(),
  };

  componentDidMount() {
    this._calendarsSub = Rx.Observable.combineLatest(
      Rx.Observable.fromQuery(DatabaseStore.findAll<Calendar>(Calendar)),
      Rx.Observable.fromConfig(DISABLED_CALENDARS)
    ).subscribe(([calendars, disabledCalendars]: [Calendar[], string[] | undefined]) => {
      const syncedColors = new Map<string, string>();
      for (const calendar of calendars) {
        if (calendar.color) {
          syncedColors.set(calendar.id, calendar.color);
        }
      }
      this.setState(
        { syncedColors, disabledCalendars: disabledCalendars || [] },
        this._subscribeToEvents
      );
    });
    this._timer = setInterval(this._onTick, REFRESH_INTERVAL_MS);
  }

  componentWillUnmount() {
    clearInterval(this._timer);
    this._calendarsSub?.dispose();
    this._eventsSub?.dispose();
  }

  _onTick = () => {
    this.setState({ now: nowUnix() });
    if (CalendarDateUtils.calendarDateFromUnix(nowUnix()) !== this._subscribedDay) {
      this._subscribeToEvents();
    }
  };

  _subscribeToEvents = () => {
    const today = CalendarDateUtils.calendarDateFromUnix(nowUnix());
    this._subscribedDay = today;

    this._eventsSub?.dispose();
    this._eventsSub = observeOccurrences({
      startUnix: CalendarDateUtils.dayStartUnix(today),
      endUnix: CalendarDateUtils.dayStartUnix(CalendarDateUtils.addCalendarDays(today, DAYS_AHEAD)) - 1,
      disabledCalendars: this.state.disabledCalendars,
    }).subscribe((occurrences: EventOccurrence[]) => this.setState({ occurrences }));
  };

  /** Same precedence as the calendar window: user override, then synced, then generated. */
  _colorFor(calendarId: string) {
    return (
      AppEnv.config.get(`calendar.colors.${calendarId}`) ||
      this.state.syncedColors.get(calendarId) ||
      `hsl(${Utils.hueForString(calendarId)}, 80%, 45%)`
    );
  }

  _dayGroups(): DayGroup[] {
    const { occurrences, now } = this.state;
    const today = CalendarDateUtils.calendarDateFromUnix(now);
    const byDate = new Map<CalendarDate, EventOccurrence[]>();

    for (const occurrence of occurrences) {
      if (occurrenceEndUnix(occurrence) <= now) {
        continue;
      }
      const date = occurrence.startDate < today ? today : occurrence.startDate;
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date).push(occurrence);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) {
            return a.isAllDay ? -1 : 1;
          }
          return occurrenceStartUnix(a) - occurrenceStartUnix(b);
        }),
      }));
  }

  _dayLabel(date: CalendarDate) {
    const today = CalendarDateUtils.calendarDateFromUnix(this.state.now);
    if (date === today) {
      return localized('Today');
    }
    if (date === CalendarDateUtils.addCalendarDays(today, 1)) {
      return localized('Tomorrow');
    }
    return formatDay(date);
  }

  _timeLabel(occurrence: EventOccurrence) {
    if (!isTimed(occurrence)) {
      return localized('All day');
    }
    return `${formatTime(occurrence.start)} – ${formatTime(occurrence.end)}`;
  }

  _renderEvent = (occurrence: EventOccurrence) => {
    const { now } = this.state;
    const inProgress = isTimed(occurrence) && occurrence.start <= now && now < occurrence.end;
    const className = [
      'upcoming-event',
      inProgress && 'in-progress',
      occurrence.isCancelled && 'cancelled',
      occurrence.isPending && 'pending',
    ]
      .filter(Boolean)
      .join(' ');
    const title = occurrence.title || localized('(No title)');

    return (
      <div
        key={occurrence.id}
        className={className}
        role="button"
        tabIndex={0}
        title={localized('Open Calendar')}
        onClick={openCalendarWindow}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCalendarWindow();
          }
        }}
      >
        <div
          className="upcoming-event-color-bar"
          style={{ backgroundColor: this._colorFor(occurrence.calendarId) }}
        />
        <div className="upcoming-event-details">
          <div className="upcoming-event-title">
            {occurrence.isCancelled ? <s>{title}</s> : title}
          </div>
          <div className="upcoming-event-time">
            {this._timeLabel(occurrence)}
            {inProgress && <span className="upcoming-event-now">{localized('Now')}</span>}
          </div>
          {occurrence.location && (
            <div className="upcoming-event-location">{occurrence.location}</div>
          )}
        </div>
      </div>
    );
  };

  _renderDayGroup = ({ date, events }: DayGroup) => (
    <section key={date} className="upcoming-events-day" aria-label={this._dayLabel(date)}>
      <h3 className="upcoming-events-day-header">{this._dayLabel(date)}</h3>
      {events.map(this._renderEvent)}
    </section>
  );

  render() {
    const groups = this._dayGroups();

    return (
      <aside className="upcoming-events-sidebar" aria-label={localized('Upcoming events')}>
        <div className="upcoming-events-header">
          <h2>{localized('Upcoming Events')}</h2>
          <button className="btn btn-small" onClick={openCalendarWindow}>
            {localized('Open Calendar')}
          </button>
        </div>
        <ScrollRegion className="upcoming-events-scroll-region">
          {groups.length > 0 ? (
            groups.map(this._renderDayGroup)
          ) : (
            <div className="upcoming-events-empty">
              {localized('No events in the next %@ days', DAYS_AHEAD)}
            </div>
          )}
        </ScrollRegion>
      </aside>
    );
  }
}
