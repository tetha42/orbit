// Checks for the pure (browser-free, import-free) helpers.
//
//   node scripts/check-pure.mjs
//
// Node strips TypeScript types itself, so these modules are imported directly.
// That only works for files with no `@/` aliases and no extension-less relative
// imports — which is exactly what keeps them pure and easy to test.
import { finishPureChecks } from './pure-checks/runner.mjs';
import { runPlatformAndUiChecks } from './pure-checks/platformAndUi.mjs';
import { runTasksAndProjectsChecks } from './pure-checks/tasksAndProjects.mjs';
import { runEventsAndTeamsChecks } from './pure-checks/eventsAndTeams.mjs';
import { runAuthAndProfileChecks } from './pure-checks/authAndProfile.mjs';
import { runBudgetAndMailChecks } from './pure-checks/budgetAndMail.mjs';
import { runSettingsAndThemeChecks } from './pure-checks/settingsAndTheme.mjs';
import { runFormsAndMediaChecks } from './pure-checks/formsAndMedia.mjs';
import { runSecurityAndSseChecks } from './pure-checks/securityAndSse.mjs';
import { runWafGuardsChecks } from './pure-checks/wafGuards.mjs';

runPlatformAndUiChecks();
runTasksAndProjectsChecks();
runEventsAndTeamsChecks();
runAuthAndProfileChecks();
runBudgetAndMailChecks();
runSettingsAndThemeChecks();
runFormsAndMediaChecks();
runSecurityAndSseChecks();
runWafGuardsChecks();

await finishPureChecks();
