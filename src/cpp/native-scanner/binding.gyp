{
  "targets": [
    {
      "target_name": "native_scanner",
      "sources": [
        "src/native_scanner.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_VERSION=4",
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "_HAS_EXCEPTIONS=0"
      ],
      "conditions": [
        [
          "OS=='win'",
          {
            "defines": [
              "_HAS_EXCEPTIONS=0",
              "NAPI_DISABLE_CPP_EXCEPTIONS",
              "NOMINMAX",
              "WIN32_LEAN_AND_MEAN"
            ],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 0,
                "Optimization": 2,
                "InlineFunctionExpansion": 2,
                "EnableIntrinsicFunctions": "true",
                "FavorSizeOrSpeed": 1,
                "AdditionalOptions": [
                  "/EHsc",
                  "/std:c++20",
                  "/O2",
                  "/GL",
                  "/arch:AVX2",
                  "/fp:fast",
                  "/Qpar",
                  "/Gw",
                  "/Zc:inline",
                  "/Zc:rvalueCast",
                  "/Zc:strictStrings",
                  "/Zc:throwingNew",
                  "/permissive-",
                  "/bigobj"
                ]
              },
              "VCLinkerTool": {
                "LinkTimeCodeGeneration": 1,
                "OptimizeReferences": 2,
                "EnableCOMDATFolding": 2
              },
              "VCResourceCompilerTool": {
                "AdditionalIncludeDirectories": "<!@(node -p \"require('node-addon-api').include\")"
              }
            }
          }
        ]
      ],
      "configurations": {
        "Release": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 0,
              "Optimization": 2,
              "InlineFunctionExpansion": 2,
              "EnableIntrinsicFunctions": "true",
              "FavorSizeOrSpeed": 1
            }
          }
        },
        "Debug": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 1,
              "Optimization": 0,
              "AdditionalOptions": [
                "/EHsc",
                "/std:c++20",
                "/ZI",
                "/Od"
              ]
            }
          }
        }
      }
    }
  ]
}