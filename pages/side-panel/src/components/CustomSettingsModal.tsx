import React, { useState, useEffect } from 'react';
import '../styles/custom-ui.css';
import { llmProviderStore, type ProviderConfig } from '@extension/storage/lib/settings/llmProviders';
import { agentModelStore, type ModelConfig } from '@extension/storage/lib/settings/agentModels';
import { generalSettingsStore } from '@extension/storage/lib/settings/generalSettings';
import { AgentNameEnum, ProviderTypeEnum } from '@extension/storage/lib/settings/types';

interface CustomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'models' | 'providers' | 'firewall';

// Available provider types
const AVAILABLE_PROVIDERS = [
  { id: ProviderTypeEnum.OpenAI, name: 'OpenAI' },
  { id: ProviderTypeEnum.Anthropic, name: 'Anthropic' },
  { id: ProviderTypeEnum.DeepSeek, name: 'DeepSeek' },
  { id: ProviderTypeEnum.Gemini, name: 'Gemini' },
  { id: ProviderTypeEnum.Grok, name: 'Grok' },
  { id: ProviderTypeEnum.Ollama, name: 'Ollama' },
  { id: ProviderTypeEnum.AzureOpenAI, name: 'Azure OpenAI' },
];

export const CustomSettingsModal: React.FC<CustomSettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // General Settings State
  const [maxSteps, setMaxSteps] = useState(100);
  const [maxActions, setMaxActions] = useState(5);
  const [failureTolerance, setFailureTolerance] = useState(3);
  const [enableVision, setEnableVision] = useState(true);
  const [displayHighlights, setDisplayHighlights] = useState(true);
  const [replanningFrequency, setReplanningFrequency] = useState(3);
  const [pageLoadWait, setPageLoadWait] = useState(250);
  const [replayTasks, setReplayTasks] = useState(false);

  // Provider Management State
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<{
    id: string;
    apiKey: string;
    models: string[];
    showApiKey: boolean;
  } | null>(null);
  const [modelInput, setModelInput] = useState('');

  // Model Settings State
  const [plannerConfig, setPlannerConfig] = useState<ModelConfig | null>(null);
  const [navigatorConfig, setNavigatorConfig] = useState<ModelConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadAllSettings();
    }
  }, [isOpen]);

  const loadAllSettings = async () => {
    try {
      // Load general settings
      const genSettings = await generalSettingsStore.getSettings();
      setMaxSteps(genSettings.maxSteps);
      setMaxActions(genSettings.maxActionsPerStep);
      setFailureTolerance(genSettings.maxFailures);
      setEnableVision(genSettings.useVision);
      setDisplayHighlights(genSettings.displayHighlights);
      setReplanningFrequency(genSettings.planningInterval);
      setPageLoadWait(genSettings.minWaitPageLoad);
      setReplayTasks(genSettings.replayHistoricalTasks);

      // Load providers
      const allProviders = await llmProviderStore.getAllProviders();
      setProviders(allProviders);

      // Load agent models
      const planner = await agentModelStore.getAgentModel(AgentNameEnum.Planner);
      const navigator = await agentModelStore.getAgentModel(AgentNameEnum.Navigator);
      setPlannerConfig(planner || null);
      setNavigatorConfig(navigator || null);

      // Build available models list from all configured providers
      const models: string[] = [];
      Object.values(allProviders).forEach(provider => {
        if (provider.modelNames) {
          models.push(...provider.modelNames);
        }
        if (provider.azureDeploymentNames) {
          models.push(...provider.azureDeploymentNames);
        }
      });
      setAvailableModels([...new Set(models)]);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Save general settings
  const saveGeneralSetting = async (key: string, value: any) => {
    try {
      const current = await generalSettingsStore.getSettings();
      await generalSettingsStore.setSettings({
        ...current,
        [key]: value,
      });
    } catch (error) {
      console.error('Error saving general setting:', error);
    }
  };

  // Provider Management Functions
  const handleAddProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    setEditingProvider({
      id: providerId,
      apiKey: '',
      models: [],
      showApiKey: false,
    });
  };

  const handleSaveProvider = async () => {
    if (!editingProvider) return;

    try {
      const config: ProviderConfig = {
        apiKey: editingProvider.apiKey,
        modelNames: editingProvider.models,
        createdAt: Date.now(),
      };

      await llmProviderStore.setProvider(editingProvider.id, config);

      // Reload providers
      const allProviders = await llmProviderStore.getAllProviders();
      setProviders(allProviders);

      // Update available models
      const models: string[] = [];
      Object.values(allProviders).forEach(provider => {
        if (provider.modelNames) {
          models.push(...provider.modelNames);
        }
      });
      setAvailableModels([...new Set(models)]);

      // Close editing
      setEditingProvider(null);
      setSelectedProvider(null);
    } catch (error) {
      console.error('Error saving provider:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save provider'}`);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm(`Delete ${providers[providerId]?.name || providerId}?`)) return;

    try {
      await llmProviderStore.removeProvider(providerId);
      const allProviders = await llmProviderStore.getAllProviders();
      setProviders(allProviders);
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const handleAddModel = () => {
    if (!editingProvider || !modelInput.trim()) return;

    setEditingProvider({
      ...editingProvider,
      models: [...editingProvider.models, modelInput.trim()],
    });
    setModelInput('');
  };

  const handleRemoveModel = (model: string) => {
    if (!editingProvider) return;

    setEditingProvider({
      ...editingProvider,
      models: editingProvider.models.filter(m => m !== model),
    });
  };

  // Model Configuration Functions
  const handleModelChange = async (agent: AgentNameEnum, field: string, value: any) => {
    try {
      const currentConfig = agent === AgentNameEnum.Planner ? plannerConfig : navigatorConfig;
      if (!currentConfig) return;

      const updatedConfig = {
        ...currentConfig,
        parameters: {
          ...currentConfig.parameters,
          [field]: value,
        },
      };

      await agentModelStore.setAgentModel(agent, updatedConfig);

      if (agent === AgentNameEnum.Planner) {
        setPlannerConfig(updatedConfig);
      } else {
        setNavigatorConfig(updatedConfig);
      }
    } catch (error) {
      console.error('Error updating model config:', error);
    }
  };

  const handleSelectModel = async (agent: AgentNameEnum, modelName: string) => {
    try {
      // Find which provider has this model
      let selectedProvider = '';
      for (const [providerId, provider] of Object.entries(providers)) {
        if (provider.modelNames?.includes(modelName) || provider.azureDeploymentNames?.includes(modelName)) {
          selectedProvider = providerId;
          break;
        }
      }

      if (!selectedProvider) {
        alert('Provider not found for this model');
        return;
      }

      const currentConfig = agent === AgentNameEnum.Planner ? plannerConfig : navigatorConfig;
      const newConfig: ModelConfig = {
        provider: selectedProvider,
        modelName: modelName,
        parameters: currentConfig?.parameters || { temperature: 0.7, topP: 0.9 },
      };

      await agentModelStore.setAgentModel(agent, newConfig);

      if (agent === AgentNameEnum.Planner) {
        setPlannerConfig(newConfig);
      } else {
        setNavigatorConfig(newConfig);
      }
    } catch (error) {
      console.error('Error selecting model:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`settings-modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="settings-content glass-style" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="section-group-title" style={{ marginBottom: '20px', color: 'white' }}>
            SETTINGS
          </div>
          <div className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 5 13.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            General
          </div>
          <div className={`tab-btn ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Models
          </div>
          <div
            className={`tab-btn ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            LLM Providers
          </div>
          <div
            className={`tab-btn ${activeTab === 'firewall' ? 'active' : ''}`}
            onClick={() => setActiveTab('firewall')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Firewall
          </div>
        </div>

        {/* Main Panel */}
        <div className="settings-main">
          <div className="close-btn-absolute" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="tab-content active">
              <h2 className="section-title">General</h2>

              <div className="glass-panel p-4 mb-4">
                <div className="form-row">
                  <div>
                    <div className="label-text">Max Steps per Task</div>
                    <div className="label-desc">Step limit per task</div>
                  </div>
                  <input
                    type="number"
                    className="input-number"
                    value={maxSteps}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setMaxSteps(val);
                      saveGeneralSetting('maxSteps', val);
                    }}
                  />
                </div>
                <div className="form-row">
                  <div>
                    <div className="label-text">Max Actions per Step</div>
                    <div className="label-desc">Action limit per step</div>
                  </div>
                  <input
                    type="number"
                    className="input-number"
                    value={maxActions}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setMaxActions(val);
                      saveGeneralSetting('maxActionsPerStep', val);
                    }}
                  />
                </div>
                <div className="form-row">
                  <div>
                    <div className="label-text">Failure Tolerance</div>
                    <div className="label-desc">How many consecutive failures before stopping</div>
                  </div>
                  <input
                    type="number"
                    className="input-number"
                    value={failureTolerance}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFailureTolerance(val);
                      saveGeneralSetting('maxFailures', val);
                    }}
                  />
                </div>
              </div>

              <div className="glass-panel p-4 mb-4">
                <div className="form-row">
                  <div>
                    <div className="label-text">Enable Vision</div>
                    <div className="label-desc">Use vision capability of LLMs (consumes more tokens)</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={enableVision}
                      onChange={e => {
                        setEnableVision(e.target.checked);
                        saveGeneralSetting('useVision', e.target.checked);
                      }}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="form-row">
                  <div>
                    <div className="label-text">Display Highlights</div>
                    <div className="label-desc">Show visual highlights on interactive elements</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={displayHighlights}
                      onChange={e => {
                        setDisplayHighlights(e.target.checked);
                        saveGeneralSetting('displayHighlights', e.target.checked);
                      }}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="glass-panel p-4">
                <div className="form-row">
                  <div>
                    <div className="label-text">Replanning Frequency</div>
                    <div className="label-desc">Reconsider and update the plan every [Number] steps</div>
                  </div>
                  <input
                    type="number"
                    className="input-number"
                    value={replanningFrequency}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setReplanningFrequency(val);
                      saveGeneralSetting('planningInterval', val);
                    }}
                  />
                </div>
                <div className="form-row">
                  <div>
                    <div className="label-text">Page Load Wait Time</div>
                    <div className="label-desc">Minimum wait time after page loads (250-5000ms)</div>
                  </div>
                  <input
                    type="number"
                    className="input-number"
                    value={pageLoadWait}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setPageLoadWait(val);
                      saveGeneralSetting('minWaitPageLoad', val);
                    }}
                  />
                </div>
                <div className="form-row">
                  <div>
                    <div className="label-text">Replay Historical Tasks (Experimental)</div>
                    <div className="label-desc">Enable storing and replaying of agent step history</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={replayTasks}
                      onChange={e => {
                        setReplayTasks(e.target.checked);
                        saveGeneralSetting('replayHistoricalTasks', e.target.checked);
                      }}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className="tab-content active">
              <h2 className="section-title">Model Selection</h2>

              {/* Planner Section */}
              <div className="section-group-title">PLANNER</div>
              <div className="glass-panel p-4 mb-4">
                <div className="label-desc mb-4">Develops and refines strategies to complete tasks</div>
                <div className="form-row">
                  <div className="label-text">Model</div>
                  <select
                    className="select-styled"
                    value={plannerConfig?.modelName || ''}
                    onChange={e => handleSelectModel(AgentNameEnum.Planner, e.target.value)}>
                    <option value="">Select a Model...</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                {plannerConfig && (
                  <>
                    <div className="form-row">
                      <div className="label-text">Temperature</div>
                      <div className="range-container">
                        <input
                          type="range"
                          className="range-slider"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(plannerConfig.parameters?.temperature as number) || 0.7}
                          onChange={e =>
                            handleModelChange(AgentNameEnum.Planner, 'temperature', Number(e.target.value))
                          }
                        />
                        <input
                          type="number"
                          className="input-number"
                          value={(plannerConfig.parameters?.temperature as number) || 0.7}
                          onChange={e =>
                            handleModelChange(AgentNameEnum.Planner, 'temperature', Number(e.target.value))
                          }
                          style={{ width: '60px' }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="label-text">Top P</div>
                      <div className="range-container">
                        <input
                          type="range"
                          className="range-slider"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(plannerConfig.parameters?.topP as number) || 0.9}
                          onChange={e => handleModelChange(AgentNameEnum.Planner, 'topP', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          className="input-number"
                          value={(plannerConfig.parameters?.topP as number) || 0.9}
                          onChange={e => handleModelChange(AgentNameEnum.Planner, 'topP', Number(e.target.value))}
                          style={{ width: '60px' }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Navigator Section */}
              <div className="section-group-title">NAVIGATOR</div>
              <div className="glass-panel p-4 mb-4">
                <div className="label-desc mb-4">Navigates websites and performs actions</div>
                <div className="form-row">
                  <div className="label-text">Model</div>
                  <select
                    className="select-styled"
                    value={navigatorConfig?.modelName || ''}
                    onChange={e => handleSelectModel(AgentNameEnum.Navigator, e.target.value)}>
                    <option value="">Select a Model...</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                {navigatorConfig && (
                  <>
                    <div className="form-row">
                      <div className="label-text">Temperature</div>
                      <div className="range-container">
                        <input
                          type="range"
                          className="range-slider"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(navigatorConfig.parameters?.temperature as number) || 0.3}
                          onChange={e =>
                            handleModelChange(AgentNameEnum.Navigator, 'temperature', Number(e.target.value))
                          }
                        />
                        <input
                          type="number"
                          className="input-number"
                          value={(navigatorConfig.parameters?.temperature as number) || 0.3}
                          onChange={e =>
                            handleModelChange(AgentNameEnum.Navigator, 'temperature', Number(e.target.value))
                          }
                          style={{ width: '60px' }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="label-text">Top P</div>
                      <div className="range-container">
                        <input
                          type="range"
                          className="range-slider"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(navigatorConfig.parameters?.topP as number) || 0.85}
                          onChange={e => handleModelChange(AgentNameEnum.Navigator, 'topP', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          className="input-number"
                          value={(navigatorConfig.parameters?.topP as number) || 0.85}
                          onChange={e => handleModelChange(AgentNameEnum.Navigator, 'topP', Number(e.target.value))}
                          style={{ width: '60px' }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* STT Section */}
              <div className="section-group-title">SPEECH-TO-TEXT MODEL</div>
              <div className="glass-panel p-4">
                <div className="label-desc mb-4">Configure the model used for converting speech to text</div>
                <div className="form-row">
                  <div className="label-text">Model</div>
                  <select className="select-styled">
                    <option value="">Select a Model...</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* LLM Providers Tab */}
          {activeTab === 'providers' && (
            <div className="tab-content active">
              <h2 className="section-title">LLM Providers</h2>

              {!editingProvider && Object.keys(providers).length === 0 && (
                <div className="glass-panel p-6 text-center mb-4">
                  <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
                    No providers configured yet. Add a provider to get started.
                  </div>
                </div>
              )}

              {!editingProvider && (
                <div className="glass-panel p-4 mb-4">
                  {AVAILABLE_PROVIDERS.map(provider => (
                    <div
                      key={provider.id}
                      className="provider-item"
                      onClick={() => {
                        const existing = providers[provider.id];
                        if (existing) {
                          setEditingProvider({
                            id: provider.id,
                            apiKey: existing.apiKey,
                            models: existing.modelNames || [],
                            showApiKey: false,
                          });
                        } else {
                          handleAddProvider(provider.id);
                        }
                      }}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        background: providers[provider.id] ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                      <span>{provider.name}</span>
                      {providers[provider.id] && (
                        <span style={{ fontSize: '12px', color: 'rgba(34, 197, 94, 0.8)' }}>✓ Configured</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editingProvider && (
                <div className="glass-panel p-6">
                  <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '20px' }}>
                    {AVAILABLE_PROVIDERS.find(p => p.id === editingProvider.id)?.name}
                  </h3>
                  <p style={{ color: 'rgba(34, 197, 94, 0.8)', marginBottom: '24px', fontSize: '14px' }}>
                    Enter your API key and click Save to set it up.
                  </p>

                  <div style={{ marginBottom: '24px' }}>
                    <div className="label-text" style={{ marginBottom: '8px' }}>
                      API Key*
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={editingProvider.showApiKey ? 'text' : 'password'}
                        className="input-styled"
                        placeholder="API Key (required)"
                        value={editingProvider.apiKey}
                        onChange={e => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                        style={{ width: '100%', paddingRight: '40px' }}
                      />
                      <button
                        onClick={() =>
                          setEditingProvider({ ...editingProvider, showApiKey: !editingProvider.showApiKey })
                        }
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}>
                        {editingProvider.showApiKey ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <div className="label-text" style={{ marginBottom: '8px' }}>
                      Models
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      {editingProvider.models.map(model => (
                        <span
                          key={model}
                          style={{
                            display: 'inline-block',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            borderRadius: '16px',
                            padding: '4px 12px',
                            margin: '4px',
                            color: 'white',
                            fontSize: '13px',
                          }}>
                          {model}
                          <button
                            onClick={() => handleRemoveModel(model)}
                            style={{
                              marginLeft: '8px',
                              background: 'none',
                              border: 'none',
                              color: 'rgba(255,255,255,0.6)',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input-styled"
                        placeholder="Type model name..."
                        value={modelInput}
                        onChange={e => setModelInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddModel()}
                        style={{ flex: 1 }}
                      />
                      <button onClick={handleAddModel} className="action-btn" style={{ padding: '8px 16px' }}>
                        Add
                      </button>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px' }}>
                      Type and Press Enter or Space to add.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setEditingProvider(null);
                        setModelInput('');
                      }}
                      style={{
                        padding: '10px 24px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                      }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveProvider} className="action-btn" style={{ padding: '10px 24px' }}>
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Firewall Tab */}
          {activeTab === 'firewall' && (
            <div className="tab-content active">
              <h2 className="section-title">Firewall</h2>
              <div className="glass-panel p-6 text-center">
                <div style={{ color: 'rgba(255,255,255,0.4)' }}>No firewall rules active.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
