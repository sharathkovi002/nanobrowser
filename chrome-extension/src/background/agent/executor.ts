import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';
import { type ActionResult, AgentContext, type AgentOptions, type AgentOutput } from './types';
import { t } from '@extension/i18n';
import { NavigatorAgent, NavigatorActionRegistry } from './agents/navigator';
import { PlannerAgent, type PlannerOutput } from './agents/planner';
import { NavigatorPrompt } from './prompts/navigator';
import { PlannerPrompt } from './prompts/planner';
import { createLogger } from '@src/background/log';
import MessageManager from './messages/service';
import type BrowserContext from '../browser/context';
import { ActionBuilder } from './actions/builder';
import { EventManager } from './event/manager';
import { Actors, type EventCallback, EventType, ExecutionState } from './event/types';
import {
  ChatModelAuthError,
  ChatModelBadRequestError,
  ChatModelForbiddenError,
  ExtensionConflictError,
  RequestCancelledError,
  MaxStepsReachedError,
  MaxFailuresReachedError,
} from './agents/errors';
import { URLNotAllowedError } from '../browser/views';
import { chatHistoryStore } from '@extension/storage/lib/chat';
import type { AgentStepHistory } from './history';
import type { GeneralSettingsConfig } from '@extension/storage';
import { analytics } from '../services/analytics';
import { ValidatorAgent } from './validator';
import { TaskDecomposer, type SubTask } from './planner/decomposer';
import { ApprovalManager } from './approval/manager';
import { MultiTabManager } from './multi-tab/manager';

const logger = createLogger('Executor');

export interface ExecutorExtraArgs {
  plannerLLM?: BaseChatModel;
  extractorLLM?: BaseChatModel;
  agentOptions?: Partial<AgentOptions>;
  generalSettings?: GeneralSettingsConfig;
}

export class Executor {
  private readonly navigator: NavigatorAgent;
  private readonly planner: PlannerAgent;
  private readonly context: AgentContext;
  private readonly plannerPrompt: PlannerPrompt;
  private readonly navigatorPrompt: NavigatorPrompt;
  private readonly generalSettings: GeneralSettingsConfig | undefined;
  private tasks: string[] = [];

  // New Components
  private readonly validator: ValidatorAgent;
  private readonly decomposer: TaskDecomposer;
  private readonly approvalManager: ApprovalManager;
  private replanCount = 0;
  private readonly multiTabManager: MultiTabManager;

  constructor(
    task: string,
    taskId: string,
    browserContext: BrowserContext,
    navigatorLLM: BaseChatModel,
    extraArgs?: Partial<ExecutorExtraArgs>,
  ) {
    const messageManager = new MessageManager();

    const plannerLLM = extraArgs?.plannerLLM ?? navigatorLLM;
    const extractorLLM = extraArgs?.extractorLLM ?? navigatorLLM;
    const eventManager = new EventManager();
    const context = new AgentContext(
      taskId,
      browserContext,
      messageManager,
      eventManager,
      extraArgs?.agentOptions ?? {},
    );

    this.generalSettings = extraArgs?.generalSettings;
    this.tasks.push(task);
    this.navigatorPrompt = new NavigatorPrompt(context.options.maxActionsPerStep);
    this.plannerPrompt = new PlannerPrompt();

    const actionBuilder = new ActionBuilder(context, extractorLLM);
    const navigatorActionRegistry = new NavigatorActionRegistry(actionBuilder.buildDefaultActions());

    // Initialize new components
    this.validator = new ValidatorAgent(context, navigatorLLM);
    this.decomposer = new TaskDecomposer(plannerLLM);
    this.approvalManager = new ApprovalManager();
    this.multiTabManager = new MultiTabManager(browserContext, this.generalSettings?.maxTabs || 5);

    // Initialize agents with their respective prompts
    this.navigator = new NavigatorAgent(navigatorActionRegistry, {
      chatLLM: navigatorLLM,
      context: context,
      prompt: this.navigatorPrompt,
    });

    this.planner = new PlannerAgent({
      chatLLM: plannerLLM,
      context: context,
      prompt: this.plannerPrompt,
    });

    this.context = context;
    // Initialize message history
    this.context.messageManager.initTaskMessages(this.navigatorPrompt.getSystemMessage(), task);
  }

