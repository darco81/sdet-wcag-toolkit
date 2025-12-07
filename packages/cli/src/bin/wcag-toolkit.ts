#!/usr/bin/env node
/**
 * CLI entry point. Parses argv and dispatches to the registered commands.
 */

import { buildProgram } from '../index.js';

await buildProgram().parseAsync(process.argv);
