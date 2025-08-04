import React, { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { 
  Files, 
  Search, 
  GitBranch, 
  Settings, 
  BookOpen,
  Puzzle
} from 'lucide-react'
import { GitIntegrationPanel } from '@/components/git/GitIntegrationPanel'

export const Sidebar: React.FC = () => {
  const { toggleKnowledgeBase } = useAppStore()
  const [showGitPanel, setShowGitPanel] = useState(false)

  const sidebarItems = [
    { icon: Files, id: 'files', title: 'Files', active: true },
    { icon: BookOpen, id: 'knowledge', title: 'Knowledge Base', onClick: toggleKnowledgeBase },
    { icon: Search, id: 'search', title: 'Search' },
    { icon: GitBranch, id: 'git', title: 'Source Control', onClick: () => setShowGitPanel(true) },
    { icon: Puzzle, id: 'extensions', title: 'Extensions' },
  ]

  const bottomItems = [
    { icon: Settings, id: 'settings', title: 'Settings' }
  ]

  return (
    <div className="sidebar w-[50px] bg-constellation-bg-secondary border-r border-constellation-border flex flex-col items-center py-4 gap-6">
      {/* Logo */}
      <div 
        className="logo w-[30px] h-[30px] bg-gradient-to-br from-constellation-accent-yellow via-constellation-accent-green to-constellation-accent-blue rounded-lg relative overflow-hidden cursor-pointer gradient-animated"
        title="Constellation IDE"
      >
        <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-constellation-bg-primary transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Main Navigation */}
      <div className="flex flex-col gap-6">
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-icon w-6 h-6 cursor-pointer transition-colors duration-200 ${
              item.active 
                ? 'text-constellation-accent-blue' 
                : 'text-constellation-text-tertiary hover:text-constellation-text-secondary'
            }`}
            title={item.title}
            onClick={item.onClick}
          >
            <item.icon size={24} />
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div className="mt-auto flex flex-col gap-6">
        {bottomItems.map((item) => (
          <div
            key={item.id}
            className="sidebar-icon w-6 h-6 text-constellation-text-tertiary hover:text-constellation-text-secondary cursor-pointer transition-colors duration-200"
            title={item.title}
          >
            <item.icon size={24} />
          </div>
        ))}
      </div>

      {/* Git Integration Panel */}
      <GitIntegrationPanel 
        isOpen={showGitPanel} 
        onClose={() => setShowGitPanel(false)} 
      />
    </div>
  )
}