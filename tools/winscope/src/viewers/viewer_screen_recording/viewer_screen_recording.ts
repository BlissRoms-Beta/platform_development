/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from 'common/assert_utils';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';
import {ScreenRecordingTraceEntry} from 'trace/screen_recording';
import {Trace} from 'trace/trace';
import {Traces} from 'trace/traces';
import {TraceEntryFinder} from 'trace/trace_entry_finder';
import {TraceType} from 'trace/trace_type';
import {View, Viewer, ViewType} from 'viewers/viewer';
import {ViewerScreenRecordingComponent} from './viewer_screen_recording_component';

class ViewerScreenRecording implements Viewer {
  static readonly DEPENDENCIES: TraceType[] = [TraceType.SCREEN_RECORDING];

  private readonly trace: Trace<ScreenRecordingTraceEntry>;
  private readonly htmlElement: HTMLElement;
  private readonly view: View;

  constructor(traces: Traces) {
    this.trace = assertDefined(traces.getTrace(TraceType.SCREEN_RECORDING));
    this.htmlElement = document.createElement('viewer-screen-recording');
    this.view = new View(
      ViewType.OVERLAY,
      this.getDependencies(),
      this.htmlElement,
      'ScreenRecording',
      TraceType.SCREEN_RECORDING,
    );
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    await event.visit(
      WinscopeEventType.TRACE_POSITION_UPDATE,
      async (event) => {
        const entry = TraceEntryFinder.findCorrespondingEntry(
          this.trace,
          event.position,
        );
        (
          this.htmlElement as unknown as ViewerScreenRecordingComponent
        ).currentTraceEntry = await entry?.getValue();
      },
    );
    await event.visit(
      WinscopeEventType.EXPANDED_TIMELINE_TOGGLED,
      async (event) => {
        (
          this.htmlElement as unknown as ViewerScreenRecordingComponent
        ).forceMinimize = event.isTimelineExpanded;
      },
    );
  }

  setEmitEvent() {
    // do nothing
  }

  getViews(): View[] {
    return [this.view];
  }

  getDependencies(): TraceType[] {
    return ViewerScreenRecording.DEPENDENCIES;
  }
}

export {ViewerScreenRecording};
