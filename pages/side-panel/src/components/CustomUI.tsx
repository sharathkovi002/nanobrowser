import React, { useState, useRef, useEffect } from 'react';
import '../styles/custom-ui.css';

interface CustomUIProps {
  onSendMessage: (text: string) => void;
  inputEnabled: boolean;
  isRunning: boolean;
  onOpenSettings: () => void;
}

export const CustomUI: React.FC<CustomUIProps> = ({ onSendMessage, inputEnabled, isRunning, onOpenSettings }) => {
  const [inputText, setInputText] = useState('');
  const [agentState, setAgentState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update agent state based on isRunning prop
  useEffect(() => {
    if (isRunning) {
      setAgentState('thinking');
      // Simulate transition to speaking after 2 seconds
      const timer = setTimeout(() => {
        setAgentState('speaking');
      }, 2000);
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
      // Clicking the orb when running could stop it (optional)
      // For now, do nothing
    }
  };

  return (
    <div className="agent-container">
      {/* Main Morphing Component */}
      <div className={`morphing-agent glass-style ${isRunning ? 'is-running' : ''}`} onClick={handleContainerClick}>
        {/* Search Input */}
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
          <button className="internal-settings-btn" onClick={onOpenSettings} title="Preferences">
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
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 5 13.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        {/* Visuals */}
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
