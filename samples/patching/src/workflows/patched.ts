import { Example } from '../interfaces/workflows';
import { greet } from '@activities/greeter';
import { sleep, patched } from '@temporalio/workflow';

// The "patched" workflow
async function main(name: string): Promise<string> {
  if (patched("remove-activity")) {
    console.log("Activity is gone!");
  } else {
    greet("Some activity I want to patch out");
  }
  console.log("Kill me now!");
  await sleep(7000);
  return `All done ${name}`;
}

// Declare the workflow's type to be checked by the Typescript compiler
export const workflow: Example = { main };
