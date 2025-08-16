// Simple test to check if frontend can reach backend API from browser context
// This simulates what the browser would do

const testAPI = async () => {
  try {
    console.log('🧪 Testing API connectivity from frontend perspective...');
    
    // Test 1: Health check
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:8000/api/health');
    console.log(`Health response: ${healthResponse.status} ${healthResponse.statusText}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health data:', healthData);
    }
    
    // Test 2: Projects API
    console.log('🔍 Testing projects endpoint...');
    const projectsResponse = await fetch('http://localhost:8000/api/projects');
    console.log(`Projects response: ${projectsResponse.status} ${projectsResponse.statusText}`);
    
    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      console.log(`Projects data: success=${projectsData.success}, count=${projectsData.total}`);
      console.log('First project:', projectsData.projects?.[0]);
    } else {
      console.error('Projects API failed:', await projectsResponse.text());
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
};

// Run the test if in browser environment
if (typeof window !== 'undefined') {
  testAPI();
}

module.exports = { testAPI };