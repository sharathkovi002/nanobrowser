import React, { useEffect, useState } from 'react';

interface AgentEvent {
  actor: string;
  state: 'START' | 'OK' | 'FAIL' | 'CANCEL' | 'TASK_START' | 'TASK_OK' | 'TASK_FAIL';
  data: {
    details: string;
    taskId?: string;
    step?: number;
    maxSteps?: number;
  };
}

const Overlay: React.FC = () => {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const listener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'AGENT_EVENT') {
        const event = message.payload as AgentEvent;
        // console.log('HUD Event:', event);

        setEvents(prev => [...prev.slice(-4), event]); // Keep last 5 events
        setIsVisible(true);

        // Auto-hide handling could be added here
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (!isVisible && events.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end',
        padding: '20px',
        position: 'fixed',
        bottom: '0',
        right: '0',
        zIndex: 999999,
      }}>
      {events.map((event, i) => (
        <EventPill key={i} event={event} />
      ))}
    </div>
  );
};

const EventPill: React.FC<{ event: AgentEvent }> = ({ event }) => {
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounting(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const getColors = (state: string) => {
    switch (state) {
      case 'FAIL':
      case 'TASK_FAIL':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#fca5a5' };
      case 'OK':
      case 'TASK_OK':
        return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)', text: '#86efac' };
      default:
        return { bg: 'rgba(0, 0, 0, 0.6)', border: 'rgba(255, 255, 255, 0.1)', text: '#e5e7eb' };
    }
  };

  const colors = getColors(event.state);
  const icon = event.actor === 'navigator' ? '🧭' : event.actor === 'planner' ? '🧠' : '🤖';

  return (
    <div
      style={{
        background: colors.bg,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${colors.border}`,
        color: colors.text,
        padding: '12px 16px',
        borderRadius: '16px',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        maxWidth: '320px',
        transform: isMounting ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)',
        opacity: isMounting ? 0 : 1,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
          {event.actor} • {event.state}
        </span>
        <span>{event.data.details}</span>
      </div>
    </div>
  );
};

export default Overlay;
