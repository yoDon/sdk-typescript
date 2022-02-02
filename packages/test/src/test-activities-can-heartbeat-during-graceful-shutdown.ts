import test from 'ava';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { v4 as uuid4 } from 'uuid';
import { Worker } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import { defaultOptions } from './mock-native-worker';
import { RUN_INTEGRATION_TESTS, installDebugCore } from './helpers';
import { cancelFakeProgress } from './workflows';
import { signalSchedulingWorkflow } from './activities';
import { fakeProgress } from './activities/fake-progress';

if (RUN_INTEGRATION_TESTS) {
  test('Core accepts heartbeats after shutdown has been requested', async (t) => {
    await installDebugCore();
    const taskQueue = 'activity-heartbeat-after-shutdown';
    const worker = await Worker.create({
      ...defaultOptions,
      taskQueue,
      activities: {
        fakeProgress: async (...args: Parameters<typeof fakeProgress>) => {
          await signalSchedulingWorkflow('activityStarted');
          // Wait for workflow to get activated and issue a cancellation
          await firstValueFrom(worker.numInFlightActivations$.pipe(filter((value) => value === 1)));
          worker.shutdown();
          await fakeProgress(...args);
        },
      },
    });
    const client = new WorkflowClient();
    const handle = await client.start(cancelFakeProgress, {
      workflowId: uuid4(),
      taskQueue,
    });
    try {
      // If worker completes within graceful shutdown period, the activity has successfully been cancelled
      await worker.run();
    } finally {
      await handle.terminate();
    }
    t.pass();
  });
}
