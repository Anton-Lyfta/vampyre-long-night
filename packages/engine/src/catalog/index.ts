/**
 * Actionkatalogen: alla aktioner i regelboken som data, plus funktionerna
 * gränssnittet behöver (meny, steg för steg-val, utkastanalys).
 *
 * Effekterna är stubbar (R19); det som är byggt är vad en aktion kräver, vilka
 * mål som är giltiga, vad den kostar och ger, och hur den räknas mot budgeten.
 * Beslut: docs/decisions/catalog.md.
 */
export { ACTION_CATALOG, stubbedActionIds } from './registry.js';
export * from './types.js';
export { analyzeDraft, nextParam, projectPositions, requirementProblem, isListLevelCode } from './analyze.js';
export type { DraftAnalysis, DraftEntryAnalysis, DraftSubmission, MinionActionCount, ParamRequest, AnalyzeOptions } from './analyze.js';
export { listAvailableActions } from './menu.js';
export type { ActionMenuItem, MenuOptions } from './menu.js';
