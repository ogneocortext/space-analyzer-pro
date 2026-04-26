const fs = require('fs');

const bindingGyp = {
  "targets": [
    {
      "target_name": "native_scanner",
      "sources": ["src/native_scanner.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        [
          "OS=='win'",
          {
            "defines": ["_HAS_EXCEPTIONS=0"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 0,
                "AdditionalOptions": ["/EHsc", "/std:c++17"]
              }
            }
          }
        ]
      ]
    }
  ]
};

fs.writeFileSync('binding.gyp', JSON.stringify(bindingGyp, null, 2));
console.log('binding.gyp updated successfully');
