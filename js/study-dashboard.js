/*! study-dashboard.js — Study Dashboard Interface
   RAMSC AI Study Assistant
   - Authentication flow
   - Document upload with progress
   - Study pack management
   - Daily study generation
   - Performance analytics
*/

(function() {
  'use strict';

  // Configuration
  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api'; // Adjust for production

  // State management
  let currentUser = null;
  let authToken = localStorage.getItem('ramsc_auth_token');

  // Initialize dashboard
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Study Dashboard...');
    
    // Check authentication
    if (authToken) {
      try {
        await validateToken();
        showUserDashboard();
        await loadDashboardData();
      } catch (error) {
        console.error('Authentication failed:', error);
        showAuthSection();
      }
    } else {
      showAuthSection();
    }

    // Setup event listeners
    setupEventListeners();
  });

  // Authentication functions
  async function validateToken() {
    const response = await fetch(`${API_BASE}/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    currentUser = await response.json();
    return currentUser;
  }

  async function login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    authToken = data.token;
    currentUser = data.user;
    
    localStorage.setItem('ramsc_auth_token', authToken);
    return data;
  }

  function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('ramsc_auth_token');
    showAuthSection();
  }

  // UI State Management
  function showAuthSection() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
  }

  function showUserDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Authentication
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('register-btn').addEventListener('click', showRegisterModal);

    // File Upload
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Study Controls
    document.getElementById('generate-daily-btn').addEventListener('click', generateDailyPack);
    document.getElementById('start-study-btn').addEventListener('click', startStudySession);
    document.getElementById('create-pack-btn').addEventListener('click', showCreatePackModal);
  }

  // File Upload Handlers
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
  }

  function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
      uploadFiles(files);
    } else {
      showNotification('Please drop PDF files only', 'error');
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  }

  // File Upload Function
  async function uploadFiles(files) {
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const statusElement = document.getElementById('upload-status');

    progressContainer.classList.remove('hidden');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        statusElement.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;
        
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('title', file.name);
        formData.append('tags', JSON.stringify(['upload']));

        const response = await fetch(`${API_BASE}/upload/file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Upload successful:', result);

        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        progressFill.style.width = `${progress}%`;

        showNotification(`✅ ${file.name} uploaded successfully`, 'success');

      } catch (error) {
        console.error('Upload error:', error);
        showNotification(`❌ Failed to upload ${file.name}: ${error.message}`, 'error');
      }
    }

    statusElement.textContent = 'Upload complete!';
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 2000);

    // Refresh recent sources
    await loadRecentSources();
  }

  // Dashboard Data Loading
  async function loadDashboardData() {
    try {
      await Promise.all([
        loadStatistics(),
        loadRecentSources(),
        loadStudyPacks(),
        loadWeakTopics()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showNotification('Failed to load dashboard data', 'error');
    }
  }

  async function loadStatistics() {
    try {
      const [statsResponse, sourcesResponse] = await Promise.all([
        fetch(`${API_BASE}/scheduler/stats`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/upload/sources?limit=1000`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      const stats = await statsResponse.json();
      const sources = await sourcesResponse.json();

      // Calculate totals
      let totalFlashcards = 0;
      let totalMCQs = 0;

      const packsResponse = await fetch(`${API_BASE}/study-pack`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const packs = await packsResponse.json();

      packs.studyPacks.forEach(pack => {
        totalFlashcards += pack.flashcards_count || 0;
        totalMCQs += pack.mcqs_count || 0;
      });

      // Update UI
      document.getElementById('total-sources').textContent = sources.pagination.total;
      document.getElementById('total-flashcards').textContent = totalFlashcards;
      document.getElementById('total-mcqs').textContent = totalMCQs;
      document.getElementById('study-accuracy').textContent = `${stats.accuracy || 0}%`;

    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  async function loadRecentSources() {
    try {
      const response = await fetch(`${API_BASE}/upload/sources?limit=5`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();

      const container = document.getElementById('recent-sources');
      
      if (data.sources.length === 0) {
        container.innerHTML = '<p>No documents uploaded yet. Upload your first PDF to get started!</p>';
        return;
      }

      container.innerHTML = data.sources.map(source => `
        <div class="study-item">
          <h4>${source.title}</h4>
          <p>Status: <strong>${source.upload_status}</strong> | 
             Chunks: ${source.chunk_count} | 
             Uploaded: ${new Date(source.created_at).toLocaleDateString()}</p>
          ${source.tags.length > 0 ? source.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
        </div>
      `).join('');

    } catch (error) {
      console.error('Failed to load recent sources:', error);
      document.getElementById('recent-sources').innerHTML = '<p>Failed to load recent documents.</p>';
    }
  }

  async function loadStudyPacks() {
    try {
      const response = await fetch(`${API_BASE}/study-pack`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();

      const container = document.getElementById('study-packs');
      
      if (data.studyPacks.length === 0) {
        container.innerHTML = '<p>No study packs yet. Create your first pack from uploaded documents!</p>';
        return;
      }

      container.innerHTML = data.studyPacks.map(pack => `
        <div class="study-item">
          <h4>${pack.title}</h4>
          <p>${pack.flashcards_count} flashcards, ${pack.mcqs_count} MCQs | 
             Due: ${pack.due_flashcards + pack.due_mcqs} items</p>
          <p>Topics: ${pack.topics.map(topic => `<span class="tag">${topic}</span>`).join('')}</p>
          <div class="study-controls">
            <button class="btn btn-primary" onclick="startPackStudy('${pack.id}')">Study Now</button>
            <button class="btn btn-secondary" onclick="viewPackDetails('${pack.id}')">Details</button>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Failed to load study packs:', error);
      document.getElementById('study-packs').innerHTML = '<p>Failed to load study packs.</p>';
    }
  }

  async function loadWeakTopics() {
    try {
      const response = await fetch(`${API_BASE}/scheduler/weak-topics`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();

      const container = document.getElementById('weak-topics');
      
      if (data.weakTopics.length === 0) {
        container.innerHTML = '<p>🎉 No weak topics identified! Keep up the great work!</p>';
        return;
      }

      container.innerHTML = data.weakTopics.map(topic => `
        <div class="study-item weak-topic">
          <h4>${topic.topic}</h4>
          <p>Recent accuracy: ${topic.accuracy_7day.toFixed(1)}% (${topic.total_attempts} attempts)</p>
          <button class="btn btn-primary" onclick="focusOnTopic('${topic.topic}')">Practice This Topic</button>
        </div>
      `).join('');

    } catch (error) {
      console.error('Failed to load weak topics:', error);
      document.getElementById('weak-topics').innerHTML = '<p>Failed to load performance data.</p>';
    }
  }

  // Study Functions
  async function generateDailyPack() {
    const button = document.getElementById('generate-daily-btn');
    const originalText = button.textContent;
    
    try {
      button.textContent = 'Generating...';
      button.disabled = true;

      const response = await fetch(`${API_BASE}/scheduler/daily`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to generate daily pack');
      }

      const data = await response.json();
      
      // Display daily pack
      const container = document.getElementById('daily-pack-content');
      container.innerHTML = `
        <div class="study-item">
          <h4>📚 Today's Study Pack Ready!</h4>
          <p><strong>${data.pack.totalItems}</strong> items total:</p>
          <ul>
            <li>📝 ${data.pack.breakdown.dueFlashcards + data.pack.breakdown.dueMCQs} due reviews</li>
            <li>🎯 ${data.pack.breakdown.weakTopicItems} weak topic items</li>
            <li>✨ ${data.pack.breakdown.newItems} new content</li>
          </ul>
          ${data.pack.weakTopics.length > 0 ? `<p><strong>Focus areas:</strong> ${data.pack.weakTopics.map(t => t.topic).join(', ')}</p>` : ''}
        </div>
      `;

      document.getElementById('start-study-btn').disabled = false;
      showNotification('Daily study pack generated successfully!', 'success');

    } catch (error) {
      console.error('Failed to generate daily pack:', error);
      showNotification('Failed to generate daily pack', 'error');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  function startStudySession() {
    // This would open a study interface - for now, show a placeholder
    showNotification('Study session feature coming soon!', 'info');
  }

  // Modal Functions (simplified - would be more sophisticated in production)
  function showLoginModal() {
    const email = prompt('Enter your email:');
    const password = prompt('Enter your password:');
    
    if (email && password) {
      login(email, password)
        .then(() => {
          showUserDashboard();
          loadDashboardData();
          showNotification('Login successful!', 'success');
        })
        .catch(error => {
          showNotification(`Login failed: ${error.message}`, 'error');
        });
    }
  }

  function showRegisterModal() {
    showNotification('Registration feature coming soon! Please contact RAMSC for account setup.', 'info');
  }

  function showCreatePackModal() {
    const topics = prompt('Enter topics (comma-separated):');
    if (topics) {
      createStudyPack(topics.split(',').map(t => t.trim()));
    }
  }

  async function createStudyPack(topics) {
    try {
      const response = await fetch(`${API_BASE}/study-pack/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topics })
      });

      if (!response.ok) {
        throw new Error('Failed to create study pack');
      }

      const data = await response.json();
      showNotification('Study pack created successfully!', 'success');
      loadStudyPacks();

    } catch (error) {
      console.error('Failed to create study pack:', error);
      showNotification('Failed to create study pack', 'error');
    }
  }

  // Global functions for onclick handlers
  window.startPackStudy = function(packId) {
    showNotification(`Starting study session for pack ${packId}`, 'info');
  };

  window.viewPackDetails = function(packId) {
    showNotification(`Viewing details for pack ${packId}`, 'info');
  };

  window.focusOnTopic = function(topic) {
    showNotification(`Focusing practice on ${topic}`, 'info');
  };

  // Utility Functions
  function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // API request helper
  async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  console.log('✅ Study Dashboard initialized');

})();