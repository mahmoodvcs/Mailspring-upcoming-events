import { WorkspaceStore, SheetLocation } from 'mailspring-exports';

export const COLUMN_ID = 'UpcomingEventsSidebar';

// The sheets that make up the main mail window. Thread is the single-message view pushed on
// top of Threads in list mode.
const SHEET_IDS = ['Threads', 'Thread'];

/**
 * Appends this plugin's column to the right edge of every layout of the mail sheets.
 *
 * WorkspaceStore only creates columns for the names its sheets were defined with, and those
 * definitions live in the app. Redefining a sheet would replace the declaration object the
 * sheet stack already holds, so this edits the existing column lists in place instead.
 */
export function addColumn(): SheetLocation {
  const location = (WorkspaceStore.Location[COLUMN_ID] ??= {
    id: COLUMN_ID,
    Toolbar: { id: `${COLUMN_ID}:Toolbar` },
  });

  for (const sheetId of SHEET_IDS) {
    const sheet = WorkspaceStore.Sheet[sheetId];
    if (!sheet) {
      continue;
    }
    for (const columns of Object.values(sheet.columns)) {
      if (!columns.includes(location)) {
        columns.push(location);
      }
    }
  }

  WorkspaceStore.trigger();
  return location;
}

export function removeColumn() {
  const location = WorkspaceStore.Location[COLUMN_ID];
  if (!location) {
    return;
  }
  for (const sheetId of SHEET_IDS) {
    const sheet = WorkspaceStore.Sheet[sheetId];
    if (!sheet) {
      continue;
    }
    for (const columns of Object.values(sheet.columns)) {
      const idx = columns.indexOf(location);
      if (idx !== -1) {
        columns.splice(idx, 1);
      }
    }
  }
  WorkspaceStore.trigger();
}
