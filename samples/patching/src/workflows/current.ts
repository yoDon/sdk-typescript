import { Example } from '../interfaces/workflows';
import { sleep, deprecatePatch } from '@temporalio/workflow';

// The "new" workflow
async function main(name: string): Promise<string> {
  deprecatePatch("remove-activity");
  console.log("Activity is gone!");
  console.log("Kill me now!");
  await sleep(7000);
  return `All done ${name}`;
}

// Declare the workflow's type to be checked by the Typescript compiler
export const workflow: Example = { main };
