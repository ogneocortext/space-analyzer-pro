/**
 * Frontend Diagnostic Script
 * Helps identify common issues preventing the app from loading
 */

// Check if we're in a browser environment
if (typeof window === 'undefined') {
  console.error('❌ Not running in a browser environment');
  process.exit(1);
}

console.log('🔍 Frontend Diagnostic Tool');
console.log('========================');

// Check basic DOM elements
console.log('📋 Checking DOM elements...');
const appElement = document.getElementById('app');
if (!appElement) {
  console.error('❌ #app element not found in DOM');
} else {
  console.log('✅ #app element found');
}

// Check if Vue is loaded
console.log('📋 Checking Vue...');
if (typeof window.Vue === 'undefined') {
  console.log('⚠️ Vue not found in global scope (might be imported as module)');
} else {
  console.log('✅ Vue found in global scope');
}

// Check if Pinia is loaded
console.log('📋 Checking Pinia...');
if (typeof window.Pinia === 'undefined') {
  console.log('⚠️ Pinia not found in global scope (might be imported as module)');
} else {
  console.log('✅ Pinia found in global scope');
}

// Check CSS loading
console.log('📋 Checking CSS...');
const styles = document.styleSheets;
console.log(`✅ ${styles.length} stylesheets loaded`);

// Check for JavaScript errors
console.log('📋 Checking for JavaScript errors...');
const errorCount = window.__debugLogs?.filter(log => log.tag.includes('ERROR')).length || 0;
if (errorCount > 0) {
  console.warn(`⚠️ ${errorCount} JavaScript errors detected`);
} else {
  console.log('✅ No JavaScript errors detected');
}

// Check network requests
console.log('📋 Checking network requests...');
const originalFetch = window.fetch;
let requestCount = 0;

window.fetch = function(...args) {
  requestCount++;
  console.log(`📡 Request ${requestCount}: ${args[0]}`);
  return originalFetch.apply(this, args);
};

// Check if the app is trying to mount
console.log('📋 Checking app mount status...');
setTimeout(() => {
  const appContent = appElement?.innerHTML;
  if (appContent && appContent.length > 0) {
    console.log('✅ App content detected in #app element');
    console.log('📊 Content length:', appContent.length, 'characters');
  } else {
    console.error('❌ No content in #app element - app not mounting');
  }
}, 2000);

// Check for specific common issues
console.log('📋 Checking for common issues...');

// Check if there are any missing imports
const scriptTags = document.getElementsByTagName('script');
console.log(`✅ ${scriptTags.length} script tags found`);

// Check if there are any 404 errors in the network tab
setTimeout(() => {
  console.log('📊 Network request count:', requestCount);
  if (requestCount === 0) {
    console.warn('⚠️ No network requests detected - might indicate a loading issue');
  }
}, 3000);

console.log('🔍 Diagnostic complete - check browser console for details');
console.log('💡 Try opening the browser developer tools (F12) to see more detailed errors');