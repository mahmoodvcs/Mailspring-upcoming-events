import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import { addColumn, removeColumn } from './workspace-column';
import { UpcomingEventsSidebar } from './upcoming-events-sidebar';
import { UpcomingEventsToggle, UpcomingEventsToggleThread } from './upcoming-events-toggle';

export function activate() {
  const location = addColumn();

  ComponentRegistry.register(UpcomingEventsSidebar, { location });
  ComponentRegistry.register(UpcomingEventsToggle, {
    location: WorkspaceStore.Sheet.Threads.Toolbar.Right,
  });
  ComponentRegistry.register(UpcomingEventsToggleThread, {
    location: WorkspaceStore.Sheet.Thread.Toolbar.Right,
    modes: ['list'],
  });
}

export function deactivate() {
  ComponentRegistry.unregister(UpcomingEventsSidebar);
  ComponentRegistry.unregister(UpcomingEventsToggle);
  ComponentRegistry.unregister(UpcomingEventsToggleThread);
  removeColumn();
}

export function serialize() {}
