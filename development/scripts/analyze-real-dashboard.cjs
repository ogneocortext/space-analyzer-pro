const fs = require('fs');
const path = require('path');

async function analyzeRealDashboard() {
  console.log('🤖 Analyzing real dashboard screenshot with LLaVA...\n');
  
  try {
    // Use the real dashboard screenshot
    const screenshotPath = 'E:\\Self Built Web and Mobile Apps\\Space Analyzer\\dashboard-real-content-2026-01-22T00-48-45-304Z.png';
    
    console.log('1. Reading real dashboard screenshot...');
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`   📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`   📷 Base64 length: ${base64Image.length} characters`);
    
    console.log('\n2. Sending to LLaVA for dashboard analysis...');
    
    const requestBody = {
      model: "llava:7b",
      messages: [
        {
          role: "user",
          content: `Please analyze this Space Analyzer dashboard screenshot and provide detailed feedback on:

1. **Dashboard Layout and Organization**
   - Overall layout structure and visual hierarchy
   - Information architecture and content organization
   - Spacing, alignment, and visual balance
   - Any overcrowding or empty space issues

2. **Data Visualization Components**
   - Chart types and their effectiveness for file system data
   - Data clarity, readability, and visual encoding
   - Color usage in visualizations and accessibility
   - Interactive elements and their usability

3. **Navigation and User Flow**
   - Main navigation structure and clarity
   - Active states and user feedback mechanisms
   - Breadcrumbs, progress indicators, or wayfinding
   - Ease of finding key features and functions

4. **Interactive Elements**
   - Button design, placement, and visual hierarchy
   - Form elements, input fields, and controls
   - Hover states, transitions, and micro-interactions
   - Touch target sizes and accessibility considerations

5. **Content and Information Display**
   - Text readability, typography, and hierarchy
   - Data presentation clarity and comprehension
   - Labels, legends, and explanatory text
   - Information density and cognitive load management

6. **Responsive Design Considerations**
   - How the layout adapts to different screen sizes
   - Mobile-friendliness and touch interactions
   - Potential responsive issues and breakpoints

7. **Visual Design and Branding**
   - Color scheme consistency, harmony, and accessibility
   - Typography choices and readability in dark theme
   - Visual polish, professional appearance, and attention to detail
   - Brand consistency and design system adherence

8. **Specific Space Analyzer Features**
   - File analysis visualization effectiveness
   - Storage metrics presentation and clarity
   - AI-powered insights display and usefulness
   - Search functionality integration and usability

Please provide specific, actionable recommendations for improving this dashboard interface. Focus on practical fixes that would enhance user experience, data comprehension, and overall usability for a file system analysis tool.`,
          images: [base64Image]
        }
      ],
      stream: false
    };
    
    console.log('   📡 Sending request to LLaVA...');
    const response = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('   ⏳ Waiting for LLaVA response...');
    const result = await response.json();
    
    console.log('\n🔍 Raw LLaVA Response:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n✅ LLaVA Real Dashboard Analysis Results:');
    console.log('='.repeat(70));
    
    // Handle LLaVA response format
    let content = '';
    if (result.message && result.message.content) {
      content = result.message.content;
    } else if (result.choices && result.choices[0] && result.choices[0].message) {
      content = result.choices[0].message.content;
    } else {
      content = 'No content found in response';
    }
    
    console.log(content);
    console.log('='.repeat(70));
    
    console.log('\n📊 Response Details:');
    console.log(`Model: ${result.model || 'Unknown'}`);
    console.log(`Created: ${result.created_at || 'Unknown'}`);
    console.log(`Duration: ${result.total_duration || 'Unknown'}ms`);
    console.log(`Done: ${result.done || 'Unknown'}`);
    
    // Save the analysis results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisPath = path.join(__dirname, `llava-real-dashboard-analysis-${timestamp}.txt`);
    
    const analysisContent = `LLaVA Real Dashboard Analysis Results
==========================================

Screenshot: ${screenshotPath}
Date: ${new Date().toISOString()}
Model: ${result.model || 'Unknown'}
Content Type: Real Dashboard Data

Analysis:
${content}

Raw Response:
${JSON.stringify(result, null, 2)}

Comparison with Previous Analyses:
- This analysis focuses on actual dashboard content rather than welcome wizard
- Should provide more specific feedback on data visualization and layout
- Different from previous onboarding-focused analysis
`;
    
    fs.writeFileSync(analysisPath, analysisContent);
    console.log(`\n📋 Analysis saved: ${analysisPath}`);
    
    console.log('\n🎯 Key Differences from Previous Analysis:');
    console.log('• Previous: Welcome wizard/onboarding screen');
    console.log('• Current: Actual dashboard with real content');
    console.log('• Focus: Data visualization, layout, interactivity');
    console.log('• Expected: More specific dashboard recommendations');
    
    return result;
    
  } catch (error) {
    console.error('❌ LLaVA analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  analyzeRealDashboard();
}

module.exports = { analyzeRealDashboard };
