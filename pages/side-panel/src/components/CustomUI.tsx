import React, { useState, useRef, useEffect } from 'react';
import '../styles/custom-ui.css';
import { TaskMonitor, SubTask } from './TaskMonitor';

interface CustomUIProps {
  onSendMessage: (text: string) => void;
  inputEnabled: boolean;
  isRunning: boolean;
  onOpenSettings: () => void;
  subtasks?: SubTask[];
  approvalRequest?: { id: string; description: string } | null;
  onResolveApproval?: (id: string, approved: boolean) => void;
}

export const CustomUI: React.FC<CustomUIProps> = ({
  onSendMessage,
  inputEnabled,
  isRunning,
  onOpenSettings,
  subtasks = [],
  approvalRequest,
  onResolveApproval,
}) => {
  const [inputText, setInputText] = useState('');
  const [agentState, setAgentState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update agent state based on isRunning prop
  useEffect(() => {
    if (isRunning) {
      setAgentState('thinking');
      // Simulate transition to speaking/working after a bit
      const timer = setTimeout(() => {
        setAgentState('speaking');
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setAgentState('idle');
    }
  }, [isRunning]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputText.trim() && inputEnabled) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleContainerClick = () => {
    if (isRunning) {
      // Logic for clicking whilst running (optional, maybe pause?)
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="agent-container">
      {/* Task Monitor Overlay (Phase 3) */}
      {isRunning && subtasks.length > 0 && <TaskMonitor subtasks={subtasks} />}

      {/* Approval Overlay (Phase 2) */}
      {approvalRequest && (
        <div
          style={{
            position: 'absolute',
            top: '-200px', // Position above the orb
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 30, 35, 0.95)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1000,
            color: 'white',
            width: '320px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>Approval Required</h3>
          <p style={{ fontSize: '14px', marginBottom: '20px', opacity: 0.8, lineHeight: '1.4' }}>
            {approvalRequest.description}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => onResolveApproval?.(approvalRequest.id, false)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: 'rgba(255, 68, 68, 0.2)',
                color: '#ff4444',
                cursor: 'pointer',
                fontWeight: 600,
                border: '1px solid rgba(255, 68, 68, 0.3)',
              }}>
              Reject
            </button>
            <button
              onClick={() => onResolveApproval?.(approvalRequest.id, true)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: 'rgba(68, 255, 68, 0.2)',
                color: '#44ff44',
                cursor: 'pointer',
                fontWeight: 600,
                border: '1px solid rgba(68, 255, 68, 0.3)',
              }}>
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Main Morphing Component (Restored UI) */}
      <div className={`morphing-agent glass-style ${isRunning ? 'is-running' : ''}`} onClick={handleContainerClick}>
        {/* Search Input (Visible when idle) */}
        <div className="input-content">
          <div className="search-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            className="agent-input"
            placeholder="How can I help you today?"
            autoComplete="off"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!inputEnabled}
          />
          <button
            className="internal-settings-btn"
            onClick={e => {
              e.stopPropagation();
              onOpenSettings();
            }}
            title="Preferences">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>

        {/* Siri Visuals (Visible when running) */}
        <div className="siri-visuals">
          <div className={`siri-mesh-container ${agentState}`}>
            <div className="mesh-blob-1"></div>
            <div className="mesh-blob-2"></div>
            <div className="mesh-blob-3"></div>
            <div className="siri-core"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
