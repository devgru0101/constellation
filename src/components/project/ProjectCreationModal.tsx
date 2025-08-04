import React, { useState } from 'react'
import { X, Server, Globe, Database, Layers, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { projectWorkspaceManager } from '@/services/project-workspace'
import { loggers } from '@/services/logging-system'

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: 'encore-solidjs' | 'encore-react' | 'fullstack-ts' | 'microservices';
  icon: React.ReactNode;
  features: string[];
  techStack: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

interface ProjectFormData {
  name: string;
  description: string;
  template: ProjectTemplate | null;
  requirements: string[];
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'encore-solidjs',
    name: 'Encore + SolidJS',
    description: 'Full-stack TypeScript app with Encore microservices backend and SolidJS reactive frontend',
    type: 'encore-solidjs',
    icon: <Server className="text-constellation-accent-blue" size={20} />,
    features: [
      'Encore.ts microservices architecture',
      'SolidJS reactive frontend',
      'Built-in database with migrations',
      'API documentation generation',
      'Authentication & authorization'
    ],
    techStack: ['TypeScript', 'Encore.ts', 'SolidJS', 'PostgreSQL', 'Docker'],
    complexity: 'intermediate'
  },
  {
    id: 'encore-react',
    name: 'Encore + React',
    description: 'Traditional React frontend with Encore backend services',
    type: 'encore-react',
    icon: <Globe className="text-constellation-accent-green" size={20} />,
    features: [
      'Encore.ts microservices',
      'React with TypeScript',
      'State management with Context',
      'Responsive design system',
      'Real-time capabilities'
    ],
    techStack: ['TypeScript', 'Encore.ts', 'React', 'PostgreSQL', 'WebSocket'],
    complexity: 'beginner'
  },
  {
    id: 'fullstack-ts',
    name: 'Full-Stack TypeScript',
    description: 'Complete TypeScript application with modern tooling and best practices',
    type: 'fullstack-ts',
    icon: <Database className="text-constellation-accent-yellow" size={20} />,
    features: [
      'Node.js backend with Express',
      'React frontend',
      'Prisma ORM for database',
      'tRPC for type-safe APIs',
      'Authentication system'
    ],
    techStack: ['TypeScript', 'Node.js', 'React', 'Prisma', 'tRPC', 'PostgreSQL'],
    complexity: 'intermediate'
  },
  {
    id: 'microservices',
    name: 'Microservices Architecture',
    description: 'Scalable microservices setup with service discovery and distributed architecture',
    type: 'microservices',
    icon: <Layers className="text-constellation-accent-purple" size={20} />,
    features: [
      'Multiple service containers',
      'Service mesh architecture',
      'API Gateway pattern',
      'Distributed logging',
      'Container orchestration'
    ],
    techStack: ['TypeScript', 'Docker', 'Kubernetes', 'Redis', 'PostgreSQL', 'NGINX'],
    complexity: 'advanced'
  }
]

