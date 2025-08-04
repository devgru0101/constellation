import React, { useState } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { X, Save, Plus, Trash2, Edit, BookOpen } from 'lucide-react'

export const KnowledgeBaseModal: React.FC = () => {
  const state = useSnapshot(appStore)
  const { toggleKnowledgeBase } = useAppStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'services' | 'integrations' | 'requirements'>('overview')
  const [isEditing, setIsEditing] = useState(false)

  const kb = state.currentProject?.knowledgeBase

  if (!kb) return null

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BookOpen },
    { id: 'auth' as const, label: 'Authentication', icon: '🔐' },
    { id: 'services' as const, label: 'Services', icon: '⚡' },
    { id: 'integrations' as const, label: 'Integrations', icon: '🔌' },
    { id: 'requirements' as const, label: 'Requirements', icon: '📋' },
  ]

  return (
    <div className="kb-modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="kb-modal-content bg-constellation-bg-secondary border border-constellation-border rounded-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="kb-modal-header flex items-center justify-between p-6 border-b border-constellation-border">
          <div>
            <h2 className="text-xl font-semibold text-constellation-text-primary">Knowledge Base</h2>
            <p className="text-sm text-constellation-text-secondary mt-1">
              Project configuration and requirements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm hover:opacity-80 transition-opacity"
            >
              <Edit size={14} />
              {isEditing ? 'Done Editing' : 'Edit'}
            </button>
            <button
              onClick={toggleKnowledgeBase}
              className="p-2 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-constellation-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-constellation-text-primary border-constellation-accent-blue'
                  : 'text-constellation-text-secondary border-transparent hover:text-constellation-text-primary'
              }`}
            >
              {typeof tab.icon === 'string' ? (
                <span>{tab.icon}</span>
              ) : (
                <tab.icon size={16} />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="kb-modal-body flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewTab kb={kb} isEditing={isEditing} />}
          {activeTab === 'auth' && <AuthTab kb={kb} isEditing={isEditing} />}
          {activeTab === 'services' && <ServicesTab kb={kb} isEditing={isEditing} />}
          {activeTab === 'integrations' && <IntegrationsTab kb={kb} isEditing={isEditing} />}
          {activeTab === 'requirements' && <RequirementsTab kb={kb} isEditing={isEditing} />}
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="p-4 border-t border-constellation-border flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Save changes
                setIsEditing(false)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-constellation-accent-green text-constellation-bg-primary rounded hover:opacity-80 transition-opacity"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const OverviewTab: React.FC<{ kb: any; isEditing: boolean }> = ({ kb, isEditing }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-medium text-constellation-text-primary mb-3">Project Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-constellation-text-secondary mb-2">Project Type</label>
          {isEditing ? (
            <select className="w-full p-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary">
              <option value="enterprise-saas">Enterprise SaaS</option>
              <option value="consumer-app">Consumer App</option>
              <option value="api-service">API Service</option>
              <option value="data-platform">Data Platform</option>
            </select>
          ) : (
            <div className="p-2 bg-constellation-bg-tertiary rounded text-constellation-text-primary">
              Enterprise SaaS
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-constellation-text-secondary mb-2">Database Type</label>
          <div className="p-2 bg-constellation-bg-tertiary rounded text-constellation-text-primary">
            {kb.database.type}
          </div>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-medium text-constellation-text-primary mb-3">Quick Stats</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card p-3 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="text-2xl font-bold text-constellation-accent-blue">{kb.services.length}</div>
          <div className="text-xs text-constellation-text-secondary">Services</div>
        </div>
        <div className="stat-card p-3 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="text-2xl font-bold text-constellation-accent-green">{kb.integrations.length}</div>
          <div className="text-xs text-constellation-text-secondary">Integrations</div>
        </div>
        <div className="stat-card p-3 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="text-2xl font-bold text-constellation-accent-yellow">{kb.requirements.length}</div>
          <div className="text-xs text-constellation-text-secondary">Requirements</div>
        </div>
        <div className="stat-card p-3 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="text-2xl font-bold text-constellation-text-primary">{kb.businessRules.length}</div>
          <div className="text-xs text-constellation-text-secondary">Business Rules</div>
        </div>
      </div>
    </div>
  </div>
)

const AuthTab: React.FC<{ kb: any; isEditing: boolean }> = ({ kb, isEditing }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-medium text-constellation-text-primary mb-3">Authentication Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-constellation-text-secondary mb-2">Authentication Type</label>
          {isEditing ? (
            <select className="w-full p-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary">
              <option value="jwt">JWT Token</option>
              <option value="oauth">OAuth 2.0</option>
              <option value="magic-link">Magic Link</option>
              <option value="none">No Authentication</option>
            </select>
          ) : (
            <div className="p-2 bg-constellation-bg-tertiary rounded text-constellation-text-primary">
              {kb.auth.type === 'jwt' ? 'JWT Token' : kb.auth.type}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-constellation-text-secondary mb-2">User Roles</label>
          <div className="space-y-2">
            {kb.auth.roles?.map((role: string, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-constellation-bg-tertiary rounded">
                <span className="text-constellation-text-primary">{role}</span>
                {isEditing && (
                  <button className="text-constellation-error hover:text-constellation-error opacity-80">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <button className="flex items-center gap-2 p-2 border border-dashed border-constellation-border rounded text-constellation-text-secondary hover:text-constellation-text-primary">
                <Plus size={14} />
                Add Role
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)

const ServicesTab: React.FC<{ kb: any; isEditing: boolean }> = ({ kb, isEditing }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-medium text-constellation-text-primary">Services</h3>
      {isEditing && (
        <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm">
          <Plus size={14} />
          Add Service
        </button>
      )}
    </div>
    
    <div className="text-constellation-text-secondary">
      {kb.services.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-lg font-medium mb-2">No services defined</div>
          <div className="text-sm">Services will be automatically generated based on your requirements</div>
        </div>
      ) : (
        <div className="space-y-3">
          {kb.services.map((service: any, index: number) => (
            <div key={index} className="p-4 bg-constellation-bg-tertiary rounded border border-constellation-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-constellation-text-primary">{service.name}</h4>
                {isEditing && (
                  <div className="flex gap-1">
                    <button className="p-1 text-constellation-text-secondary hover:text-constellation-text-primary">
                      <Edit size={14} />
                    </button>
                    <button className="p-1 text-constellation-error hover:text-constellation-error opacity-80">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-constellation-text-secondary">{service.purpose}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)

const IntegrationsTab: React.FC<{ kb: any; isEditing: boolean }> = ({ kb, isEditing }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-medium text-constellation-text-primary">Third-Party Integrations</h3>
      {isEditing && (
        <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm">
          <Plus size={14} />
          Add Integration
        </button>
      )}
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {kb.integrations.map((integration: string, index: number) => (
        <div key={index} className="integration-card p-3 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="flex items-center justify-between">
            <span className="font-medium text-constellation-text-primary">{integration}</span>
            {isEditing && (
              <button className="text-constellation-error hover:text-constellation-error opacity-80">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const RequirementsTab: React.FC<{ kb: any; isEditing: boolean }> = ({ kb, isEditing }) => (
  <div className="space-y-6">
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-constellation-text-primary">Requirements</h3>
        {isEditing && (
          <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm">
            <Plus size={14} />
            Add Requirement
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {kb.requirements.map((req: string, index: number) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-constellation-bg-tertiary rounded">
            <div className="w-2 h-2 bg-constellation-accent-green rounded-full mt-2 flex-shrink-0" />
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={req}
                  className="w-full bg-transparent text-constellation-text-primary focus:outline-none"
                />
              ) : (
                <span className="text-constellation-text-primary">{req}</span>
              )}
            </div>
            {isEditing && (
              <button className="text-constellation-error hover:text-constellation-error opacity-80">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-constellation-text-primary">Business Rules</h3>
        {isEditing && (
          <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm">
            <Plus size={14} />
            Add Rule
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {kb.businessRules.map((rule: string, index: number) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-constellation-bg-tertiary rounded">
            <div className="w-2 h-2 bg-constellation-accent-yellow rounded-full mt-2 flex-shrink-0" />
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={rule}
                  className="w-full bg-transparent text-constellation-text-primary focus:outline-none"
                />
              ) : (
                <span className="text-constellation-text-primary">{rule}</span>
              )}
            </div>
            {isEditing && (
              <button className="text-constellation-error hover:text-constellation-error opacity-80">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
)