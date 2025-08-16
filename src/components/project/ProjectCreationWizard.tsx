import React, { useState } from 'react'
import { X, ArrowLeft, ArrowRight, Sparkles, Folder, Code, Database, Rocket, Check } from 'lucide-react'
import { projectWorkspaceManager, PROJECT_TEMPLATES } from '@/services/project-workspace'
import { claudeCodeAPI } from '@/services/claude-code-api'
import { loggers } from '@/services/logging-system'

interface ProjectCreationWizardProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated?: (project: any) => void
}

interface WizardData {
  name: string
  description: string
  type: 'encore-solidjs' | 'encore-react' | 'fullstack-ts' | 'microservices'
  template: string
  requirements: string[]
  businessRules: string[]
  techStack: string[]
  apis: { name: string; type: string; description: string }[]
}

const initialWizardData: WizardData = {
  name: '',
  description: '',
  type: 'encore-solidjs',
  template: 'encore-solidjs-starter',
  requirements: [],
  businessRules: [],
  techStack: [],
  apis: []
}

export const ProjectCreationWizard: React.FC<ProjectCreationWizardProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData)
  const [isCreating, setIsCreating] = useState(false)
  const [newRequirement, setNewRequirement] = useState('')
  const [newBusinessRule, setNewBusinessRule] = useState('')
  const [newTechStack, setNewTechStack] = useState('')

  if (!isOpen) return null

  const steps = [
    { id: 'basic', title: 'Project Details', icon: Folder },
    { id: 'template', title: 'Template Selection', icon: Code },
    { id: 'knowledge', title: 'Knowledge Base', icon: Database },
    { id: 'review', title: 'Review & Create', icon: Rocket }
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setWizardData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }))
      setNewRequirement('')
    }
  }

  const handleRemoveRequirement = (index: number) => {
    setWizardData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }))
  }

  const handleAddBusinessRule = () => {
    if (newBusinessRule.trim()) {
      setWizardData(prev => ({
        ...prev,
        businessRules: [...prev.businessRules, newBusinessRule.trim()]
      }))
      setNewBusinessRule('')
    }
  }

  const handleRemoveBusinessRule = (index: number) => {
    setWizardData(prev => ({
      ...prev,
      businessRules: prev.businessRules.filter((_, i) => i !== index)
    }))
  }

  const handleAddTechStack = () => {
    if (newTechStack.trim()) {
      setWizardData(prev => ({
        ...prev,
        techStack: [...prev.techStack, newTechStack.trim()]
      }))
      setNewTechStack('')
    }
  }

  const handleRemoveTechStack = (index: number) => {
    setWizardData(prev => ({
      ...prev,
      techStack: prev.techStack.filter((_, i) => i !== index)
    }))
  }

  const handleCreateProject = async () => {
    setIsCreating(true)
    
    try {
      loggers.project('project_creation_wizard_started', {
        name: wizardData.name,
        type: wizardData.type,
        templateId: wizardData.template,
        requirementsCount: wizardData.requirements.length,
        businessRulesCount: wizardData.businessRules.length,
        techStackCount: wizardData.techStack.length
      })

      // Find selected template
      const selectedTemplate = PROJECT_TEMPLATES.find(t => t.id === wizardData.template)
      
      // Create project with knowledge base
      const project = await projectWorkspaceManager.createProject(
        wizardData.name,
        wizardData.type,
        selectedTemplate,
        wizardData.requirements
      )

      // Update project with additional knowledge base data
      if (project.knowledgeBase) {
        project.knowledgeBase.businessRules = wizardData.businessRules
        project.knowledgeBase.techStack = [
          ...project.knowledgeBase.techStack,
          ...wizardData.techStack
        ]
        project.knowledgeBase.apis = wizardData.apis
        project.description = wizardData.description
      }

      // Create Docker container with Claude Code CLI
      loggers.container('container_creation_with_claude_cli', {
        projectId: project.id,
        templateId: wizardData.template
      }, project.id)

      const containerId = await claudeCodeAPI.createContainer(project.id, {
        image: selectedTemplate?.containerConfig.image || 'node:18-alpine',
        ports: selectedTemplate?.containerConfig.ports || [3000, 4000],
        environment: {
          ...selectedTemplate?.containerConfig.environment,
          PROJECT_NAME: wizardData.name,
          PROJECT_TYPE: wizardData.type,
          // Pass host authentication to container
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
          CLAUDE_CODE_AUTH: 'shared-from-host'
        },
        preInstallEncore: wizardData.type.includes('encore')
      })

      // Start Claude Code CLI session with project context
      const claudeRequest = {
        message: `Initialize new ${wizardData.type} project named "${wizardData.name}". 
        
Project Requirements:
${wizardData.requirements.map(req => `- ${req}`).join('\n')}

Business Rules:
${wizardData.businessRules.map(rule => `- ${rule}`).join('\n')}

Tech Stack:
${wizardData.techStack.map(tech => `- ${tech}`).join('\n')}

Please set up the project structure, install dependencies, and create initial files based on the template and requirements.`,
        projectId: project.id,
        context: {
          knowledgeBase: project.knowledgeBase,
          requirements: wizardData.requirements,
          selectedCode: '',
          currentFiles: selectedTemplate?.files || {}
        },
        action: 'generate' as const
      }

      // Send initial request to Claude Code CLI
      loggers.claude('initial_project_setup_request', {
        projectId: project.id,
        messageLength: claudeRequest.message.length,
        hasKnowledgeBase: !!project.knowledgeBase
      }, project.id)

      await claudeCodeAPI.sendMessage(claudeRequest)

      loggers.project('project_creation_wizard_completed', {
        projectId: project.id,
        containerId,
        name: wizardData.name
      }, project.id)

      onProjectCreated?.(project)
      onClose()
      
      // Reset wizard data for next use
      setWizardData(initialWizardData)
      setCurrentStep(0)

    } catch (error) {
      console.error('Failed to create project:', error)
      loggers.error('project_creation_wizard_failed', error as Error, {
        name: wizardData.name,
        type: wizardData.type
      })
      alert('Failed to create project. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic info
        return wizardData.name.trim().length > 0
      case 1: // Template
        return wizardData.template.length > 0
      case 2: // Knowledge base
        return true // Optional step
      case 3: // Review
        return true
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Basic Information
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={wizardData.name}
                onChange={(e) => setWizardData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 bg-constellation-bg-tertiary border border-constellation-border rounded-lg text-constellation-text-primary focus:outline-none focus:ring-2 focus:ring-constellation-accent-blue"
                placeholder="Enter project name..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Description
              </label>
              <textarea
                value={wizardData.description}
                onChange={(e) => setWizardData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-constellation-bg-tertiary border border-constellation-border rounded-lg text-constellation-text-primary focus:outline-none focus:ring-2 focus:ring-constellation-accent-blue h-24 resize-none"
                placeholder="Describe your project..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Project Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'encore-solidjs', name: 'Encore + SolidJS', desc: 'Backend + SolidJS frontend' },
                  { id: 'encore-react', name: 'Encore + React', desc: 'Backend + React frontend' },
                  { id: 'fullstack-ts', name: 'Full-Stack TypeScript', desc: 'Complete TypeScript stack' },
                  { id: 'microservices', name: 'Microservices', desc: 'Distributed architecture' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setWizardData(prev => ({ 
                      ...prev, 
                      type: type.id as any,
                      template: type.id === 'encore-solidjs' ? 'encore-solidjs-starter' :
                               type.id === 'encore-react' ? 'encore-react-starter' : 
                               'fullstack-ts-starter'
                    }))}
                    className={`p-4 text-left border rounded-lg transition-colors ${
                      wizardData.type === type.id
                        ? 'border-constellation-accent-blue bg-constellation-accent-blue bg-opacity-10'
                        : 'border-constellation-border hover:border-constellation-accent-blue hover:bg-constellation-bg-tertiary'
                    }`}
                  >
                    <div className="font-medium text-constellation-text-primary text-sm">
                      {type.name}
                    </div>
                    <div className="text-xs text-constellation-text-secondary mt-1">
                      {type.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 1: // Template Selection
        const availableTemplates = PROJECT_TEMPLATES.filter(t => t.type === wizardData.type)
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-constellation-text-primary mb-2">
                Choose a Template
              </h3>
              <p className="text-sm text-constellation-text-secondary mb-4">
                Select a starting template for your {wizardData.type} project
              </p>
            </div>

            <div className="space-y-3">
              {availableTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setWizardData(prev => ({ ...prev, template: template.id }))}
                  className={`w-full p-4 text-left border rounded-lg transition-colors ${
                    wizardData.template === template.id
                      ? 'border-constellation-accent-blue bg-constellation-accent-blue bg-opacity-10'
                      : 'border-constellation-border hover:border-constellation-accent-blue hover:bg-constellation-bg-tertiary'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-constellation-text-primary">
                        {template.name}
                      </div>
                      <div className="text-sm text-constellation-text-secondary mt-1">
                        {template.description}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-constellation-bg-tertiary px-2 py-1 rounded text-constellation-text-secondary">
                          Ports: {template.containerConfig.ports.join(', ')}
                        </span>
                        <span className="text-xs bg-constellation-bg-tertiary px-2 py-1 rounded text-constellation-text-secondary">
                          {template.containerConfig.image}
                        </span>
                      </div>
                    </div>
                    {wizardData.template === template.id && (
                      <Check size={20} className="text-constellation-accent-blue" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case 2: // Knowledge Base
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-constellation-text-primary mb-2">
                Project Knowledge Base
              </h3>
              <p className="text-sm text-constellation-text-secondary mb-4">
                Define requirements, business rules, and tech stack for Claude Code CLI
              </p>
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Requirements
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddRequirement()}
                  className="flex-1 p-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary focus:outline-none focus:ring-2 focus:ring-constellation-accent-blue"
                  placeholder="Add a requirement..."
                />
                <button
                  onClick={handleAddRequirement}
                  className="px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {wizardData.requirements.map((req, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-constellation-bg-tertiary rounded">
                    <span className="text-sm text-constellation-text-primary">{req}</span>
                    <button
                      onClick={() => handleRemoveRequirement(index)}
                      className="text-constellation-error hover:opacity-80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Rules */}
            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Business Rules
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newBusinessRule}
                  onChange={(e) => setNewBusinessRule(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddBusinessRule()}
                  className="flex-1 p-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary focus:outline-none focus:ring-2 focus:ring-constellation-accent-blue"
                  placeholder="Add a business rule..."
                />
                <button
                  onClick={handleAddBusinessRule}
                  className="px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {wizardData.businessRules.map((rule, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-constellation-bg-tertiary rounded">
                    <span className="text-sm text-constellation-text-primary">{rule}</span>
                    <button
                      onClick={() => handleRemoveBusinessRule(index)}
                      className="text-constellation-error hover:opacity-80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
                Additional Tech Stack
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTechStack}
                  onChange={(e) => setNewTechStack(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTechStack()}
                  className="flex-1 p-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary focus:outline-none focus:ring-2 focus:ring-constellation-accent-blue"
                  placeholder="Add tech stack item..."
                />
                <button
                  onClick={handleAddTechStack}
                  className="px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {wizardData.techStack.map((tech, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-constellation-bg-tertiary rounded">
                    <span className="text-sm text-constellation-text-primary">{tech}</span>
                    <button
                      onClick={() => handleRemoveTechStack(index)}
                      className="text-constellation-error hover:opacity-80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 3: // Review & Create
        const selectedTemplate = PROJECT_TEMPLATES.find(t => t.id === wizardData.template)
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-constellation-text-primary mb-2">
                Review Your Project
              </h3>
              <p className="text-sm text-constellation-text-secondary mb-4">
                Confirm the details before creating your project
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-constellation-bg-tertiary rounded-lg">
                <h4 className="font-medium text-constellation-text-primary mb-2">Project Details</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-constellation-text-secondary">Name:</span> <span className="text-constellation-text-primary">{wizardData.name}</span></div>
                  <div><span className="text-constellation-text-secondary">Type:</span> <span className="text-constellation-text-primary">{wizardData.type}</span></div>
                  <div><span className="text-constellation-text-secondary">Template:</span> <span className="text-constellation-text-primary">{selectedTemplate?.name}</span></div>
                  {wizardData.description && (
                    <div><span className="text-constellation-text-secondary">Description:</span> <span className="text-constellation-text-primary">{wizardData.description}</span></div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-constellation-bg-tertiary rounded-lg">
                <h4 className="font-medium text-constellation-text-primary mb-2">Knowledge Base</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-constellation-text-secondary">Requirements:</span> <span className="text-constellation-text-primary">{wizardData.requirements.length} items</span></div>
                  <div><span className="text-constellation-text-secondary">Business Rules:</span> <span className="text-constellation-text-primary">{wizardData.businessRules.length} items</span></div>
                  <div><span className="text-constellation-text-secondary">Tech Stack:</span> <span className="text-constellation-text-primary">{wizardData.techStack.length} additional items</span></div>
                </div>
              </div>

              <div className="p-4 bg-constellation-bg-tertiary rounded-lg">
                <h4 className="font-medium text-constellation-text-primary mb-2">Container Configuration</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-constellation-text-secondary">Image:</span> <span className="text-constellation-text-primary">{selectedTemplate?.containerConfig.image}</span></div>
                  <div><span className="text-constellation-text-secondary">Ports:</span> <span className="text-constellation-text-primary">{selectedTemplate?.containerConfig.ports.join(', ')}</span></div>
                  <div><span className="text-constellation-text-secondary">Start Command:</span> <span className="text-constellation-text-primary">{selectedTemplate?.containerConfig.startCommand}</span></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-constellation-accent-blue bg-opacity-10 border border-constellation-accent-blue rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-constellation-accent-blue mt-0.5" />
                <div>
                  <h4 className="font-medium text-constellation-text-primary mb-1">What happens next?</h4>
                  <ul className="text-sm text-constellation-text-secondary space-y-1">
                    <li>• Docker container will be created with Claude Code CLI</li>
                    <li>• Project structure will be initialized based on template</li>
                    <li>• Knowledge base will be populated for AI assistance</li>
                    <li>• Files will appear in the IDE file tree</li>
                    <li>• Terminal will connect to the container automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-constellation-bg-secondary rounded-lg border border-constellation-border w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-constellation-border">
          <div>
            <h2 className="text-xl font-semibold text-constellation-text-primary">
              Create New Project
            </h2>
            <p className="text-sm text-constellation-text-secondary mt-1">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between p-6 border-b border-constellation-border">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index <= currentStep
                    ? 'border-constellation-accent-blue bg-constellation-accent-blue text-constellation-bg-primary'
                    : 'border-constellation-border text-constellation-text-tertiary'
                }`}>
                  <StepIcon size={16} />
                </div>
                <span className={`ml-2 text-sm ${
                  index <= currentStep ? 'text-constellation-text-primary' : 'text-constellation-text-tertiary'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-px mx-4 ${
                    index < currentStep ? 'bg-constellation-accent-blue' : 'bg-constellation-border'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-constellation-border">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-constellation-text-secondary hover:text-constellation-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
            Previous
          </button>

          <div className="flex gap-3">
            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleCreateProject}
                disabled={!canProceed() || isCreating}
                className="flex items-center gap-2 px-6 py-2 bg-constellation-accent-green text-constellation-bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Sparkles size={16} />
                {isCreating ? 'Creating Project...' : 'Create Project'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                Next
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}