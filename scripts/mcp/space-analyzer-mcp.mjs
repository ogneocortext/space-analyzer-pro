#!/usr/bin/env node
/**
 * Space Analyzer MCP Server
 * Exposes the Rust CLI tools as MCP tools for AI clients.
 *
 * Tools:
 *   space_scan       - Scan a directory and return file/directory stats
 *   space_disk_info  - Get mounted volume info
 *   space_history    - Query scan history from the embedded SQLite DB
 *   space_dedup      - Find duplicate files in a directory
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the compiled Rust CLI binary
const CLI_BIN = join(__dirname, "..", "..", "target", "release", "space-analyzer-cli.exe");

/**
 * Flatten history records by parsing JSON-encoded string fields into proper objects.
 * The Rust CLI stores some fields as JSON strings in the database; this converts
 * them back to structured objects so AI clients don't have to double-parse.
 */
function flattenHistoryRecord(record) {
  const flattenFields = [
    "category_reclaimable",
    "category_sizes",
    "extension_sizes",
    "file_types",
    "largest_files",
    "top_directories",
    "reclaim_tier_sizes",
  ];
  const flattened = { ...record };
  for (const field of flattenFields) {
    const jsonKey = `${field}_json`;
    if (typeof flattened[jsonKey] === "string") {
      try {
        flattened[field] = JSON.parse(flattened[jsonKey]);
      } catch {
        flattened[field] = flattened[jsonKey];
      }
      delete flattened[jsonKey];
    }
  }
  return flattened;
}

function runCli(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI_BIN, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      reject(new Error(`CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0 && !stdout) {
        reject(new Error(`CLI exited ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout.trim());
      }
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

const server = new Server(
  { name: "space-analyzer", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "space_scan",
      description:
        "Scan a directory and return file/directory stats. Use include-hidden for system files and deep for full recursion.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to scan" },
          format: { type: "string", enum: ["json", "text"], default: "json" },
          include_hidden: { type: "boolean", default: false },
          deep: { type: "boolean", default: true },
          top: { type: "number", default: 20, description: "Max entries for top directories/largest files" },
          timeout_ms: { type: "number", default: 60000, description: "Timeout in milliseconds (default 60000)" },
        },
        required: ["path"],
      },
    },
    {
      name: "space_disk_info",
      description:
        "Return all mounted volumes with total/used/available bytes and usage percent.",
      inputSchema: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["json", "text"], default: "json" },
        },
      },
    },
    {
      name: "space_history",
      description:
        "Query scan history from the embedded SQLite database. Supports pagination, sorting, and filtering.",
      inputSchema: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["json", "text"], default: "json" },
          limit: { type: "number", default: 20 },
          id: { type: "number", description: "Get a specific scan by ID" },
          trend: { type: "boolean", default: false, description: "Return trend data over time" },
          sort_by: {
            type: "string",
            enum: ["date", "size", "duplicates"],
            default: "date",
          },
        },
      },
    },
    {
      name: "space_dedup",
      description:
        "Find duplicate files in a directory by content hash. Returns groups of identical files and potential savings.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to scan for duplicates" },
          format: { type: "string", enum: ["json", "text"], default: "json" },
        },
        required: ["path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result;
    switch (name) {
      case "space_scan":
        if (!args.path || typeof args.path !== "string") {
          throw new Error("Missing required argument: path (string)");
        }
        result = await runCli([
          "scan",
          "--path",
          args.path,
          "--format",
          args.format || "json",
          ...(args.include_hidden ? ["--include-hidden"] : []),
          ...(args.deep === undefined || args.deep ? ["--deep"] : ["--shallow"]),
          "--top",
          String(args.top || 20),
        ], args.timeout_ms || 60000);
        break;
      case "space_disk_info":
        result = await runCli([
          "disk-info",
          "--format",
          args.format || "json",
        ]);
        break;
      case "space_history":
        result = await runCli([
          "history",
          "--format", args.format || "json",
          ...(args.id ? ["--id", String(args.id)] : []),
          ...(args.trend ? ["--trend"] : []),
          "--sort-by",
          args.sort_by || "date",
          "--limit",
          String(args.limit || 20),
        ]);
        // Flatten JSON-in-JSON fields for easier AI consumption
        if ((args.format || "json") === "json" && result) {
          try {
            const parsed = JSON.parse(result);
            if (Array.isArray(parsed.records)) {
              parsed.records = parsed.records.map(flattenHistoryRecord);
            } else if (parsed.records && typeof parsed.records === "object") {
              parsed.records = [flattenHistoryRecord(parsed.records)];
            }
            result = JSON.stringify(parsed);
          } catch {
            // If parsing fails, return raw result
          }
        }
        break;
      case "space_dedup":
        if (!args.path || typeof args.path !== "string") {
          throw new Error("Missing required argument: path (string)");
        }
        result = await runCli([
          "dedup",
          "--path",
          args.path,
          "--format",
          args.format || "json",
        ], 120000);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: result }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