export const ProjectCreationModal: React.FC<ProjectCreationModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const [step, setStep] = useState<'template' | 'details' | 'requirements' | 'creating'>('template')
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    template: null,
    requirements: []
  })
  const [currentRequirement, setCurrentRequirement] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleTemplateSelect = (template: ProjectTemplate) => {
    loggers.ui('project_template_selected', {
      templateId: template.id,
      templateName: template.name
    })
    
    setFormData(prev => ({ ...prev, template }))
    setStep('details')
  }

  const handleDetailsNext = () => {
    if (!formData.name.trim()) {
      return // Could show validation error
    }
    
    loggers.ui('project_details_completed', {
      projectName: formData.name,
      hasDescription: !!formData.description
    })
    
    setStep('requirements')
  }

  const handleAddRequirement = () => {
    if (currentRequirement.trim()) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, currentRequirement.trim()]
      }))
      setCurrentRequirement('')
    }
  }

  const handleRemoveRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }))
  }

  const handleCreateProject = async () => {
    if (!formData.template) return

    setIsCreating(true)
    setCreationError(null)
    setStep('creating')

    try {
      loggers.project('project_creation_initiated', {
        projectName: formData.name,
        templateId: formData.template.id,
        requirementsCount: formData.requirements.length
      })

      const project = await projectWorkspaceManager.createProject(
        formData.name,
        formData.template.type,
        undefined, // We'll pass template later when we have the template system
        formData.requirements
      )

      onProjectCreated(project)
    } catch (error) {
      loggers.error('project_creation_failed', error as Error, {
        projectName: formData.name,
        templateId: formData.template.id
      })
      
      const errorMessage = (error as Error).message
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('permission denied') && errorMessage.includes('docker')) {
        setCreationError('Docker permission denied. Please run: sudo usermod -aG docker $USER && newgrp docker')
      } else if (errorMessage.includes('Docker daemon')) {
        setCreationError('Docker is not running. Please start Docker and try again.')
      } else if (errorMessage.includes('failed to fetch')) {
        setCreationError('Cannot connect to backend server. Please check if the backend is running on port 8000.')
      } else {
        setCreationError(errorMessage)
      }
      setStep('requirements') // Go back to previous step
    } finally {
      setIsCreating(false)
    }
  }

  const renderTemplateSelection = () => (
    <div className="template-selection">
      <div className="modal-header mb-6">
        <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
          Choose Project Template
        </h2>
        <p className="text-sm text-constellation-text-secondary">
          Select a template that best fits your project needs
        </p>
      </div>

      <div className="templates-grid grid gap-4">
        {PROJECT_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="template-card p-4 border border-constellation-border rounded-lg hover:border-constellation-accent-blue cursor-pointer transition-all group"
            onClick={() => handleTemplateSelect(template)}
          >
            <div className="flex items-start gap-3 mb-3">
              {template.icon}
              <div>
                <h3 className="text-sm font-medium text-constellation-text-primary group-hover:text-constellation-accent-blue">
                  {template.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    template.complexity === 'beginner' ? 'bg-green-100 text-green-800' :
                    template.complexity === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {template.complexity}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-constellation-text-secondary mb-3">
              {template.description}
            </p>

            <div className="features mb-3">
              <p className="text-xs font-medium text-constellation-text-primary mb-1">Features:</p>
              <ul className="text-xs text-constellation-text-secondary space-y-0.5">
                {template.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-constellation-accent-green rounded-full" />
                    {feature}
                  </li>
                ))}
                {template.features.length > 3 && (
                  <li className="text-constellation-text-tertiary">
                    +{template.features.length - 3} more
                  </li>
                )}
              </ul>
            </div>

            <div className="tech-stack">
              <p className="text-xs font-medium text-constellation-text-primary mb-1">Tech Stack:</p>
              <div className="flex flex-wrap gap-1">
                {template.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs px-2 py-0.5 bg-constellation-bg-tertiary text-constellation-text-secondary rounded"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderProjectDetails = () => (
    <div className="project-details">
      <div className="modal-header mb-6">
        <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
          Project Details
        </h2>
        <p className="text-sm text-constellation-text-secondary">
          Configure your {formData.template?.name} project
        </p>
      </div>

      <div className="form-fields space-y-4">
        <div className="field">
          <label className="block text-sm font-medium text-constellation-text-primary mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="my-awesome-project"
            className="w-full px-3 py-2 bg-constellation-bg-tertiary border border-constellation-border rounded-md text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
          />
        </div>

        <div className="field">
          <label className="block text-sm font-medium text-constellation-text-primary mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what your project will do..."
            rows={3}
            className="w-full px-3 py-2 bg-constellation-bg-tertiary border border-constellation-border rounded-md text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue resize-none"
          />
        </div>

        <div className="selected-template p-3 bg-constellation-bg-secondary rounded-md">
          <p className="text-xs font-medium text-constellation-text-primary mb-2">Selected Template:</p>
          <div className="flex items-center gap-2">
            {formData.template?.icon}
            <span className="text-sm text-constellation-text-primary">
              {formData.template?.name}
            </span>
          </div>
        </div>
      </div>

      <div className="modal-actions flex gap-3 mt-6">
        <button
          className="px-4 py-2 text-sm text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
          onClick={() => setStep('template')}
        >
          Back
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
          onClick={handleDetailsNext}
          disabled={!formData.name.trim()}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )

  const renderRequirements = () => (
    <div className="project-requirements">
      <div className="modal-header mb-6">
        <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
          Project Requirements
        </h2>
        <p className="text-sm text-constellation-text-secondary">
          Add specific requirements or features for your project (optional)
        </p>
      </div>

      <div className="requirements-input mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentRequirement}
            onChange={(e) => setCurrentRequirement(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
            placeholder="Add a requirement or feature..."
            className="flex-1 px-3 py-2 bg-constellation-bg-tertiary border border-constellation-border rounded-md text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
          />
          <button
            onClick={handleAddRequirement}
            disabled={!currentRequirement.trim()}
            className="px-4 py-2 bg-constellation-accent-green text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {formData.requirements.length > 0 && (
        <div className="requirements-list mb-6">
          <p className="text-sm font-medium text-constellation-text-primary mb-3">
            Requirements ({formData.requirements.length}):
          </p>
          <div className="space-y-2">
            {formData.requirements.map((requirement, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-constellation-bg-secondary rounded-md"
              >
                <span className="text-sm text-constellation-text-primary">
                  {requirement}
                </span>
                <button
                  onClick={() => handleRemoveRequirement(index)}
                  className="text-constellation-text-secondary hover:text-red-400 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {creationError && (
        <div className="error-message flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <AlertCircle size={16} className="text-red-600" />
          <span className="text-sm text-red-800">{creationError}</span>
        </div>
      )}

      <div className="modal-actions flex gap-3">
        <button
          className="px-4 py-2 text-sm text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
          onClick={() => setStep('details')}
        >
          Back
        </button>
        <button
          className="flex items-center gap-2 px-6 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
          onClick={handleCreateProject}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  )

  const renderCreating = () => (
    <div className="project-creating text-center py-8">
      <div className="mb-6">
        <div className="w-16 h-16 border-4 border-constellation-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
          Creating Your Project
        </h2>
        <p className="text-sm text-constellation-text-secondary">
          Setting up workspace, containers, and project structure...
        </p>
      </div>

      <div className="creation-steps text-left max-w-md mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <Check size={16} className="text-constellation-accent-green" />
          <span className="text-sm text-constellation-text-primary">Project workspace created</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-constellation-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-constellation-text-secondary">Setting up containers...</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border border-constellation-border rounded-full" />
          <span className="text-sm text-constellation-text-tertiary">Initializing project files</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="project-creation-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-content bg-constellation-bg-primary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="modal-header p-6 border-b border-constellation-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-constellation-accent-blue rounded-lg flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-constellation-text-primary">
                Create New Project
              </h1>
              <p className="text-xs text-constellation-text-secondary">
                Step {step === 'template' ? '1' : step === 'details' ? '2' : step === 'requirements' ? '3' : '4'} of 4
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-constellation-bg-secondary rounded-md transition-colors"
            disabled={isCreating}
          >
            <X size={20} className="text-constellation-text-secondary" />
          </button>
        </div>

        <div className="modal-body p-6">
          {step === 'template' && renderTemplateSelection()}
          {step === 'details' && renderProjectDetails()}
          {step === 'requirements' && renderRequirements()}
          {step === 'creating' && renderCreating()}
        </div>
      </div>
    </div>
  )
}