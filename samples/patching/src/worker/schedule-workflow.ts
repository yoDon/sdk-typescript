import { Connection, WorkflowClient } from '@temporalio/client';
import { Example } from '../interfaces/workflows';

async function run() {
  // Connect to localhost with default ConnectionOptions,
  // pass options to the Connection constructor to configure TLS and other settings.
  const connection = new Connection();
  // Workflows will be started in the "default" namespace unless specified otherwise
  // via options passed the WorkflowClient constructor.
  const client = new WorkflowClient(connection.service);
  // Create a typed client using the Example Workflow interface,
  const example = client.stub<Example>('current', { taskQueue: 'tutorial' });
  const result = await example.execute('with patch example');
  console.log(result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