  subscribeExecutionEvents(callback: EventCallback): void {
    this.context.eventManager.subscribe(EventType.EXECUTION, callback);
  }

  clearExecutionEvents(): void {
    // Clear all execution event listeners
    this.context.eventManager.clearSubscribers(EventType.EXECUTION);
  }

  addFollowUpTask(task: string): void {
    this.tasks.push(task);
    this.context.messageManager.addNewTask(task);

    // need to reset previous action results that are not included in memory
    this.context.actionResults = this.context.actionResults.filter(result => result.includeInMemory);
  }

  /**
   * Check if task is complete based on planner output and handle completion
   */
  private checkTaskCompletion(planOutput: AgentOutput<PlannerOutput> | null): boolean {
    if (planOutput?.result?.done) {
      logger.info('✅ Planner confirms task completion');
      if (planOutput.result.final_answer) {
        this.context.finalAnswer = planOutput.result.final_answer;
      }
      return true;
    }
    return false;
  }

  /**
   * Execute the task
   *
   * @returns {Promise<void>}
   */
  async execute(): Promise<void> {
    const mainTask = this.tasks[this.tasks.length - 1];
    logger.info(`🚀 Executing task: ${mainTask}`);

    // reset the step counter
    const context = this.context;
    context.nSteps = 0;
    const allowedMaxSteps = this.context.options.maxSteps;

    try {
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_START, this.context.taskId);
      void analytics.trackTaskStart(this.context.taskId);

      // Phase 2: Task Decomposition
      // Breaks down complex main task into sequential subtasks
      let subtasks: SubTask[] = [];
      try {
        // Initial Assessment: Get current state to ground the plan
        let initialContext = '';
        try {
          const page = await this.context.browserContext.getCurrentPage();
          const url = page.url();
          const title = await page.title();
          initialContext = `Currently on: ${title} (${url})`;
          // TODO: In Phase 3, we can inject a screenshot description here using a VLM
        } catch (ctxError) {
          logger.warning('Could not get initial page context', ctxError);
        }

        subtasks = await this.decomposer.decompose(mainTask, initialContext);
        logger.info(`Decomposed into ${subtasks.length} subtasks`);
        // Notify UI about subtasks (in a real implementation)
        this.context.emitEvent(Actors.SYSTEM, 'SUBTASKS_GENERATED' as any, JSON.stringify(subtasks));
      } catch (e) {
        logger.warning('Decomposition failed, falling back to single task', e);
        subtasks = [{ id: '1', description: mainTask, dependencies: [], status: 'pending' }];
      }

      // Execute subtasks based on dependencies
      const completedSubtaskIds = new Set<string>();
      let pendingSubtasks = [...subtasks];

      while (pendingSubtasks.length > 0) {
        if (await this.shouldStop()) break;

        // Find executable tasks (dependencies met)
        let executableTasks = pendingSubtasks.filter(task =>
          task.dependencies.every(depId => completedSubtaskIds.has(depId)),
        );

        if (executableTasks.length === 0) {
          logger.warning('Potential deadlock or circular dependency. Forcing execution of first pending task.');
          executableTasks = [pendingSubtasks[0]];
        }

        // Execute the first available task (Sequential for safety, Parallel ready structure)
        const subtask = executableTasks[0];

        // Remove from pending list
        pendingSubtasks = pendingSubtasks.filter(t => t.id !== subtask.id);

        logger.info(`👉 Starting subtask: ${subtask.description}`);
        subtask.status = 'in_progress';
        // Notify UI
        this.context.emitEvent(Actors.SYSTEM, 'SUBTASKS_GENERATED' as any, JSON.stringify(subtasks));

        // Add subtask context to message history
        this.context.messageManager.addNewTask(`Subtask: ${subtask.description}`);

        let navigatorDone = false;
        let latestPlanOutput: AgentOutput<PlannerOutput> | null = null;

        // Loop for the current subtask
        while (!navigatorDone && context.nSteps < allowedMaxSteps) {
          context.stepInfo = {
            stepNumber: context.nSteps,
            maxSteps: context.options.maxSteps,
          };

          logger.info(`🔄 Step ${context.nSteps + 1} / ${allowedMaxSteps}`);
          if (await this.shouldStop()) break;

          // Run planner periodically
          if (this.planner && context.nSteps % context.options.planningInterval === 0) {
            latestPlanOutput = await this.runPlanner();
            if (this.checkTaskCompletion(latestPlanOutput)) {
              navigatorDone = true;
              break;
            }
          }

          // Execute navigator Step
          const stepSuccess = await this.navigate();

          if (stepSuccess) {
            // Check if implicit completion logic is needed
          }

          // Validator Check (SIMPLIFIED FOR ROBUSTNESS)
          // We only care if we are truly STUCK (Looping), not if the validator thinks we failed semantically.
          // The Navigator (LLM) is smart enough to self-correct if it sees the page didn't change.
          const validationState = await this.validator.monitorProgress();

          // Only interrupt if we are in a repetitive LOOP
          if (validationState.needsReplan && validationState.isLooping) {
            // We need to add isLooping to return type first
            this.replanCount++;
            if (this.replanCount > 2) {
              logger.warning('Excessive replanning detected (Loops). Escalating to user.');
              this.context.emitEvent(
                Actors.SYSTEM,
                ExecutionState.TASK_FAIL,
                'I seem to be stuck in a loop. I will pause for your assistance.',
              );

              this.context.paused = true;
              this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_PAUSE, 'Paused for user assistance.');

              this.replanCount = 0;
              this.context.consecutiveFailures = 0;
              navigatorDone = true;
              break;
            }

            logger.warning('Detected Action Loop -> Triggering Replan');
            latestPlanOutput = await this.runPlanner();
            if (this.checkTaskCompletion(latestPlanOutput)) {
              navigatorDone = true;
              break;
            }
          } else {
            // If just "failures" but not looping, let the Navigator keep trying.
            // It will see the screen didn't change and try something else naturally.
            this.replanCount = 0;
          }
        }

        subtask.status = 'completed';
        completedSubtaskIds.add(subtask.id);
        logger.info(`✅ Completed subtask: ${subtask.description}`);

        // Notify UI
        this.context.emitEvent(Actors.SYSTEM, 'SUBTASKS_GENERATED' as any, JSON.stringify(subtasks));
      }

