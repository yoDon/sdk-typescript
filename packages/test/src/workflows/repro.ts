import * as wf from '@temporalio/workflow';

import type * as activities from '../activities';

export const iterationQuery = wf.defineQuery<number>('iteration');

const { echo } = wf.proxyActivities<typeof activities>({ startToCloseTimeout: '1m' });

export async function runActivityInLoop() {
  let i = 0;
  wf.setHandler(iterationQuery, () => i);
  for (; i < 3; ++i) {
    await echo('hello');
    await echo('hola');
    await wf.sleep(1000);
  }
}
