import React from 'react';

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface TaskMonitorProps {
  subtasks: SubTask[];
  onValidationStatus?: (status: 'valid' | 'invalid' | 'checking') => void;
}

export const TaskMonitor: React.FC<TaskMonitorProps> = ({ subtasks }) => {
  if (subtasks.length === 0) return null;

  return (
    <div className="task-monitor glass-panel">
      <div className="task-monitor-header">
        <span className="task-monitor-title">Plan</span>
        <span className="task-monitor-count">
          {subtasks.filter(t => t.status === 'completed').length}/{subtasks.length}
        </span>
      </div>
      <div className="task-list">
        {subtasks.map(task => (
          <div key={task.id} className={`task-item ${task.status}`}>
            <div className="task-status-icon">
              {task.status === 'completed' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {task.status === 'in_progress' && <div className="spinner-dot"></div>}
              {task.status === 'pending' && <div className="pending-dot"></div>}
              {task.status === 'failed' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>
            <span className="task-desc">{task.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