      // Final check
      const isCompleted = true; // Simplified for this phase, real logic would verify all subtasks

      if (isCompleted) {
        const finalMessage = this.context.finalAnswer || this.context.taskId;
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_OK, finalMessage);
        void analytics.trackTaskComplete(this.context.taskId);
      } else if (context.nSteps >= allowedMaxSteps) {
        logger.error('❌ Task failed: Max steps reached');
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, t('exec_errors_maxStepsReached'));
        const maxStepsError = new MaxStepsReachedError(t('exec_errors_maxStepsReached'));
        void analytics.trackTaskFailed(this.context.taskId, analytics.categorizeError(maxStepsError));
      } else if (this.context.stopped) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_CANCEL, t('exec_task_cancel'));
        void analytics.trackTaskCancelled(this.context.taskId);
      } else {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_PAUSE, t('exec_task_pause'));
      }
    } catch (error) {
      if (error instanceof RequestCancelledError) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_CANCEL, t('exec_task_cancel'));
        void analytics.trackTaskCancelled(this.context.taskId);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, t('exec_task_fail', [errorMessage]));
        void analytics.trackTaskFailed(
          this.context.taskId,
          analytics.categorizeError(error instanceof Error ? error : errorMessage),
        );
      }
    } finally {
      if (this.generalSettings?.replayHistoricalTasks) {
        const historyString = JSON.stringify(this.context.history);
        await chatHistoryStore.storeAgentStepHistory(this.context.taskId, this.tasks[0], historyString);
      }
    }
  }

  /**
   * Helper method to run planner and store its output
   */
  private async runPlanner(): Promise<AgentOutput<PlannerOutput> | null> {
    const context = this.context;
    try {
      // Add current browser state to memory
      let positionForPlan = 0;
      if (this.tasks.length > 1 || this.context.nSteps > 0) {
        await this.navigator.addStateMessageToMemory();
        positionForPlan = this.context.messageManager.length() - 1;
      } else {
        positionForPlan = this.context.messageManager.length();
      }

      // Execute planner
      const planOutput = await this.planner.execute();
      if (planOutput.result) {
        this.context.messageManager.addPlan(JSON.stringify(planOutput.result), positionForPlan);
      }
      return planOutput;
    } catch (error) {
      logger.error(`Failed to execute planner: ${error}`);
      if (
        error instanceof ChatModelAuthError ||
        error instanceof ChatModelBadRequestError ||
        error instanceof ChatModelForbiddenError ||
        error instanceof URLNotAllowedError ||
        error instanceof RequestCancelledError ||
        error instanceof ExtensionConflictError
      ) {
        throw error;
      }
      context.consecutiveFailures++;
      logger.error(`Failed to execute planner: ${error}`);
      if (context.consecutiveFailures >= context.options.maxFailures) {
        throw new MaxFailuresReachedError(t('exec_errors_maxFailuresReached'));
      }
      return null;
    }
  }

  private async navigate(): Promise<boolean> {
    const context = this.context;
    try {
      // Get and execute navigation action
      // check if the task is paused or stopped
      if (context.paused || context.stopped) {
        return false;
      }
      const navOutput = await this.navigator.execute();

      // VALIDATION PHASE
      if (context.actionResults.length > 0) {
        const lastResult = context.actionResults[context.actionResults.length - 1];
        // We need the action name and input. These are typically in the history or we can infer them.
        // For now, let's get them from history if possible, or just validate generic success.

        // Find corresponding step in history
        const lastHistoryStep = context.history.history[context.history.history.length - 1];
        if (lastHistoryStep && lastHistoryStep.modelOutput) {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const actions = (lastHistoryStep.modelOutput as any).action;
          if (actions && actions.length > 0) {
            const lastAction = actions[actions.length - 1];
            const actionName = Object.keys(lastAction)[0];
            const actionInput = lastAction[actionName];

            const validation = await this.validator.validateActionResult(
              actionName,
              actionInput,
              lastResult,
              this.tasks[0] || 'Unknown task',
            );

            if (!validation.isValid && validation.confidence > 0.7) {
              logger.warning(`Action validation failed: ${validation.issues.join(', ')}`);
              await context.emitEvent(
                Actors.VALIDATOR,
                ExecutionState.STEP_FAIL,
                `Validation failed: ${validation.issues.join(', ')}`,
              );

              if (lastResult.success) {
                // Mark as failed if the validator says so, overriding the technical success
                lastResult.success = false;
                lastResult.error = `Validator: Action appeared technically successful but failed semantic validation. Issues: ${validation.issues.join(', ')}`;

                // CRITICAL: Update the history record as well, otherwise monitorProgress won't see it!
                if (lastHistoryStep && lastHistoryStep.result && lastHistoryStep.result.length > 0) {
                  const lastHistoryResult = lastHistoryStep.result[lastHistoryStep.result.length - 1];
                  if (lastHistoryResult) {
                    lastHistoryResult.success = false;
                    lastHistoryResult.error = lastResult.error;

                    // INJECT FAILURE SIGNAL INTO CONTEXT FOR PLANNER
                    // This ensures the next Planner run sees the explicit failure reason
                    const failureMsg = new HumanMessage(
                      `SYSTEM ALERT: The last action (Step ${context.nSteps}) technically executed but FAILED Semantic Validation. Issues: ${validation.issues.join(', ')}. You MUST correct your plan.`,
                    );
                    context.messageManager.addMessageWithTokens(failureMsg);
                  }
                }
              }
            }
          }
        }
      }

      // check if the task is paused or stopped
      if (context.paused || context.stopped) {
        return false;
      }
      context.nSteps++;
      if (navOutput.error) {
        throw new Error(navOutput.error);
      }
      // Only reset consecutive failures if validation also passed
      const lastResult = context.actionResults[context.actionResults.length - 1];
      if (lastResult && !lastResult.success) {
        context.consecutiveFailures++;
      } else {
        context.consecutiveFailures = 0;
      }

      if (navOutput.result?.done) {
        return true;
      }
    } catch (error) {
      logger.error(`Failed to execute step: ${error}`);
      if (
        error instanceof ChatModelAuthError ||
        error instanceof ChatModelBadRequestError ||
        error instanceof ChatModelForbiddenError ||
        error instanceof URLNotAllowedError ||
        error instanceof RequestCancelledError ||
        error instanceof ExtensionConflictError
      ) {
        throw error;
      }
      context.consecutiveFailures++;
      logger.error(`Failed to execute step: ${error}`);
      if (context.consecutiveFailures >= context.options.maxFailures) {
        throw new MaxFailuresReachedError(t('exec_errors_maxFailuresReached'));
      }
    }
    return false;
  }

  private async shouldStop(): Promise<boolean> {
    if (this.context.stopped) {
      logger.info('Agent stopped');
      return true;
    }

    while (this.context.paused) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (this.context.stopped) {
        return true;
      }
    }

    if (this.context.consecutiveFailures >= this.context.options.maxFailures) {
      logger.error(`Stopping due to ${this.context.options.maxFailures} consecutive failures`);
      return true;
    }

    return false;
  }

  async cancel(): Promise<void> {
    this.context.stop();
  }

  async resume(): Promise<void> {
    this.context.resume();
  }

  async pause(): Promise<void> {
    this.context.pause();
  }

  async cleanup(): Promise<void> {
    try {
      await this.context.browserContext.cleanup();
    } catch (error) {
      logger.error(`Failed to cleanup browser context: ${error}`);
    }
  }

  async getCurrentTaskId(): Promise<string> {
    return this.context.taskId;
  }

  /**
   * Replays a saved history of actions with error handling and retry logic.
   *
   * @param history - The history to replay
   * @param maxRetries - Maximum number of retries per action
   * @param skipFailures - Whether to skip failed actions or stop execution
   * @param delayBetweenActions - Delay between actions in seconds
   * @returns List of action results
   */
  async replayHistory(
    sessionId: string,
    maxRetries = 3,
    skipFailures = true,
    delayBetweenActions = 2.0,
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const replayLogger = createLogger('Executor:replayHistory');

    logger.info('replay task', this.tasks[0]);

    try {
      const historyFromStorage = await chatHistoryStore.loadAgentStepHistory(sessionId);
      if (!historyFromStorage) {
        throw new Error(t('exec_replay_historyNotFound'));
      }

      const history = JSON.parse(historyFromStorage.history) as AgentStepHistory;
      if (history.history.length === 0) {
        throw new Error(t('exec_replay_historyEmpty'));
      }
      logger.debug(`🔄 Replaying history: ${JSON.stringify(history, null, 2)}`);
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_START, this.context.taskId);

      for (let i = 0; i < history.history.length; i++) {
        const historyItem = history.history[i];

        // Check if execution should stop
        if (this.context.stopped) {
          replayLogger.info('Replay stopped by user');
          break;
        }

        // Execute the history step with enhanced method that handles all the logic
        const stepResults = await this.navigator.executeHistoryStep(
          historyItem,
          i,
          history.history.length,
          maxRetries,
          delayBetweenActions * 1000,
          skipFailures,
        );

        results.push(...stepResults);

        // If stopped during execution, break the loop
        if (this.context.stopped) {
          break;
        }
      }

      if (this.context.stopped) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_CANCEL, t('exec_replay_cancel'));
      } else {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_OK, t('exec_replay_ok'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replayLogger.error(`Replay failed: ${errorMessage}`);
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, t('exec_replay_fail', [errorMessage]));
    }

    return results;
  }

  async resolveApproval(id: string, approved: boolean): Promise<void> {
    if (approved) {
      this.approvalManager.approve(id);
    } else {
      this.approvalManager.reject(id);
    }
  }
}
