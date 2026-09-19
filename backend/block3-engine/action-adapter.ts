/**
 * SPENDGUARDIAN — Action Execution Adapter Interface
 *
 * Defines the contract for executing merchant subscription actions
 * (e.g. mock simulations or external webhook dispatchers).
 */

import { ActionExecutionParams, ActionExecutionResponse } from './action-types.ts';

export interface IActionExecutionAdapter {
  readonly name: string;
  execute(params: ActionExecutionParams): Promise<ActionExecutionResponse>;
}
