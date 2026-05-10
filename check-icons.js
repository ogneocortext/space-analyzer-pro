const lucide = require('lucide-vue-next');
const iconKeys = Object.keys(lucide);
console.log('Available icons:', iconKeys.filter(k => 
  k.includes('Bell') || 
  k.includes('Alert') || 
  k.includes('Info') || 
  k.includes('Check') ||
  k.includes('X') ||
  k.includes('Message') ||
  k.includes('Notification')
));
