const fs = require('fs');

const bindingGyp = {
  "targets": [
    {
      "target_name": "native_scanner",
      "sources": ["src/native_scanner.cpp"]
    }
  ]
};

fs.writeFileSync('binding.gyp', JSON.stringify(bindingGyp, null, 2));
console.log('binding.gyp created successfully');
