# Upcoming Events for Mailspring

A Mailspring plugin that adds a sidebar on the right of the mail window listing your calendar
events for the next 14 days.

- Events are grouped by day ("Today", "Tomorrow", then the date), all-day events first.
- Recurring events are expanded the same way the calendar window does it, and calendars you've
  hidden in the calendar window are hidden here too.
- An event in progress is listed under today with a "Now" badge; finished events drop off within
  a minute.
- Click an event, or **Open Calendar**, to open the calendar window.
- The calendar button in the toolbar shows or hides the sidebar. Drag its left edge to resize it.

Requires Mailspring 1.26 or later, with at least one account whose calendars sync.

## Install

```bash
npm install
npm run install-plugin       # builds, then copies into Mailspring's packages folder
```

Then restart Mailspring. To install by hand instead, run `npm run build` and choose
**Developer > Install a Plugin...** in Mailspring, selecting `dist/upcoming-events`.

To try it against a development build of Mailspring (`npm start` in a Mailspring checkout), use
`npm run install-plugin:dev`, which installs into the `Mailspring-dev` config folder.

To remove it, delete the `upcoming-events` folder from Mailspring's `packages` folder
(`%APPDATA%\Mailspring\packages` on Windows, `~/Library/Application Support/Mailspring/packages`
on macOS, `~/.config/Mailspring/packages` on Linux) and restart.

## Develop

| Command | Does |
| --- | --- |
| `npm run build` | Bundles `src/` into `dist/upcoming-events/` |
| `npm run watch` | Rebuilds on change (re-run `install-plugin` or point Mailspring at `dist/`) |
| `npm run typecheck` | Type-checks without emitting |

Packaged Mailspring can't compile TypeScript, so the plugin ships as one bundled JavaScript file.
`mailspring-exports`, `mailspring-component-kit` and `electron` come from the running app and are
left out of the bundle; `ical-expander` is bundled because the app doesn't expose it to plugins.

`types/mailspring.d.ts` declares only the parts of Mailspring's API this plugin uses. Extend it
when you reach for something new.

### How the column is added

Mailspring's mail layouts are defined inside the app, with no extension point for a new column.
`src/workspace-column.ts` appends the plugin's column to the existing `Threads` and `Thread`
sheet definitions when the plugin activates and removes it on deactivate. If a future Mailspring
release renames those sheets, the sidebar won't appear until this file is updated.
