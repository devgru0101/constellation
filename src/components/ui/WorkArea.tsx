import React from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { CodeEditor } from '../features/CodeEditor'
import { PreviewPanel } from '../features/PreviewPanel'
import { EncoreDashboard } from '../features/EncoreDashboard'

export const WorkArea: React.FC = () => {
  const state = useSnapshot(appStore)

  const renderActiveView = () => {
    switch (state.activeView) {
      case 'code':
        return <CodeEditor />
      case 'preview':
        return <PreviewPanel />
      case 'encore-dashboard':
        return <EncoreDashboard />
      default:
        return <CodeEditor />
    }
  }

  return (
    <div className="work-area flex-1 flex flex-col bg-constellation-bg-primary">
      {/* View Content */}
      <div className="view-content flex-1 overflow-hidden">
        {renderActiveView()}
      </div>
    </div>
  )
}