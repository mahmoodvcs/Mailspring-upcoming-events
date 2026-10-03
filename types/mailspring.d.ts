// Hand-written declarations for the slice of Mailspring's plugin API this plugin uses. The app's
// own .d.ts files import from its source tree, so they can't be consumed outside a checkout.

declare module 'mailspring-exports' {
  import * as ReactModule from 'react';

  export const React: typeof ReactModule;
  export const Rx: any;

  export function localized(en: string, ...subs: unknown[]): string;

  export type CalendarDate = number & { readonly __calendarDate: unique symbol };
  export const CalendarDateUtils: {
    calendarDateFromUnix(unixSeconds: number, zone?: string): CalendarDate;
    calendarDateFromParts(year: number, month: number, day: number): CalendarDate;
    dayStartUnix(date: CalendarDate): number;
    nextDayStartUnix(date: CalendarDate): number;
    addCalendarDays(date: CalendarDate, days: number): CalendarDate;
  };

  export const ICSEventHelpers: {
    expansionIterationBudget(ics: string, seriesStartUnix: number, windowEndUnix: number): number;
    isRecurringEvent(ics: string): boolean;
  };

  export const CalendarUtils: {
    parseICSString(ics: string): { root: any; event: any };
  };

  export const Utils: {
    hueForString(str: string | null): number;
  };

  export const Matcher: any;

  export class Model {
    id: string;
    accountId: string;
  }

  export class Event extends Model {
    static attributes: any;
    calendarId: string;
    ics: string;
    icsuid: string;
    recurrenceId: string;
    recurrenceStart: number;
    recurrenceEnd: number;
  }

  export class Calendar extends Model {
    name: string;
    color?: string;
    readOnly: boolean;
  }

  export class Contact extends Model {
    constructor(data: { email: string });
    isMe(): boolean;
  }

  export const DatabaseStore: {
    findAll<T extends Model>(klass: new (...args: any[]) => T): any;
  };

  export interface SheetLocation {
    id: string;
    Toolbar: { id: string };
  }

  export interface SheetDeclaration {
    id: string;
    columns: { [mode: string]: SheetLocation[] };
    Toolbar: { Left: { id: string }; Right: { id: string } };
  }

  export const WorkspaceStore: {
    Location: { [id: string]: SheetLocation };
    Sheet: { [id: string]: SheetDeclaration };
    isLocationHidden(location: { id: string } | null): boolean;
    listen(callback: () => void): () => void;
    trigger(arg?: unknown): void;
  };

  export const ComponentRegistry: {
    register(component: any, options: { location?: { id: string }; role?: string; modes?: string[] }): void;
    unregister(component: any): void;
  };

  export const Actions: {
    toggleWorkspaceLocationHidden(location: SheetLocation): void;
  };
}

declare module 'mailspring-component-kit' {
  import * as ReactModule from 'react';

  export const ScrollRegion: ReactModule.ComponentType<{ className?: string; children?: ReactModule.ReactNode }>;

  export const RetinaImg: ReactModule.ComponentType<{
    name?: string;
    url?: string;
    mode: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }> & { Mode: { ContentIsMask: string; ContentPreserve: string } };
}

declare module 'electron' {
  export const ipcRenderer: {
    send(channel: string, ...args: unknown[]): void;
  };
}

declare module 'ical-expander' {
  export default class IcalExpander {
    constructor(opts: { ics: string; maxIterations?: number; skipInvalidDates?: boolean });
    between(
      after?: Date,
      before?: Date
    ): {
      events: any[];
      occurrences: { startDate: any; endDate: any; item: any }[];
    };
  }
}

declare const AppEnv: {
  config: {
    get(key: string): any;
  };
};
