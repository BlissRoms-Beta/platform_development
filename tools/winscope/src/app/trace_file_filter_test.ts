/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {UserNotificationsListener} from 'messaging/user_notifications_listener';
import {UserWarning} from 'messaging/user_warning';
import {TraceOverridden} from 'messaging/user_warnings';
import {UnitTestUtils} from 'test/unit/utils';
import {TraceFile} from 'trace/trace_file';
import {TraceFileFilter} from './trace_file_filter';

describe('TraceFileFilter', () => {
  const filter = new TraceFileFilter();

  // Could be any file, we just need an instance of File to be used as a fake bugreport archive
  const bugreportArchive = new File(
    [new ArrayBuffer(0)],
    'test_bugreport.zip',
  ) as unknown as File;

  let warnings: UserWarning[];
  let notificationListener: UserNotificationsListener;

  beforeEach(() => {
    warnings = [];
    notificationListener = {
      onNotifications(notifications: UserWarning[]) {
        warnings.push(...notifications);
      },
    };
  });

  describe('bugreport (detects it is a bugreport)', () => {
    it('ignores non-trace dirs', async () => {
      const pickedBugreportFiles = [
        makeTraceFile(
          'FS/data/misc/wmtrace/surface_flinger.bp',
          bugreportArchive,
        ),
        makeTraceFile('FS/data/misc/wmtrace/transactions.bp', bugreportArchive),
        makeTraceFile('proto/window_CRITICAL.proto', bugreportArchive),
        makeTraceFile('proto/input_method_CRITICAL.proto', bugreportArchive),
        makeTraceFile('proto/SurfaceFlinger_CRITICAL.proto', bugreportArchive),
      ];

      const ignoredBugreportFile = makeTraceFile(
        'FS/data/misc/ignored-dir/wm_transition_trace.bp',
        bugreportArchive,
      );

      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        ...pickedBugreportFiles,
        ignoredBugreportFile,
      ];

      // Corner case:
      // A plain trace file is loaded along the bugreport
      //    -> trace file must not be ignored
      //
      // Note:
      // The even weirder corner case where two bugreports are loaded at the same time is
      // currently not properly handled.
      const plainTraceFile = makeTraceFile(
        'would-be-ignored-if-was-part-of-bugreport/input_method_clients.pb',
      );

      const result = await filter.filter(
        [...bugreportFiles, plainTraceFile],
        notificationListener,
      );
      expect(result.perfetto).toBeUndefined();

      const expectedLegacy = new Set([...pickedBugreportFiles, plainTraceFile]);
      const actualLegacy = new Set(result.legacy);
      expect(actualLegacy).toEqual(expectedLegacy);
    });

    it('picks perfetto systrace.pftrace', async () => {
      const perfettoSystemTrace = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/systrace.pftrace',
        bugreportArchive,
      );
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        perfettoSystemTrace,
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.perfetto-trace',
          bugreportArchive,
        ),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.pftrace',
          bugreportArchive,
        ),
      ];
      const result = await filter.filter(bugreportFiles, notificationListener);
      expect(result.perfetto).toEqual(perfettoSystemTrace);
      expect(result.legacy).toEqual([]);
      expect(warnings).toEqual([]);
    });

    it('ignores perfetto traces other than systrace.pftrace', async () => {
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.perfetto-trace',
          bugreportArchive,
        ),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.pftrace',
          bugreportArchive,
        ),
      ];
      const result = await filter.filter(bugreportFiles, notificationListener);
      expect(result.perfetto).toBeUndefined();
      expect(result.legacy).toEqual([]);
      expect(warnings).toEqual([]);
    });

    it('identifies dumpstate_board.txt file', async () => {
      const legacyFile = makeTraceFile(
        'proto/window_CRITICAL.proto',
        bugreportArchive,
      );
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        await makeBugreportDumpstateBoardTextFile(),
        legacyFile,
      ];
      const result = await filter.filter(bugreportFiles, notificationListener);
      expect(result.legacy).toEqual([legacyFile]);
      expect(result.perfetto).toBeUndefined();
      expect(result.timezoneInfo).toEqual({
        timezone: 'Asia/Kolkata',
        locale: 'en-US',
      });
      expect(warnings).toEqual([]);
    });

    it('unzips trace files within bugreport zip', async () => {
      const zippedTraceFile = await makeZippedTraceFile();

      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        zippedTraceFile,
      ];

      const result = await filter.filter(bugreportFiles, notificationListener);
      expect(result.perfetto).toBeUndefined();
      expect(result.legacy.map((file) => file.file.name)).toEqual([
        'Surface Flinger/SurfaceFlinger.pb',
        'Window Manager/WindowManager.pb',
      ]);
      expect(warnings).toEqual([]);
    });
  });

  describe('plain input (no bugreport)', () => {
    it('picks perfetto trace with .perfetto-trace extension', async () => {
      const perfettoTrace = makeTraceFile('file.perfetto-trace');
      await checkPerfettoFilePickedWithoutErrors(perfettoTrace);
    });

    it('picks perfetto trace with .pftrace extension', async () => {
      const pftrace = makeTraceFile('file.pftrace');
      await checkPerfettoFilePickedWithoutErrors(pftrace);
    });

    it('picks perfetto trace with .perfetto extension', async () => {
      const perfetto = makeTraceFile('file.perfetto');
      await checkPerfettoFilePickedWithoutErrors(perfetto);
    });

    it('picks perfetto trace with .perfetto-trace.gz extension', async () => {
      const perfettoTraceGz = makeTraceFile('file.perfetto-trace.gz');
      await checkPerfettoFilePickedWithoutErrors(perfettoTraceGz);
    });

    it('picks perfetto trace with .pftrace.gz extension', async () => {
      const pftraceGz = makeTraceFile('file.pftrace.gz');
      await checkPerfettoFilePickedWithoutErrors(pftraceGz);
    });

    it('picks perfetto trace with .perfetto.gz extension', async () => {
      const perfettoGz = makeTraceFile('file.perfetto.gz');
      await checkPerfettoFilePickedWithoutErrors(perfettoGz);
    });

    it('picks largest perfetto trace', async () => {
      const small = makeTraceFile('small.perfetto-trace', undefined, 10);
      const medium = makeTraceFile('medium.perfetto-trace', undefined, 20);
      const large = makeTraceFile('large.perfetto-trace', undefined, 30);
      const result = await filter.filter(
        [small, large, medium],
        notificationListener,
      );
      expect(result.perfetto).toEqual(large);
      expect(result.legacy).toEqual([]);
      expect(warnings).toEqual([
        new TraceOverridden(small.getDescriptor()),
        new TraceOverridden(medium.getDescriptor()),
      ]);
    });

    async function checkPerfettoFilePickedWithoutErrors(
      perfettoFile: TraceFile,
    ) {
      const result = await filter.filter([perfettoFile], notificationListener);
      expect(result.perfetto).toEqual(perfettoFile);
      expect(result.legacy).toEqual([]);
      expect(warnings).toEqual([]);
    }
  });

  function makeTraceFile(
    filename: string,
    parentArchive?: File,
    size?: number,
  ) {
    size = size ?? 0;
    const file = new File([new ArrayBuffer(size)], filename);
    return new TraceFile(file as unknown as File, parentArchive);
  }

  async function makeBugreportMainEntryTraceFile() {
    const file = await UnitTestUtils.getFixtureFile(
      'bugreports/main_entry.txt',
      'main_entry.txt',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeBugreportDumpstateBoardTextFile() {
    const file = await UnitTestUtils.getFixtureFile(
      'bugreports/dumpstate_board.txt',
      'dumpstate_board.txt',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeBugreportCodenameTraceFile() {
    const file = await UnitTestUtils.getFixtureFile(
      'bugreports/bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
      'bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeZippedTraceFile() {
    const file = await UnitTestUtils.getFixtureFile(
      'traces/winscope.zip',
      'FS/data/misc/wmtrace/winscope.zip',
    );
    return new TraceFile(file, bugreportArchive);
  }
});
