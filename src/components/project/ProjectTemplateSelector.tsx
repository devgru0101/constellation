/**
 * Project Template Selector - Choose tech stack and generate project
 * 
 * Allows users to select from predefined technology combinations and
 * uses specialized agents to generate applications.
 */

import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/app-store';
import { techStackAgentSystem, type TechStackAgent } from '@/services/tech-stack-agents';
import { projectWorkspaceManager, type Project } from '@/services/project-workspace';
import { loggers } from '@/services/logging-system';
import { ChevronRight, Sparkles, Code, Database, Palette, Globe, Check } from 'lucide-react';

interface ProjectTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export const ProjectTemplateSelector: React.FC<ProjectTemplateProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const state = useSnapshot(appStore);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [userRequirements, setUserRequirements] = useState('');
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<'template' | 'details' | 'requirements'>('template');

  const technologyCombinations = techStackAgentSystem.getTechnologyCombinations();
  const availableAgents = techStackAgentSystem.getAvailableAgents();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate('');
      setProjectName('');
      setProjectDescription('');
      setUserRequirements('');
      setSelectedTechnologies([]);
      setCurrentStep('template');
      setIsGenerating(false);
    }
  }, [isOpen]);

  const handleTemplateSelect = (templateId: string) => {
    const template = technologyCombinations.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSelectedTechnologies(template.technologies);
      
      loggers.ui('project_template_selected', {
        templateId,
        templateName: template.name,
        agentId: template.agentId,
        technologiesCount: template.technologies.length
      });
    }
  };

  const handleNextStep = () => {
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('details');
    } else if (currentStep === 'details' && projectName.trim()) {
      setCurrentStep('requirements');
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'requirements') {
      setCurrentStep('details');
    } else if (currentStep === 'details') {
      setCurrentStep('template');
    }
  };

  const handleGenerateProject = async () => {
    if (!selectedTemplate || !projectName.trim()) return;

    const template = technologyCombinations.find(t => t.id === selectedTemplate);
    if (!template) return;

    setIsGenerating(true);
    let projectCreated = false;
    let project: Project | null = null;

    try {
      loggers.project('agent_project_generation_started', {
        templateId: selectedTemplate,
        projectName,
        agentId: template.agentId,
        technologiesCount: selectedTechnologies.length,
        hasRequirements: !!userRequirements.trim()
      });

      // Add immediate feedback to chat
      appStore.chatMessages.push({
        id: `creation-start-${Date.now()}`,
        role: 'assistant',
        content: `🚀 **Creating "${projectName}"...**\n\n⚙️ Setting up workspace...\n🤖 Initializing ${template.name} agent\n📦 Preparing dependencies...`,
        type: 'generation',
        timestamp: new Date(),
        agentId: template.agentId
      });

      // Create project first
      project = await projectWorkspaceManager.createProject(
        projectName,
        'encore-solidjs', // Default type, will be specialized by agent
        undefined, // No predefined template
        userRequirements.trim() ? userRequirements.split('\n').filter(r => r.trim()) : []
      );
      projectCreated = true;

      // Use tech stack agent to generate application
      const generationResult = await techStackAgentSystem.generateApplication({
        agentId: template.agentId,
        projectId: project.id,
        userRequirements: userRequirements || `Create a ${template.name} application with the following features:\n\n- Modern, responsive design\n- Type-safe development\n- Production-ready setup\n- Best practices implementation`,
        selectedTechnologies,
        projectTemplate: selectedTemplate,
        additionalContext: {
          projectName,
          projectDescription,
          templateConfiguration: template
        }
      });

      if (generationResult.success) {
        loggers.project('agent_project_generation_success', {
          projectId: project.id,
          agentId: template.agentId,
          filesGenerated: generationResult.filesGenerated.length,
          commandsExecuted: generationResult.commandsExecuted.length
        }, project.id);

        // Switch to the new project
        await projectWorkspaceManager.switchToProject(project.id);

        // Add success message to chat
        appStore.chatMessages.push({
          id: `success-${Date.now()}`,
          role: 'assistant',
          content: `🎉 **Project "${projectName}" created successfully!**\n\n✨ Generated with **${template.name}** template\n📁 **${generationResult.filesGenerated.length}** files created\n🚀 **Ready for development**\n\nYour application is now ready in the file explorer. Start building amazing things!`,
          type: 'generation',
          timestamp: new Date(),
          agentId: template.agentId
        });

        // Notify parent component BEFORE closing modal
        if (onProjectCreated) {
          onProjectCreated(project);
        }
        
        // Small delay to ensure state updates complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Close modal
        onClose();

      } else {
        throw new Error(generationResult.error || 'Project generation failed');
      }

    } catch (error) {
      console.error('Project generation error:', error);
      
      loggers.error('agent_project_generation_failed', error as Error, {
        templateId: selectedTemplate,
        projectName,
        agentId: template.agentId,
        projectCreated
      });

      // Add error message to chat
      appStore.chatMessages.push({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Failed to create project "${projectName}"**\n\nError: ${(error as Error).message}\n\n${projectCreated ? '⚠️ Project workspace was created but agent generation failed.' : 'Project creation was interrupted.'} Please try again or contact support if the issue persists.`,
        type: 'error',
        timestamp: new Date()
      });

      // If project was created but generation failed, still close modal and switch to it
      if (projectCreated && project) {
        try {
          await projectWorkspaceManager.switchToProject(project.id);
          if (onProjectCreated) {
            onProjectCreated(project);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          onClose();
        } catch (switchError) {
          console.error('Failed to switch to created project:', switchError);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'template': return <Palette size={16} />;
      case 'details': return <Code size={16} />;
      case 'requirements': return <Sparkles size={16} />;
      default: return null;
    }
  };

  const getTechnologyIcon = (tech: string) => {
    const techLower = tech.toLowerCase();
    if (techLower.includes('encore')) return <Database size={16} className="text-blue-400" />;
    if (techLower.includes('solidjs') || techLower.includes('react')) return <Globe size={16} className="text-green-400" />;
    if (techLower.includes('tailwind') || techLower.includes('shadcn')) return <Palette size={16} className="text-purple-400" />;
    return <Code size={16} className="text-gray-400" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
          <div className="bg-constellation-bg-primary border border-constellation-border rounded-xl p-8 max-w-md mx-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-constellation-accent-primary border-t-transparent"></div>
            </div>
            <h3 className="text-lg font-semibold text-constellation-text-primary mb-2">
              Creating Your Project
            </h3>
            <p className="text-sm text-constellation-text-secondary mb-4">
              Our AI agent is generating your {technologyCombinations.find(t => t.id === selectedTemplate)?.name} application...
            </p>
            <div className="flex justify-center gap-1">
              <div className="w-2 h-2 bg-constellation-accent-primary rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-constellation-accent-primary rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-constellation-accent-primary rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      )}
      
      <div className={`bg-constellation-bg-primary border border-constellation-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden transition-opacity duration-300 ${isGenerating ? 'opacity-50' : 'opacity-100'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-constellation-border bg-gradient-to-r from-constellation-bg-primary to-constellation-bg-secondary">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-constellation-accent-primary bg-opacity-20 rounded-lg">
              <Sparkles className="text-constellation-accent-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-constellation-text-primary">
                Create New Project
              </h2>
              <p className="text-sm text-constellation-text-secondary">
                Choose your tech stack and let AI generate your application
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-constellation-text-tertiary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded-md transition-all"
            disabled={isGenerating}
          >
            ✕
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center p-6 bg-constellation-bg-secondary border-b border-constellation-border">
          {['template', 'details', 'requirements'].map((step, index) => {
            const stepIndex = ['template', 'details', 'requirements'].indexOf(step);
            const currentIndex = ['template', 'details', 'requirements'].indexOf(currentStep);
            const isCompleted = index < currentIndex;
            const isCurrent = currentStep === step;
            
            return (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300 ${
                  isCurrent
                    ? 'bg-constellation-accent-primary text-white shadow-lg scale-105' 
                    : isCompleted
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-constellation-bg-tertiary text-constellation-text-tertiary'
                }`}>
                  <div className={`p-1 rounded-full ${
                    isCurrent || isCompleted ? 'bg-white bg-opacity-20' : ''
                  }`}>
                    {isCompleted ? (
                      <Check size={16} />
                    ) : (
                      getStepIcon(step)
                    )}
                  </div>
                  <span className="text-sm font-medium capitalize">{step}</span>
                </div>
                {index < 2 && (
                  <div className={`mx-4 transition-colors ${
                    isCompleted ? 'text-green-500' : 'text-constellation-text-tertiary'
                  }`}>
                    <ChevronRight size={20} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Template Selection */}
          {currentStep === 'template' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-constellation-text-primary mb-2">
                  Choose Your Tech Stack
                </h3>
                <p className="text-constellation-text-secondary">
                  Select a technology combination that matches your project needs
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {technologyCombinations.map((template) => (
                  <div
                    key={template.id}
                    className={`group relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-constellation-accent-primary hover:scale-[1.02] ${
                      selectedTemplate === template.id
                        ? 'border-constellation-accent-primary bg-constellation-accent-primary bg-opacity-10 shadow-md scale-[1.02]'
                        : 'border-constellation-border hover:bg-constellation-bg-secondary'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    {template.recommended && (
                      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-constellation-accent-primary to-purple-500 text-white text-xs px-3 py-1 rounded-full shadow-lg z-10">
                        ✨ Recommended
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${
                          selectedTemplate === template.id 
                            ? 'bg-constellation-accent-primary bg-opacity-20' 
                            : 'bg-constellation-bg-tertiary group-hover:bg-constellation-accent-primary group-hover:bg-opacity-20'
                        }`}>
                          <Code size={20} className={selectedTemplate === template.id ? 'text-constellation-accent-primary' : 'text-constellation-text-secondary group-hover:text-constellation-accent-primary'} />
                        </div>
                        <h4 className="font-semibold text-constellation-text-primary text-lg">
                          {template.name}
                        </h4>
                      </div>
                      {selectedTemplate === template.id && (
                        <div className="p-1 bg-constellation-accent-primary rounded-full">
                          <Check size={16} className="text-white" />
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-constellation-text-secondary mb-4 leading-relaxed">
                      {template.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {template.technologies.map((tech) => (
                        <div
                          key={tech}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            selectedTemplate === template.id
                              ? 'bg-constellation-accent-primary bg-opacity-20 text-constellation-accent-primary border border-constellation-accent-primary border-opacity-30'
                              : 'bg-constellation-bg-tertiary text-constellation-text-primary group-hover:bg-constellation-accent-primary group-hover:bg-opacity-10 group-hover:text-constellation-accent-primary'
                          }`}
                        >
                          {getTechnologyIcon(tech)}
                          {tech}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Project Details */}
          {currentStep === 'details' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-constellation-text-primary mb-2">
                  Project Details
                </h3>
                <p className="text-constellation-text-secondary">
                  Provide basic information about your project
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-constellation-text-primary mb-3">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome App"
                    className="w-full px-4 py-3 bg-constellation-bg-secondary border-2 border-constellation-border rounded-lg text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-primary focus:bg-constellation-bg-primary transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-constellation-text-primary mb-3">
                    Description (Optional)
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description of your project..."
                    rows={3}
                    className="w-full px-4 py-3 bg-constellation-bg-secondary border-2 border-constellation-border rounded-lg text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-primary focus:bg-constellation-bg-primary resize-none transition-all duration-200"
                  />
                </div>

                {selectedTemplate && (
                  <div className="p-4 bg-constellation-bg-secondary rounded-lg">
                    <h4 className="font-medium text-constellation-text-primary mb-2">
                      Selected Template
                    </h4>
                    <p className="text-sm text-constellation-text-secondary mb-2">
                      {technologyCombinations.find(t => t.id === selectedTemplate)?.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTechnologies.map((tech) => (
                        <div
                          key={tech}
                          className="flex items-center gap-1 px-2 py-1 bg-constellation-bg-tertiary rounded text-xs text-constellation-text-primary"
                        >
                          {getTechnologyIcon(tech)}
                          {tech}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Requirements */}
          {currentStep === 'requirements' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-constellation-text-primary mb-2">
                  Project Requirements
                </h3>
                <p className="text-constellation-text-secondary">
                  Describe what you want your application to do (optional but recommended)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-constellation-text-primary mb-3">
                  Features & Requirements
                </label>
                <div className="relative">
                  <textarea
                    value={userRequirements}
                    onChange={(e) => setUserRequirements(e.target.value)}
                    placeholder={`Describe your application features, for example:

• User authentication and profiles
• Dashboard with analytics
• Real-time notifications
• File upload and management
• API integrations
• Mobile-responsive design

The more details you provide, the better the AI can generate your application.`}
                    rows={12}
                    className="w-full px-4 py-4 bg-constellation-bg-secondary border-2 border-constellation-border rounded-lg text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-primary focus:bg-constellation-bg-primary resize-none transition-all duration-200"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-constellation-text-tertiary">
                    {userRequirements.length} characters
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-500 bg-opacity-10 to-purple-500 bg-opacity-10 border border-blue-500 border-opacity-30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500 bg-opacity-20 rounded-full">
                    <Sparkles className="text-blue-400" size={16} />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-400 mb-2">AI-Powered Generation</h4>
                    <p className="text-sm text-constellation-text-secondary mb-2">
                      Our specialized <span className="font-medium text-constellation-text-primary">{technologyCombinations.find(t => t.id === selectedTemplate)?.name}</span> agent will analyze your requirements and generate a complete application.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-500 bg-opacity-20 text-blue-400 rounded">Best Practices</span>
                      <span className="px-2 py-1 bg-green-500 bg-opacity-20 text-green-400 rounded">Production Ready</span>
                      <span className="px-2 py-1 bg-purple-500 bg-opacity-20 text-purple-400 rounded">Type Safe</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-constellation-border bg-constellation-bg-secondary">
          <div className="flex items-center gap-2">
            {currentStep !== 'template' && (
              <button
                onClick={handlePreviousStep}
                className="px-4 py-2 text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                disabled={isGenerating}
              >
                ← Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
              disabled={isGenerating}
            >
              Cancel
            </button>
            
            {currentStep === 'requirements' ? (
              <button
                onClick={handleGenerateProject}
                disabled={!selectedTemplate || !projectName.trim() || isGenerating}
                className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-constellation-accent-primary to-purple-500 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300 disabled:bg-opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none font-medium"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Generating Project...</span>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Generate Project</span>
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                disabled={
                  (currentStep === 'template' && !selectedTemplate) ||
                  (currentStep === 'details' && !projectName.trim())
                }
                className="flex items-center gap-2 px-6 py-3 bg-constellation-accent-primary text-white rounded-lg hover:bg-opacity-90 hover:shadow-md transition-all duration-200 disabled:bg-opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};