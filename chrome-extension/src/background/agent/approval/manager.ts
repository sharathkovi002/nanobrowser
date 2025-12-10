/**
 * Approval Manager - Human-in-the-Loop Workflow
 * Manages sensitive actions requiring user confirmation
 */

import { createLogger } from '@src/background/log';

const logger = createLogger('ApprovalManager');

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  action: string;
  params: unknown;
  reason: string;
  status: ApprovalStatus;
  timestamp: number;
}

export class ApprovalManager {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private sensitiveActions: Set<string> = new Set([
    'upload_file',
    'delete_data',
    'submit_form', // potentially sensitive
    'payment',
  ]);

  constructor() {
    logger.info('ApprovalManager initialized');
  }

  isSensitiveAction(actionName: string): boolean {
    return this.sensitiveActions.has(actionName);
  }

  async requestApproval(action: string, params: unknown, reason: string): Promise<ApprovalRequest> {
    const id = Math.random().toString(36).substring(7);
    const request: ApprovalRequest = {
      id,
      action,
      params,
      reason,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.pendingApprovals.set(id, request);
    logger.info(`Created approval request ${id} for action ${action}`);

    // In a real implementation: emit event to UI to show modal
    return request;
  }

  async waitForApproval(requestId: string, timeoutMs = 60000): Promise<ApprovalStatus> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const request = this.pendingApprovals.get(requestId);

        if (!request) {
          clearInterval(checkInterval);
          resolve('rejected'); // Request disappeared
          return;
        }

        if (request.status !== 'pending') {
          clearInterval(checkInterval);
          resolve(request.status);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          request.status = 'rejected';
          resolve('rejected');
        }
      }, 500);
    });
  }

  approve(requestId: string): void {
    const request = this.pendingApprovals.get(requestId);
    if (request) {
      request.status = 'approved';
      logger.info(`Approved request ${requestId}`);
    }
  }

  reject(requestId: string): void {
    const request = this.pendingApprovals.get(requestId);
    if (request) {
      request.status = 'rejected';
      logger.info(`Rejected request ${requestId}`);
    }
  }
}
