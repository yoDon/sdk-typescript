#!/usr/bin/env bash

echo -n "polls: " && rg "at poll" bench.log | wc -l
echo -n "new acts: " && rg "Got activity" bench.log | wc -l
echo -n "cancels to lang: " && rg "got cancel in poll" bench.log | wc -l
echo -n "server cancels: " && rg "cancel from server" bench.log | wc -l
echo -n "times lang polled: " && rg "Lang starting poll" bench.log | wc -l
echo -n "tasks lang got: " && rg "Got at" bench.log | wc -l
echo -n "poll timeout: " && rg "At poll timeout" bench.log | wc -l
