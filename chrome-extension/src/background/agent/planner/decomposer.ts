/**
 * Task Decomposer - Breaks complex goals into subtasks
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { createLogger } from '@src/background/log';

const logger = createLogger('TaskDecomposer');

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export class TaskDecomposer {
  private llm: BaseChatModel;

  constructor(llm: BaseChatModel) {
    this.llm = llm;
  }

  async decompose(goal: string, context?: string): Promise<SubTask[]> {
    logger.info(`Decomposing goal: ${goal}`);

    const promptTemplate = PromptTemplate.fromTemplate(`
      You are an expert Autonomous Agent Planner.
      Your goal is to create a detailed, unbreakable plan for the following objective.
      
      Objective: {goal}
      ${context ? `Current Context: {context}` : ''}
      
      # Instructions
      1. Analyze the user's intent deeply. What is the implied final state?
      2. If the task is complex, DO NOT limit yourself to 3-5 steps. Create as many steps as necessary to ensure robustness.
      3. Think about potential failure modes (popups, login screens, empty search results) and include steps to handle them or verify success.
      4. Break the task down into logical, sequential subtasks.
      
      # Output Format
      Return ONLY a JSON array of objects.
      [
        {{
          "id": "1",
          "description": "Detailed description of the first subtask",
          "dependencies": []
        }},
        {{
          "id": "2",
          "description": "Detailed description of the second subtask",
          "dependencies": ["1"]
        }}
      ]
    `);

    try {
      const response = await this.llm.invoke(await promptTemplate.format({ goal, context: context || '' }));
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : content;

      const subtasks = JSON.parse(jsonStr) as Omit<SubTask, 'status'>[];

      return subtasks.map(t => ({
        ...t,
        status: 'pending',
      }));
    } catch (error) {
      logger.error('Failed to decompose task', error);
      // Fallback: Return single task
      return [
        {
          id: '1',
          description: goal,
          dependencies: [],
          status: 'pending',
        },
      ];
    }
  }
}
