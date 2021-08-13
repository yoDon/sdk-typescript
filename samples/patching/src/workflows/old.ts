import { Example } from '../interfaces/workflows';
import { greet } from '@activities/greeter';
import { sleep } from '@temporalio/workflow';

// The "original" workflow
async function main(name: string): Promise<string> {
  greet("Some activity I want to patch out");
  console.log("Kill me now!");
  await sleep(7000);
  return `All done ${name}`;
}

// Declare the workflow's type to be checked by the Typescript compiler
export const workflow: Example = { main };
