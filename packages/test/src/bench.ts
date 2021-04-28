import path from 'path';
import { range } from 'rxjs';
import { mergeMap, take } from 'rxjs/operators';
import { Worker } from '@temporalio/worker';
import { Connection } from '@temporalio/client';
import { msStrToTs } from '@temporalio/workflow/commonjs/time';
import { ActivitySignalHandler } from '../../test-interfaces/lib';

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

async function runCancelTestWorkflow(connection: Connection, taskQueue: string) {
  const workflow = connection.workflow<ActivitySignalHandler>('cancel-fake-progress', { taskQueue });
  await workflow.start();
  console.log('Workflow complete');
}

async function runWorkflows(connection: Connection, taskQueue: string, numWorkflows: number, concurrency: number) {
  await range(0, numWorkflows)
    .pipe(
      take(numWorkflows),
      mergeMap(() => runCancelTestWorkflow(connection, taskQueue), concurrency)
    )
    .toPromise();
}
async function main() {
  const namespace = `bench-${new Date().toISOString()}`;
  const taskQueue = 'bench';
  const connection = new Connection(undefined, { namespace });

  await connection.service.registerNamespace({ namespace, workflowExecutionRetentionPeriod: msStrToTs('1 day') });
  console.log('Registered namespace', { namespace });
  await waitOnNamespace(connection, namespace);
  console.log('Wait complete on namespace', { namespace });

  const worker = await Worker.create({
    workflowsPath: path.join(__dirname, '../../test-workflows/lib'),
    activitiesPath: path.join(__dirname, '../../test-activities/lib'),
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
      await runWorkflows(connection, taskQueue, 1_00, 1_00);
      worker.shutdown();
    })(),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
