/**
 * Validator Agent - Continuous Monitoring & Recovery
 * Responsible for validating action results and coordinating recovery
 */

import { type AgentContext, type ActionResult } from '../types';
import { ExecutionState, Actors } from '../event/types';
import { createLogger } from '@src/background/log';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { t } from '@extension/i18n';

const logger = createLogger('ValidatorAgent');

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestedAction?: 'retry' | 'continue' | 'abort' | 'replan';
}

export class ValidatorAgent {
  private context: AgentContext;
  private llm: BaseChatModel;

  constructor(context: AgentContext, llm: BaseChatModel) {
    this.context = context;
    this.llm = llm;
  }

  /**
   * Validate the result of an action
   */
  async validateActionResult(
    actionName: string,
    actionInput: unknown,
    result: ActionResult,
    task: string,
  ): Promise<ValidationResult> {
    // AI-based semantic validation
    try {
      // Quick check based on result status first
      if (!result.success && !result.extractedContent) {
        return {
          isValid: false,
          confidence: 1.0,
          issues: [result.error || 'Action failed execution'],
          suggestedAction: 'retry',
        };
      }

      // AUTO-PASS Navigation if no technical error
      // Rationale: Navigation intent is hard to validate semantically without deep state analysis.
      // If the browser didn't crash and we are on a new URL, it's likely fine.
      if (actionName === 'goto' || actionName === 'navigate') {
        return { isValid: true, confidence: 0.9, issues: [], suggestedAction: 'continue' };
      }

      // Skip heavy validation for trivial actions to save latency/cost
      const validationNeeded = ['click_element', 'input_text', 'upload_file', 'submit'].includes(actionName);
      if (!validationNeeded) {
        return { isValid: true, confidence: 1.0, issues: [], suggestedAction: 'continue' };
      }

      logger.info(`Validating action: ${actionName}`);

      const prompt = `
            You are a rigorous QA Validator for an autonomous browser agent.
            
            # Context
            Ultimate Task: ${task}
            Action Taken: ${actionName}
            Input Parameters: ${JSON.stringify(actionInput)}
            Execution Result: ${JSON.stringify(result).slice(0, 1000)}
            
            # Instructions
            Analyze if the action likely succeeded or if it failed.
            - If valid DOM elements were found and interacted with, assume SUCCESS unless there is an explicit error message.
            - Do NOT over-analyze "progress". If the click happened, it is valid.
            - only mark as INVALID if there is a clear "Element not found", "Timeout", or "Error".
            
            # Response Format (JSON ONLY)
            {
              "isValid": boolean,
              "confidence": number, // 0.0 to 1.0
              "issues": string[], // List of potential problems
              "suggestedAction": "continue" | "retry" | "abort" | "replan"
            }
            `;

      const response = await this.llm.invoke([
        ['system', "You are a validator who outputs only valid JSON. Be lenient on 'progress', strict on 'errors'."],
        ['user', prompt],
      ]);

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const cleanContent = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const validationRaw = JSON.parse(cleanContent);

      return {
        isValid: validationRaw.isValid,
        confidence: validationRaw.confidence,
        issues: validationRaw.issues || [],
        suggestedAction: validationRaw.suggestedAction || 'continue',
      };
    } catch (error) {
      logger.error('Validation failed', error);
      // Fail open to avoid blocking valid actions on validator errors, but log it
      return {
        isValid: true,
        confidence: 0.5,
        issues: ['Validator error: ' + String(error)],
        suggestedAction: 'continue',
      };
    }
  }

  /**
   * Monitor task execution and detect stalls
   */
  async monitorProgress(): Promise<{ needsReplan: boolean; isLooping?: boolean }> {
    const history = this.context.history.history;
    if (history.length < 3) return { needsReplan: false, isLooping: false };

    // specific stall detection logic
    const lastThreeSteps = history.slice(-3);
    const resultsStatus = lastThreeSteps.map(step => step.result.map(r => r.success));
    const repeatedFailures = lastThreeSteps.every(step => step.result.every(r => !r.success));

    // Check for "Action Loop" - are we doing the exact same thing 3 times?
    const lastactions = lastThreeSteps.map(s => s.modelOutput);

    // Debug Log
    logger.info(`[Monitor] Checking progress. History Len: ${history.length}`);
    logger.info(`[Monitor] Last 3 statuses: ${JSON.stringify(resultsStatus)}`);
    logger.info(`[Monitor] Last 3 actions hashes: ${lastactions.map(a => (a ? a.substring(0, 50) + '...' : 'null'))}`);

    const looping =
      lastactions[0] &&
      lastactions[1] &&
      lastactions[2] &&
      lastactions[0] === lastactions[1] &&
      lastactions[1] === lastactions[2] &&
      lastactions[0].length > 10;

    if (repeatedFailures || looping) {
      const reason = repeatedFailures ? '3 consecutive failures' : 'Action Loop';
      logger.warning(`Detected execution stall: ${reason}`);
      // Only emit failure event if it is a LOOP, otherwise silent (per new robustness policy)
      if (looping) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, `Detected ${reason} - suggesting replan`);
      }
      return { needsReplan: true, isLooping: looping ? true : false };
    }
    return { needsReplan: false, isLooping: false };
  }
}
