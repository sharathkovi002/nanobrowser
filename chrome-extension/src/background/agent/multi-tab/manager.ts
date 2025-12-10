/**
 * Multi-Tab Manager - Phase 1
 * Manages multiple browser tabs for parallel task execution
 */

import type BrowserContext from '../../browser/context';
import { createLogger } from '@src/background/log';

const logger = createLogger('MultiTabManager');

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  status: 'idle' | 'working' | 'completed' | 'failed';
  createdAt: number;
  lastActivity: number;
}

export interface TabContext {
  tabId: string;
  browserContext: BrowserContext;
  taskId: string | null;
  status: TabInfo['status'];
}

export class MultiTabManager {
  private tabs: Map<string, TabContext> = new Map();
  private maxConcurrentTabs: number;
  private mainBrowserContext: BrowserContext;

  constructor(mainBrowserContext: BrowserContext, maxConcurrentTabs: number = 5) {
    this.mainBrowserContext = mainBrowserContext;
    this.maxConcurrentTabs = maxConcurrentTabs;
    logger.info(`MultiTabManager initialized with max ${maxConcurrentTabs} concurrent tabs`);
  }

  /**
   * Get current tab count
   */
  getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Get available (idle) tab count
   */
  getAvailableTabCount(): number {
    return Array.from(this.tabs.values()).filter(tab => tab.status === 'idle').length;
  }

  /**
   * Get working tab count
   */
  getWorkingTabCount(): number {
    return Array.from(this.tabs.values()).filter(tab => tab.status === 'working').length;
  }

  /**
   * Check if we can create more tabs
   */
  canCreateTab(): boolean {
    return this.tabs.size < this.maxConcurrentTabs;
  }

  /**
   * Create a new tab
   */
  async createTab(url?: string): Promise<TabContext> {
    if (!this.canCreateTab()) {
      throw new Error(`Maximum concurrent tabs (${this.maxConcurrentTabs}) reached`);
    }

    // For Phase 1, we'll use the main browser context
    // In Phase 2, we'll create isolated browser contexts
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tabContext: TabContext = {
      tabId,
      browserContext: this.mainBrowserContext,
      taskId: null,
      status: 'idle',
    };

    this.tabs.set(tabId, tabContext);
    logger.info(`Created tab ${tabId}`);

    if (url) {
      const page = await this.mainBrowserContext.getCurrentPage();
      await page.navigateTo(url);
    }

    return tabContext;
  }

  /**
   * Get an available tab or create a new one
   */
  async getOrCreateTab(url?: string): Promise<TabContext> {
    // Try to find an idle tab
    const idleTab = Array.from(this.tabs.values()).find(tab => tab.status === 'idle');

    if (idleTab) {
      logger.info(`Reusing idle tab ${idleTab.tabId}`);
      if (url) {
        const page = await idleTab.browserContext.getCurrentPage();
        await page.navigateTo(url);
      }
      return idleTab;
    }

    // Create new tab if possible
    if (this.canCreateTab()) {
      return await this.createTab(url);
    }

    // Wait for a tab to become available
    logger.info('All tabs busy, waiting for available tab...');
    return await this.waitForAvailableTab();
  }

  /**
   * Wait for a tab to become available
   */
  private async waitForAvailableTab(timeout: number = 30000): Promise<TabContext> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const idleTab = Array.from(this.tabs.values()).find(tab => tab.status === 'idle');
      if (idleTab) {
        return idleTab;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Timeout waiting for available tab');
  }

  /**
   * Assign a task to a tab
   */
  async assignTask(tabId: string, taskId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    tab.taskId = taskId;
    tab.status = 'working';
    logger.info(`Assigned task ${taskId} to tab ${tabId}`);
  }

  /**
   * Mark tab as completed
   */
  async completeTask(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    tab.status = 'completed';
    tab.taskId = null;
    logger.info(`Tab ${tabId} completed task`);

    // Reset to idle after a short delay
    setTimeout(() => {
      if (tab.status === 'completed') {
        tab.status = 'idle';
      }
    }, 1000);
  }

  /**
   * Mark tab as failed
   */
  async failTask(tabId: string, error: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    tab.status = 'failed';
    logger.error(`Tab ${tabId} failed: ${error}`);

    // Reset to idle after a short delay
    setTimeout(() => {
      if (tab.status === 'failed') {
        tab.status = 'idle';
        tab.taskId = null;
      }
    }, 2000);
  }

  /**
   * Get tab by ID
   */
  getTab(tabId: string): TabContext | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all tabs
   */
  getAllTabs(): TabContext[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get tab info
   */
  async getTabInfo(): Promise<TabInfo[]> {
    const infos: TabInfo[] = [];

    for (const [id, tab] of this.tabs.entries()) {
      const page = await tab.browserContext.getCurrentPage();
      infos.push({
        id,
        url: page.url(),
        title: '', // Will be populated in Phase 2
        status: tab.status,
        createdAt: 0, // Will be tracked in Phase 2
        lastActivity: Date.now(),
      });
    }
    return infos;
  }

  /**
   * Close a specific tab
   */
  async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    this.tabs.delete(tabId);
    logger.info(`Closed tab ${tabId}`);
  }

  /**
   * Close all tabs
   */
  async closeAllTabs(): Promise<void> {
    logger.info(`Closing all ${this.tabs.size} tabs`);
    this.tabs.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.tabs.size,
      idle: this.getAvailableTabCount(),
      working: this.getWorkingTabCount(),
      completed: Array.from(this.tabs.values()).filter(tab => tab.status === 'completed').length,
      failed: Array.from(this.tabs.values()).filter(tab => tab.status === 'failed').length,
      maxConcurrent: this.maxConcurrentTabs,
    };
  }
}
