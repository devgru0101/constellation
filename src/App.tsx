import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MainIDE } from './components/MainIDE'
import { useAppStore } from './stores/app-store'
import './services/preview-error-handler' // Initialize preview error handler
import { loggers } from './services/logging-system'
import './index.css'

function App() {
  const { initializeApp } = useAppStore()

  useEffect(() => {
    // Initialize application
    const initialize = async () => {
      try {
        await initializeApp()
        
        // Log application startup
        loggers.ui('application_started', {
          timestamp: new Date(),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        })
      } catch (error) {
        console.error('Failed to initialize app:', error);
        loggers.error('application_initialization_failed', error as Error);
      }
    };
    
    initialize();
    
    // Initialize preview error handler
    // Note: previewErrorHandler is initialized on import and sets up global handlers
    
    // Cleanup on unmount
    return () => {
      loggers.ui('application_shutdown', {
        timestamp: new Date()
      })
    }
  }, [initializeApp])

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<MainIDE />} />
        <Route path="/project/:projectId" element={<MainIDE />} />
      </Routes>
    </div>
  )
}

export default App