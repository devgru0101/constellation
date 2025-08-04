#!/usr/bin/env node

/**
 * Force Rebuild Integration Test
 * 
 * This script tests the Force Rebuild API endpoints to ensure they are working correctly.
 */

const API_BASE = 'http://localhost:8000/api';

async function testAPI(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`✅ ${method} ${endpoint}:`, response.ok);
    if (!response.ok) {
      console.log(`❌ Error:`, data);
    }
    return { success: response.ok, data };
  } catch (error) {
    console.log(`❌ ${method} ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runForceRebuildTests() {
  console.log('🚀 Testing Force Rebuild API Integration');
  console.log('='.repeat(50));
  
  // Test 1: Check API connectivity
  console.log('\n1. Testing API connectivity...');
  const healthCheck = await testAPI('/debug/projects');
  
  if (!healthCheck.success) {
    console.log('❌ API is not accessible. Cannot proceed with Force Rebuild tests.');
    return;
  }
  
  console.log(`✅ API is accessible. Found ${healthCheck.data.totalProjects} projects.`);
  
  // Get the first project for testing
  const testProject = healthCheck.data.projects[0];
  if (!testProject) {
    console.log('❌ No projects found for testing. Please create a project first.');
    return;
  }
  
  console.log(`🎯 Using test project: ${testProject.id}`);
  
  // Test 2: Test workspace creation
  console.log('\n2. Testing workspace creation...');
  const workspaceTest = await testAPI('/workspace/create', 'POST', {
    projectId: `test-rebuild-${Date.now()}`,
    projectName: 'Force Rebuild Test'
  });
  
  // Test 3: Test container creation
  console.log('\n3. Testing container creation endpoint...');
  const containerTest = await testAPI('/container/create', 'POST', {
    projectId: testProject.id,
    workspacePath: testProject.path,
    config: {
      image: 'node:18-alpine',
      ports: [3000, 4000, 9091],
      environment: {
        NODE_ENV: 'development',
        ENCORE_ENVIRONMENT: 'development'
      },
      volumes: [`${testProject.path}:/app`],
      workingDir: '/app',
      isolation: true
    }
  });
  
  // Test 4: Test command execution
  console.log('\n4. Testing command execution endpoint...');
  const commandTest = await testAPI('/container/exec', 'POST', {
    containerId: 'test-container-id',
    command: 'echo "Force Rebuild Test"',
    interactive: false,
    workDir: '/app'
  });
  
  // Test 5: Test workspace destruction
  console.log('\n5. Testing workspace destruction endpoint...');
  const destroyTest = await testAPI('/workspace/destroy', 'POST', {
    projectId: testProject.id,
    containerId: 'test-container-id',
    workspacePath: testProject.path
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Force Rebuild API Test Summary:');
  console.log(`✅ API Connectivity: ${healthCheck.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Workspace Creation: ${workspaceTest.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Container Creation: ${containerTest.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Command Execution: ${commandTest.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Workspace Destruction: ${destroyTest.success ? 'PASS' : 'FAIL'}`);
  
  const passCount = [healthCheck, workspaceTest, containerTest, commandTest, destroyTest]
    .filter(test => test.success).length;
  
  console.log(`\n🎯 Overall Score: ${passCount}/5 tests passed`);
  
  if (passCount === 5) {
    console.log('✅ All Force Rebuild API endpoints are working correctly!');
    console.log('🔍 If Force Rebuild button is not working, the issue is likely in the frontend integration.');
  } else {
    console.log('❌ Some API endpoints are failing. Force Rebuild functionality may be affected.');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Check browser console for JavaScript errors when clicking Force Rebuild');
  console.log('2. Verify that chat messages are appearing in the chat panel');
  console.log('3. Check network tab to see if API calls are being made');
  console.log('4. Ensure a project is selected before clicking Force Rebuild');
}

// Run the tests
runForceRebuildTests().catch(console.error);