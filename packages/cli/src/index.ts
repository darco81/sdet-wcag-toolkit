import { Command } from 'commander';

import { registerAuditCommand } from './commands/audit.js';
import { registerInitCommand } from './commands/init.js';
import { registerReportCommand } from './commands/report.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('wcag-toolkit')
    .description('WCAG 2.2 AA accessibility toolkit CLI')
    .version('0.3.0');
  registerAuditCommand(program);
  registerInitCommand(program);
  registerReportCommand(program);
  return program;
}

export { registerAuditCommand, runAudit } from './commands/audit.js';
export { registerInitCommand, runInit } from './commands/init.js';
export { registerReportCommand, runReport } from './commands/report.js';
export { formatConsoleReport } from './reporters/console.js';
