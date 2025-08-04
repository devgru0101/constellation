import React from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { Sidebar } from './ui/Sidebar'
import { Header } from './ui/Header'
import { ChatPanel } from './chat/ChatPanel'
import { WorkArea } from './ui/WorkArea'
import { BottomPanel } from './ui/BottomPanel'
import { KnowledgeBaseModal } from './features/KnowledgeBaseModal'

export const MainIDE: React.FC = () => {
  const state = useSnapshot(appStore)

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="main-content flex-1 flex flex-col">
        {/* Header */}
        <Header />
        
        {/* Content Layout */}
        <div className="content-layout flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          {state.chatOpen && <ChatPanel />}
          
          {/* Main Work Area */}
          <WorkArea />
        </div>
        
        {/* Bottom Panel */}
        {state.bottomPanelOpen && <BottomPanel />}
      </div>
      
      {/* Knowledge Base Modal */}
      {state.knowledgeBaseOpen && <KnowledgeBaseModal />}
    </div>
  )
}