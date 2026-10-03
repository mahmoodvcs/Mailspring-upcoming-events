import { React, localized, WorkspaceStore, Actions } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import { COLUMN_ID } from './workspace-column';

export class UpcomingEventsToggle extends React.Component<
  Record<string, unknown>,
  { hidden: boolean }
> {
  static displayName = 'UpcomingEventsToggle';

  _mounted = false;
  _unsubscribe: () => void;

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this._mounted = true;
    this._unsubscribe = WorkspaceStore.listen(this._onStoreChange);
  }

  componentWillUnmount() {
    this._mounted = false;
    this._unsubscribe();
  }

  _getStateFromStores() {
    return {
      hidden: WorkspaceStore.isLocationHidden(WorkspaceStore.Location[COLUMN_ID]),
    };
  }

  // Toggling the column can unmount this button within the same WorkspaceStore trigger that
  // notifies it, so the listener may fire after unmount.
  _onStoreChange = () => {
    if (this._mounted) {
      this.setState(this._getStateFromStores());
    }
  };

  _onToggle = () => {
    Actions.toggleWorkspaceLocationHidden(WorkspaceStore.Location[COLUMN_ID]);
  };

  render() {
    const label = this.state.hidden
      ? localized('Show Upcoming Events')
      : localized('Hide Upcoming Events');
    return (
      <button
        className={`btn btn-toolbar upcoming-events-toggle ${this.state.hidden ? '' : 'active'}`}
        style={{ order: 499 }}
        title={label}
        aria-label={label}
        aria-pressed={!this.state.hidden}
        onClick={this._onToggle}
      >
        <RetinaImg
          name="ic-eventcard-calendar.png"
          mode={RetinaImg.Mode.ContentIsMask}
          aria-hidden="true"
        />
      </button>
    );
  }
}

// ComponentRegistry keys registrations by displayName, so the same button needs a distinct
// class to also appear in the single-thread sheet.
export class UpcomingEventsToggleThread extends UpcomingEventsToggle {
  static displayName = 'UpcomingEventsToggleThread';
}
