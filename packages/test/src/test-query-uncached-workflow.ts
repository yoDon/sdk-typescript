import test from 'ava';
import { v4 as uuid4 } from 'uuid';
import { Worker } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import { RUN_INTEGRATION_TESTS } from './helpers';
import * as activities from './activities';
import * as workflows from './workflows/repro';

if (RUN_INTEGRATION_TESTS) {
  test('Workflow does not get "stuck" if it receives a query while uncached', async (t) => {
    const worker = await Worker.create({
      taskQueue: __filename,
      workflowsPath: require.resolve('./workflows/repro'),
      activities,
    });

    const p = worker.run();
    const client = new WorkflowClient();

    try {
      client.start(workflows.runActivityInLoop, { taskQueue: __filename, workflowId: uuid4() });
    } finally {
      worker.shutdown();
      await p;
    }

    t.pass();
  });
}
