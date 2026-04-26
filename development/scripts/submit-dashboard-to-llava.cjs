const fs = require('fs');
const path = require('path');

async function submitDashboardToLlava() {
  console.log('🤖 Submitting dashboard screenshot to LLaVA for analysis...\n');
  
  try {
    // Find the most recent dashboard screenshot
    let screenshotPath = null;
    try {
      const files = fs.readdirSync(__dirname).filter(file =>
        file.endsWith('.png') && file.includes('dashboard')
      ).sort().reverse();

      if (files.length > 0) {
        screenshotPath = path.join(__dirname, files[0]);
        console.log(`   📷 Using dashboard screenshot: ${files[0]}`);
      } else {
        // Fallback to any PNG
        const pngFiles = fs.readdirSync(__dirname).filter(file =>
          file.endsWith('.png')
        ).sort().reverse();

        if (pngFiles.length > 0) {
          screenshotPath = path.join(__dirname, pngFiles[0]);
          console.log(`   📷 Using fallback screenshot: ${pngFiles[0]}`);
        }
      }
    } catch (error) {
      console.error('Error finding screenshot:', error.message);
    }

    if (!screenshotPath) {
      console.error('❌ No screenshot files found');
      return null;
    }
    
    console.log('1. Reading dashboard screenshot...');
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`   📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`   📷 Base64 length: ${base64Image.length} characters`);
    
    console.log('\n2. Sending to LLaVA vision API...');
    
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
   - Chart types and their effectiveness
   - Data clarity and readability
   - Color usage in visualizations
   - Interactive elements and their usability

3. **Navigation and User Flow**
   - Main navigation structure and clarity
   - Active states and user feedback
   - Breadcrumbs or progress indicators
   - Ease of finding key features

4. **Interactive Elements**
   - Button design, placement, and clarity
   - Form elements and input fields
   - Hover states and micro-interactions
   - Touch target sizes and accessibility

5. **Content and Information Display**
   - Text readability and hierarchy
   - Data presentation clarity
   - Labels, legends, and explanatory text
   - Information density and cognitive load

6. **Responsive Design Considerations**
   - How the layout might adapt to different screen sizes
   - Mobile-friendliness of current design
   - Potential responsive issues

7. **Visual Design and Branding**
   - Color scheme consistency and harmony
   - Typography choices and readability
   - Visual polish and professional appearance
   - Brand consistency throughout

Please provide specific, actionable recommendations for improving this dashboard interface. Focus on practical fixes that would enhance user experience, data comprehension, and overall usability.`,
          images: [base64Image]
        }
      ],
      stream: false
    };
    
    console.log('   📡 Sending request...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for detailed analysis

    const response = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('   ⏳ Waiting for response...');
    const result = await response.json();
    
    console.log('\n🔍 Raw Response:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n✅ LLaVA Dashboard Analysis Results:');
    console.log('='.repeat(60));
    
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
    console.log('='.repeat(60));
    
    console.log('\n📊 Response Details:');
    console.log(`Model: ${result.model || 'Unknown'}`);
    console.log(`Created: ${result.created_at || 'Unknown'}`);
    console.log(`Duration: ${result.total_duration || 'Unknown'}ms`);
    console.log(`Done: ${result.done || 'Unknown'}`);
    
    // Save the analysis results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisPath = path.join(__dirname, `llava-dashboard-analysis-${timestamp}.txt`);
    
    const analysisContent = `LLaVA Dashboard Analysis Results
=====================================

Screenshot: ${screenshotPath}
Date: ${new Date().toISOString()}
Model: ${result.model || 'Unknown'}

Analysis:
${content}

Raw Response:
${JSON.stringify(result, null, 2)}
`;
    
    fs.writeFileSync(analysisPath, analysisContent);
    console.log(`\n📋 Analysis saved: ${analysisPath}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ LLaVA analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  submitDashboardToLlava();
}

module.exports = { submitDashboardToLlava };