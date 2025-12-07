import { Command } from 'commander';

import { registerAuditCommand } from './commands/audit.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('wcag-toolkit')
    .description('WCAG 2.2 AA accessibility toolkit CLI')
    .version('0.1.0');
  registerAuditCommand(program);
  return program;
}

export { registerAuditCommand, runAudit } from './commands/audit.js';
export { formatConsoleReport } from './reporters/console.js';
