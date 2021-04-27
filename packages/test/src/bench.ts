import path from 'path';
import { v4 as uuid4 } from 'uuid';
import { range } from 'rxjs';
import { mergeMap, take } from 'rxjs/operators';
import { Worker } from '@temporalio/worker';
import { Connection } from '@temporalio/client';
import { WorkflowExecutionFailedError } from '@temporalio/workflow/commonjs/errors';
import { msStrToTs } from '@temporalio/workflow/commonjs/time';
import { CancellableHTTPRequest } from '../../test-interfaces/lib';
import { withZeroesHTTPServer } from './zeroes-http-server';

async function waitOnNamespace(connection: Connection, namespace: string, maxAttempts = 100, retryIntervalSecs = 1) {
  for (let attempt = 1; attempt <= maxAttempts; ++attempt) {
    try {
      await connection.service.getWorkflowExecutionHistory({
        namespace,
        execution: { workflowId: 'fake', runId: '12345678-1234-1234-1234-1234567890ab' },
      });
    } catch (err) {
      if (err.details === 'Requested workflow history not found, may have passed retention period.') {
        break;
      }
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryIntervalSecs * 1000));
    }
  }
}

async function runCancelTestWorkflow(connection: Connection, taskQueue: string, url: string) {
  const workflow = connection.workflow<CancellableHTTPRequest>('cancel-http-request', { taskQueue });
  let completedWithFailure = false;

  try {
    await workflow.start(url, true);
  } catch (err) {
    completedWithFailure = err.message === 'Activity cancelled' && err instanceof WorkflowExecutionFailedError;
  }
  console.log('Workflow complete', { completedWithFailure });

  if (!completedWithFailure) {
    throw new Error('Expected workflow to be completed with failure');
  }
}

async function runWorkflows(connection: Connection, taskQueue: string, numWorkflows: number, concurrency: number) {
  await withZeroesHTTPServer(async (port) => {
    const url = `http://127.0.0.1:${port}`;
    await range(0, numWorkflows)
      .pipe(
        take(numWorkflows),
        mergeMap(() => runCancelTestWorkflow(connection, taskQueue, url), concurrency)
      )
      .toPromise();
  });
}
async function main() {
  const namespace = `bench-${uuid4()}`;
  const taskQueue = 'bench';
  const connection = new Connection(undefined, { namespace });

  await connection.service.registerNamespace({ namespace, workflowExecutionRetentionPeriod: msStrToTs('1 day') });
  console.log('Registered namespace', { namespace });
  await waitOnNamespace(connection, namespace);
  console.log('Wait complete on namespace', { namespace });

  const worker = await Worker.create({
    workflowsPath: path.join(__dirname, '/../../test-workflows/lib'),
    activitiesPath: path.join(__dirname, '/../../test-activities/lib'),
    taskQueue,
    maxConcurrentActivityExecutions: 100,
    maxConcurrentWorkflowTaskExecutions: 100,
    serverOptions: {
      namespace,
    },
  });
  console.log('Created worker');

  await Promise.all([
    worker.run(),
    (async () => {
      await runWorkflows(connection, taskQueue, 1_000, 1_00);
      worker.shutdown();
    })(),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
