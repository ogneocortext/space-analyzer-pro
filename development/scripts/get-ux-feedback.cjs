const http = require('http');

const queryModel = (modelName, prompt) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: modelName,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 500
      }
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response.response);
        } catch (error) {
          console.error('Error parsing ' + modelName + ' response:', error.message);
          resolve('Error parsing response');
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error querying ' + modelName + ':', error.message);
      resolve('Model query failed');
    });

    req.on('timeout', () => {
      console.error(modelName + ' query timeout');
      req.destroy();
      resolve('Query timeout');
    });

    req.write(data);
    req.end();
  });
};

const uxPrompt = `You are a UX/UI expert analyzing a Space Analyzer web application. Based on this frontend structure:

APP STRUCTURE:
- Modern dark theme with glassmorphism effects
- Feature hub with categorized navigation (Analyze, Visualize, AI Insights, Tools, System)
- Progressive loading and lazy loading components
- Command palette for power users
- Drag-and-drop functionality
- Real-time analysis progress tracking
- Multiple visualization types (Neural, Treemap, Temperature heatmap)
- AI-powered insights and recommendations
- Responsive design with mobile support

KEY COMPONENTS:
- Header with search and quick access buttons
- Sidebar navigation with categorized sections
- Main content area with dynamic page rendering
- Loading states with progress indicators
- Error handling with user-friendly messages
- Accessibility features and ARIA support

CURRENT UX FEATURES:
- Command palette (Ctrl+K)
- Focus mode for visualizations
- Time travel analysis
- Natural language search
- File temperature heatmap
- AI chat interface
- Export functionality

Please provide specific, actionable UX improvement recommendations focusing on:
1. User flow optimization
2. Visual hierarchy improvements
3. Interaction design enhancements
4. Accessibility improvements
5. Performance optimizations
6. Mobile experience

Keep your response concise and implementation-focused.`;

const models = ['deepseek-coder:6.7b', 'mistral:7b-instruct-q4_0'];

console.log('Getting UX feedback from models...');

const queryAllModels = async () => {
  for (const model of models) {
    console.log('\n=== ' + model.toUpperCase() + ' UX FEEDBACK ===');
    try {
      const feedback = await queryModel(model, uxPrompt);
      console.log(feedback);
    } catch (error) {
      console.error('Failed to get feedback from ' + model + ':', error.message);
    }
    console.log('\n' + '='.repeat(60));
  }
};

queryAllModels();
