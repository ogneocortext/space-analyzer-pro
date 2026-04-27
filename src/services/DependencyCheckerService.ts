/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

import {
  FileDependency,
  DependencyImpact,
  PredictiveDependencyAnalysis,
} from "./types/dependency-types";
import * as fs from "fs";
import * as path from "path";

// Enhanced interfaces for advanced code analysis
interface CodeAnalysisResult {
  filePath: string;
  imports: ImportStatement[];
  exports: ExportStatement[];
  unusedImports: ImportStatement[];
  missingImports: MissingImport[];
  circularDependencies: CircularDependency[];
  deadCode: DeadCodeSegment[];
  variables: VariableInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

interface ImportStatement {
  source: string;
  type: "default" | "named" | "namespace" | "side-effect";
  name?: string;
  localName?: string;
  line: number;
  column: number;
  isUsed: boolean;
}

interface ExportStatement {
  name: string;
  type: "default" | "named" | "re-export";
  line: number;
  column: number;
  isUsed: boolean;
  usedBy: string[];
}

interface MissingImport {
  name: string;
  type: "variable" | "function" | "class" | "type";
  line: number;
  column: number;
  suggestedSource?: string;
}

interface CircularDependency {
  files: string[];
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

interface DeadCodeSegment {
  type: "function" | "class" | "variable" | "import";
  name: string;
  line: number;
  column: number;
  size: number;
  reason: string;
}

interface VariableInfo {
  name: string;
  type: "const" | "let" | "var";
  isUsed: boolean;
  isExported: boolean;
  line: number;
  column: number;
}

interface FunctionInfo {
  name: string;
  isExported: boolean;
  isUsed: boolean;
  parameters: string[];
  calls: FunctionCall[];
  line: number;
  column: number;
}

interface ClassInfo {
  name: string;
  isExported: boolean;
  isUsed: boolean;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  line: number;
  column: number;
}

interface MethodInfo {
  name: string;
  isUsed: boolean;
  calls: FunctionCall[];
  line: number;
  column: number;
}

interface PropertyInfo {
  name: string;
  isUsed: boolean;
  line: number;
  column: number;
}

interface FunctionCall {
  name: string;
  source: string;
  line: number;
  column: number;
}

// Import PredictiveInsight from SelfLearningMLService
interface PredictiveInsight {
  type: "growth" | "cleanup" | "organization" | "security";
  prediction: string;
  confidence: number;
  timeframe: string;
  actionItems: string[];
  reasoning: any;
}

export class DependencyCheckerService {
  private static instance: DependencyCheckerService;
  private dependencyGraph: Map<string, FileDependency[]> = new Map();
  private fileMetadata: Map<string, any> = new Map();
  private codeAnalysisCache: Map<string, CodeAnalysisResult> = new Map();
  private circularDependencyGraph: Map<string, Set<string>> = new Map();

  static getInstance(): DependencyCheckerService {
    if (!DependencyCheckerService.instance) {
      DependencyCheckerService.instance = new DependencyCheckerService();
    }
    return DependencyCheckerService.instance;
  }

  async buildDependencyGraph(files: any[]): Promise<void> {
    console.warn("🔗 Building dependency graph...");

    this.dependencyGraph.clear();
    this.fileMetadata.clear();

    // Build file metadata
    files.forEach((file) => {
      this.fileMetadata.set(file.path, {
        size: file.size,
        category: file.category,
        lastModified: file.lastModified,
        type: this.getFileType(file.path),
        importance: this.calculateFileImportance(file),
      });
    });

    // Analyze dependencies for each file
    for (const file of files) {
      const dependencies = await this.analyzeFileDependencies(file, files);
      this.dependencyGraph.set(file.path, dependencies);
    }

    console.warn(`🔗 Built dependency graph with ${this.dependencyGraph.size} files`);
  }

  private async analyzeFileDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    try {
      // Analyze based on file type
      const fileType = this.getFileType(file.path);

      switch (fileType) {
        case "javascript":
        case "typescript":
          dependencies.push(...(await this.analyzeCodeDependencies(file, allFiles)));
          break;
        case "python":
          dependencies.push(...(await this.analyzePythonDependencies(file, allFiles)));
          break;
        case "html":
          dependencies.push(...(await this.analyzeHtmlDependencies(file, allFiles)));
          break;
        case "css":
          dependencies.push(...(await this.analyzeCssDependencies(file, allFiles)));
          break;
        case "json":
          dependencies.push(...(await this.analyzeJsonDependencies(file, allFiles)));
          break;
        default:
          dependencies.push(...(await this.analyzeGenericDependencies(file, allFiles)));
      }
    } catch (error) {
      console.error(`Failed to analyze dependencies for ${file.path}:`, error);
    }

    return dependencies;
  }

  private async analyzeCodeDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    // This would analyze actual file content in a real implementation
    // For now, we'll simulate based on patterns

    const _importPatterns = [
      { regex: /import\s+.*from\s+['"](.*)['"]/g, type: "import" as const },
      { regex: /require\s*\(['"](.*)['"]\)/g, type: "require" as const },
      { regex: /import\s+['"](.*)['"]/g, type: "import" as const },
      { regex: /include\s+['"](.*)['"]/g, type: "include" as const },
    ];

    // Simulate finding dependencies based on file naming patterns
    allFiles.forEach((otherFile) => {
      if (otherFile.path === file.path) return;

      let strength: "strong" | "medium" | "weak" = "weak";
      let type: "import" | "require" | "include" | "reference" | "link" | "config" = "reference";

      // Same directory = stronger relationship
      if (this.getDirectory(file.path) === this.getDirectory(otherFile.path)) {
        strength = "medium";
      }

      // Similar file names = potential relationship
      if (this.getBaseName(file.path).includes(this.getBaseName(otherFile.path))) {
        strength = "strong";
        type = "reference";
      }

      // Config files often reference others
      if (file.path.includes("config") || file.path.includes("settings")) {
        type = "config";
        strength = "medium";
      }

      // Test files reference source files
      if (file.path.includes("test") || file.path.includes("spec")) {
        if (!otherFile.path.includes("test")) {
          type = "reference";
          strength = "strong";
        }
      }

      dependencies.push({
        file: otherFile.path,
        path: otherFile.path,
        type,
        strength,
        direction: "outgoing",
        category: otherFile.category || "unknown",
      });
    });

    return dependencies;
  }

  private async analyzePythonDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    // Similar logic for Python files
    allFiles.forEach((otherFile) => {
      if (otherFile.path === file.path) return;

      if (otherFile.path.endsWith(".py")) {
        dependencies.push({
          file: otherFile.path,
          path: otherFile.path,
          type: "import",
          strength: "medium",
          direction: "outgoing",
          category: otherFile.category || "code",
        });
      }
    });

    return dependencies;
  }

  private async analyzeHtmlDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    allFiles.forEach((otherFile) => {
      if (otherFile.path === file.path) return;

      if (otherFile.path.endsWith(".css") || otherFile.path.endsWith(".js")) {
        dependencies.push({
          file: otherFile.path,
          path: otherFile.path,
          type: "link",
          strength: "strong",
          direction: "outgoing",
          category: otherFile.category || "web",
        });
      }
    });

    return dependencies;
  }

  private async analyzeCssDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    allFiles.forEach((otherFile) => {
      if (otherFile.path === file.path) return;

      if (otherFile.path.endsWith(".css")) {
        dependencies.push({
          file: otherFile.path,
          path: otherFile.path,
          type: "import",
          strength: "medium",
          direction: "outgoing",
          category: otherFile.category || "web",
        });
      }
    });

    return dependencies;
  }

  private async analyzeJsonDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    // Package.json, tsconfig.json, etc. often reference other files
    if (file.path.includes("package.json") || file.path.includes("tsconfig.json")) {
      allFiles.forEach((otherFile) => {
        if (otherFile.path === file.path) return;

        if (otherFile.path.endsWith(".js") || otherFile.path.endsWith(".ts")) {
          dependencies.push({
            file: otherFile.path,
            path: otherFile.path,
            type: "config",
            strength: "strong",
            direction: "outgoing",
            category: otherFile.category || "code",
          });
        }
      });
    }

    return dependencies;
  }

  private async analyzeGenericDependencies(file: any, allFiles: any[]): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];

    // Generic analysis based on file patterns and directories
    allFiles.forEach((otherFile) => {
      if (otherFile.path === file.path) return;

      // Files in same project directory
      if (this.getProjectRoot(file.path) === this.getProjectRoot(otherFile.path)) {
        dependencies.push({
          file: otherFile.path,
          path: otherFile.path,
          type: "reference",
          strength: "weak",
          direction: "outgoing",
          category: otherFile.category || "unknown",
        });
      }
    });

    return dependencies;
  }

  async analyzeActionImpact(
    action: string,
    targetFiles: string[]
  ): Promise<PredictiveDependencyAnalysis> {
    console.warn(`🎯 Analyzing impact of ${action} on ${targetFiles.length} files`);

    const directImpacts: DependencyImpact[] = [];
    const cascadingImpacts: DependencyImpact[] = [];

    // Analyze direct impacts
    for (const targetFile of targetFiles) {
      const impact = await this.analyzeDirectImpact(action, targetFile);
      directImpacts.push(impact);
    }

    // Analyze cascading impacts
    const processedFiles = new Set(targetFiles);
    for (const directImpact of directImpacts) {
      for (const affectedFile of directImpact.affectedFiles) {
        if (!processedFiles.has(affectedFile)) {
          const cascadingImpact = await this.analyzeCascadingImpact(
            action,
            affectedFile,
            directImpact
          );
          cascadingImpacts.push(cascadingImpact);
          processedFiles.add(affectedFile);
        }
      }
    }

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(directImpacts, cascadingImpacts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(action, directImpacts, cascadingImpacts);

    // Suggest alternative actions
    const alternativeActions = this.generateAlternativeActions(action, targetFiles);

    return {
      action,
      targetFiles,
      directImpacts,
      cascadingImpacts,
      overallRisk,
      recommendations,
      alternativeActions,
    };
  }

  private async analyzeDirectImpact(action: string, targetFile: string): Promise<DependencyImpact> {
    const dependencies = this.dependencyGraph.get(targetFile) || [];
    const incomingDependencies = this.findIncomingDependencies(targetFile);

    const affectedFiles = [
      ...dependencies.map((d) => d.file),
      ...incomingDependencies.map((d) => d.file),
    ];

    const impact = this.calculateImpactLevel(action, targetFile, affectedFiles);
    const consequences = this.generateConsequences(action, targetFile, affectedFiles);
    const benefits = this.generateBenefits(action, targetFile, {
      type: "cleanup" as const,
      prediction: "Action benefits",
      confidence: 0.8,
      timeframe: "immediate",
      actionItems: [],
      reasoning: {
        primaryFactor: "action",
        contributingFactors: [],
        historicalEvidence: [],
        dataPoints: [],
        trendAnalysis: {
          direction: "stable" as const,
          rate: "none",
          duration: "immediate",
        },
      },
    });

    return {
      file: targetFile,
      impact: impact.level,
      reason: impact.reason,
      affectedFiles,
      consequences,
      benefits,
      riskLevel: impact.risk,
    };
  }

  private async analyzeCascadingImpact(
    action: string,
    affectedFile: string,
    directImpact: DependencyImpact
  ): Promise<DependencyImpact> {
    const dependencies = this.dependencyGraph.get(affectedFile) || [];
    const cascadingAffectedFiles = [
      ...dependencies.map((d) => d.file),
      ...this.findIncomingDependencies(affectedFile).map((d) => d.file),
    ];

    const impact = this.calculateImpactLevel(action, affectedFile, cascadingAffectedFiles, true);
    const consequences = this.generateCascadingConsequences(action, affectedFile, directImpact);
    const benefits = this.generateBenefits(action, affectedFile, {
      type: "cleanup" as const,
      prediction: "Cascading action benefits",
      confidence: 0.7,
      timeframe: "immediate",
      actionItems: [],
      reasoning: {
        primaryFactor: "cascading",
        contributingFactors: [],
        historicalEvidence: [],
        dataPoints: [],
        trendAnalysis: {
          direction: "stable" as const,
          rate: "none",
          duration: "immediate",
        },
      },
    });

    return {
      file: affectedFile,
      impact: impact.level,
      reason: impact.reason,
      affectedFiles: cascadingAffectedFiles,
      consequences,
      benefits,
      riskLevel: impact.risk,
    };
  }

  private findIncomingDependencies(filePath: string): FileDependency[] {
    const incoming: FileDependency[] = [];

    for (const [file, dependencies] of this.dependencyGraph.entries()) {
      for (const dep of dependencies) {
        if (dep.file === filePath) {
          incoming.push({
            file: file,
            path: file,
            type: dep.type,
            strength: dep.strength,
            direction: "incoming",
            category: this.fileMetadata.get(file)?.category || "unknown",
          });
        }
      }
    }

    return incoming;
  }

  private calculateImpactLevel(
    action: string,
    targetFile: string,
    affectedFiles: string[],
    _isCascading = false
  ): {
    level: "critical" | "high" | "medium" | "low" | "none";
    reason: string;
    risk: "critical" | "high" | "medium" | "low";
  } {
    const fileMetadata = this.fileMetadata.get(targetFile);
    const importance = fileMetadata?.importance || "low";

    let level: "critical" | "high" | "medium" | "low" | "none" = "low";
    let reason = "";
    let risk: "critical" | "high" | "medium" | "low" = "low";

    // Critical files
    if (importance === "critical") {
      level = "critical";
      reason = "File is critical to system operation";
      risk = "critical";
    }
    // High importance files with many dependencies
    else if (importance === "high" && affectedFiles.length > 5) {
      level = "high";
      reason = `High importance file affects ${affectedFiles.length} other files`;
      risk = "high";
    }
    // Medium importance with moderate dependencies
    else if (importance === "medium" && affectedFiles.length > 2) {
      level = "medium";
      reason = `Medium importance file affects ${affectedFiles.length} other files`;
      risk = "medium";
    }
    // Low impact
    else if (affectedFiles.length === 0) {
      level = "none";
      reason = "File has no dependencies";
      risk = "low";
    } else {
      level = "low";
      reason = `File affects ${affectedFiles.length} other files`;
      risk = "low";
    }

    // Adjust based on action type
    if (action === "delete") {
      risk = this.escalateRisk(risk);
    } else if (action === "move") {
      risk = this.deescalateRisk(risk);
    }

    return { level, reason, risk };
  }

  private generateConsequences(
    action: string,
    _targetFile: string,
    affectedFiles: string[]
  ): string[] {
    const consequences: string[] = [];

    if (action === "delete") {
      consequences.push(`${affectedFiles.length} files may lose references`);
      if (affectedFiles.length > 0) {
        consequences.push("Potential broken imports/requires");
        consequences.push("Runtime errors may occur");
      }
    } else if (action === "move") {
      consequences.push(`${affectedFiles.length} files may need path updates`);
      consequences.push("Import statements may need updating");
    } else if (action === "archive") {
      consequences.push(`${affectedFiles.length} files may reference archived content`);
      consequences.push("Build processes may be affected");
    }

    return consequences;
  }

  private generateCascadingConsequences(
    action: string,
    _affectedFile: string,
    directImpact: DependencyImpact
  ): string[] {
    const consequences: string[] = [];

    consequences.push(`Indirectly affected by ${action} on ${directImpact.file}`);
    consequences.push("May inherit dependency issues");

    if (directImpact.impact === "critical") {
      consequences.push("Critical failure may cascade");
    }

    return consequences;
  }

  private generateBenefits(action: string, _target: string, _insight: PredictiveInsight): string[] {
    const benefits: string[] = [];

    if (action === "cleanup") {
      benefits.push("Reduces clutter and improves organization");
      benefits.push("May improve build performance");
    } else if (action === "archive") {
      benefits.push("Frees up storage space");
      benefits.push("Maintains file accessibility");
    } else if (action === "organize") {
      benefits.push("Improves file structure");
      benefits.push("Enhances maintainability");
    }

    return benefits;
  }

  private calculateOverallRisk(
    directImpacts: DependencyImpact[],
    cascadingImpacts: DependencyImpact[]
  ): "critical" | "high" | "medium" | "low" {
    const allImpacts = [...directImpacts, ...cascadingImpacts];

    const criticalCount = allImpacts.filter((i) => i.riskLevel === "critical").length;
    const highCount = allImpacts.filter((i) => i.riskLevel === "high").length;
    const mediumCount = allImpacts.filter((i) => i.riskLevel === "medium").length;

    if (criticalCount > 0) return "critical";
    if (highCount > 2) return "critical";
    if (highCount > 0) return "high";
    if (mediumCount > 3) return "high";
    if (mediumCount > 0) return "medium";
    return "low";
  }

  private generateRecommendations(
    action: string,
    directImpacts: DependencyImpact[],
    cascadingImpacts: DependencyImpact[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalImpacts = [...directImpacts, ...cascadingImpacts].filter(
      (i) => i.riskLevel === "critical"
    );
    const highImpacts = [...directImpacts, ...cascadingImpacts].filter(
      (i) => i.riskLevel === "high"
    );

    if (criticalImpacts.length > 0) {
      recommendations.push("⚠️ CRITICAL: Review critical files before proceeding");
      recommendations.push("Consider creating backups of affected files");
      recommendations.push("Test in development environment first");
    }

    if (highImpacts.length > 0) {
      recommendations.push("🔒 HIGH RISK: Update import statements in affected files");
      recommendations.push("Run tests after action completion");
    }

    if (action === "delete") {
      recommendations.push("🗑️ Consider archiving instead of deleting");
      recommendations.push("Check for unused dependencies first");
    }

    recommendations.push("📊 Monitor system behavior after changes");

    return recommendations;
  }

  private generateAlternativeActions(
    action: string,
    _targetFiles: string[]
  ): {
    action: string;
    risk: "critical" | "high" | "medium" | "low";
    benefits: string[];
    description: string;
  }[] {
    const alternatives: {
      action: string;
      risk: "critical" | "high" | "medium" | "low";
      benefits: string[];
      description: string;
    }[] = [];

    if (action === "delete") {
      alternatives.push({
        action: "archive",
        risk: "low",
        benefits: ["Preserves file access", "Reversible action", "Frees storage space"],
        description: "Move files to archive instead of deleting",
      });

      alternatives.push({
        action: "move",
        risk: "medium",
        benefits: ["Keeps files accessible", "Reduces primary storage", "Maintains structure"],
        description: "Move to different directory within project",
      });
    }

    if (action === "cleanup") {
      alternatives.push({
        action: "organize",
        risk: "low",
        benefits: ["Better structure", "Improved maintainability", "No data loss"],
        description: "Organize files instead of removing them",
      });
    }

    return alternatives;
  }

  // Utility methods
  private getFileType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext || "unknown";
  }

  private getDirectory(filePath: string): string {
    return filePath.split(/[/\\]/).slice(0, -1).join("/") || "";
  }

  private getBaseName(filePath: string): string {
    return filePath.split(/[/\\]/).pop()?.split(".")[0] || "";
  }

  private getProjectRoot(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    // Find common project root indicators
    const projectIndicators = ["src", "lib", "app", "components", "utils"];
    for (let i = 0; i < parts.length; i++) {
      if (projectIndicators.includes(parts[i])) {
        return parts.slice(0, i).join("/");
      }
    }
    return parts[0] || "";
  }

  private calculateFileImportance(file: any): "critical" | "high" | "medium" | "low" {
    const path = file.path.toLowerCase();

    // Critical files
    if (path.includes("index.") || path.includes("main.") || path.includes("app.")) {
      return "critical";
    }

    // High importance
    if (path.includes("config") || path.includes("package.json") || path.includes("tsconfig")) {
      return "high";
    }

    // Medium importance
    if (path.includes("src/") || path.includes("lib/") || path.includes("components/")) {
      return "medium";
    }

    return "low";
  }

  private escalateRisk(
    risk: "critical" | "high" | "medium" | "low"
  ): "critical" | "high" | "medium" | "low" {
    const riskLevels = ["low", "medium", "high", "critical"];
    const currentIndex = riskLevels.indexOf(risk);
    return riskLevels[Math.min(currentIndex + 1, riskLevels.length - 1)] as any;
  }

  private deescalateRisk(
    risk: "critical" | "high" | "medium" | "low"
  ): "critical" | "high" | "medium" | "low" {
    const riskLevels = ["low", "medium", "high", "critical"];
    const currentIndex = riskLevels.indexOf(risk);
    return riskLevels[Math.max(currentIndex - 1, 0)] as any;
  }

  // Enhanced Code Analysis Methods
  async analyzeCodeFile(filePath: string): Promise<CodeAnalysisResult> {
    // Check cache first
    if (this.codeAnalysisCache.has(filePath)) {
      return this.codeAnalysisCache.get(filePath)!;
    }

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const fileType = this.getFileType(filePath);

      let analysis: CodeAnalysisResult;

      switch (fileType) {
        case "javascript":
        case "typescript":
          analysis = await this.analyzeJavaScriptFile(filePath, content);
          break;
        case "python":
          analysis = await this.analyzePythonFile(filePath, content);
          break;
        default:
          analysis = this.createEmptyAnalysis(filePath);
      }

      // Cache the result
      this.codeAnalysisCache.set(filePath, analysis);
      return analysis;
    } catch (error) {
      console.error(`Failed to analyze code file ${filePath}:`, error);
      return this.createEmptyAnalysis(filePath);
    }
  }

  private async analyzeJavaScriptFile(
    filePath: string,
    content: string
  ): Promise<CodeAnalysisResult> {
    const lines = content.split("\n");
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    const variables: VariableInfo[] = [];
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    // Parse imports
    const importRegex = new RegExp(
      "import\\s+(?:(?:\\*\\s+as\\s+(\\w+)|(\\w+)\\s*,\\s*\\{([^}]+)\\}|(\\w+)|\\{([^}]+)\\})\\s+from\\s+['\"]([^'\"]+)['\"]|require\\s*\\(['\"]([^'\"]+)['\"]\\))",
      "g"
    );
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const source = match[7] || match[8];
      const name = match[1] || match[2] || match[4] || match[5];

      imports.push({
        source,
        type: name === "*" ? "namespace" : name ? "named" : "default",
        name,
        localName: name,
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
        isUsed: false, // Will be determined later
      });
    }

    // Parse exports
    const exportRegex =
      /export\s+(?:(?:default\s+(?:(?:class|function|const|let|var)\s+(\w+)|\{([^}]+)\})|(?:class|function|const|let|var)\s+(\w+))|(\{[^}]+\})\s*from\s+['"]([^'"]+)['"])/g;

    while ((match = exportRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1] || match[3] || match[4];
      const type = match[5] ? "re-export" : name ? "named" : "default";

      exports.push({
        name: name || "default",
        type: type as any,
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
        isUsed: false,
        usedBy: [],
      });
    }

    // Parse functions
    const functionRegex = new RegExp(
      "(?:function\\s+(\\w+)|const\\s+(\\w+)\\s*=\\s*(?:function\\s*\\([^)]*\\)|\\([^)]*\\)\\s*=>)|(\\w+)\\s*\\([^)]*\\)\\s*\\{",
      "g"
    );

    while ((match = functionRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1] || match[2] || match[3];

      if (name) {
        functions.push({
          name,
          isExported: exports.some((e) => e.name === name),
          isUsed: false,
          parameters: [],
          calls: [],
          line,
          column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
        });
      }
    }

    // Parse classes
    const classRegex = /class\s+(\w+)/g;

    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1];

      classes.push({
        name,
        isExported: exports.some((e) => e.name === name),
        isUsed: false,
        methods: [],
        properties: [],
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
      });
    }

    // Parse variables
    const variableRegex = /(?:const|let|var)\s+(\w+)\s*=/g;

    while ((match = variableRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1];
      const declaration = content.substring(0, match.index);
      const varType = declaration.includes("const")
        ? "const"
        : declaration.includes("let")
          ? "let"
          : "var";

      variables.push({
        name,
        type: varType as any,
        isUsed: false,
        isExported: exports.some((e) => e.name === name),
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
      });
    }

    // Analyze usage
    await this.analyzeUsage(filePath, content, imports, exports, variables, functions, classes);

    // Find unused imports
    const unusedImports = imports.filter((imp) => !imp.isUsed);

    // Find missing imports (simplified)
    const missingImports = this.findMissingImports(content, imports, variables, functions, classes);

    // Find circular dependencies
    const circularDependencies = await this.findCircularDependencies(filePath);

    // Find dead code
    const deadCode = this.findDeadCode(variables, functions, classes, imports);

    return {
      filePath,
      imports,
      exports,
      unusedImports,
      missingImports,
      circularDependencies,
      deadCode,
      variables,
      functions,
      classes,
    };
  }

  private async analyzePythonFile(filePath: string, content: string): Promise<CodeAnalysisResult> {
    // Similar implementation for Python files
    const lines = content.split("\n");
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    const variables: VariableInfo[] = [];
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    // Parse Python imports
    const importRegex = /(?:from\s+(\S+)\s+import\s+(.+)|import\s+(.+))/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const source = match[1] || match[3];
      const names = match[2] || match[3];

      imports.push({
        source,
        type: "named",
        name: names,
        localName: names,
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
        isUsed: false,
      });
    }

    // Parse Python functions
    const functionRegex = /def\s+(\w+)\s*\(/g;

    while ((match = functionRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1];

      functions.push({
        name,
        isExported: true, // Python functions are generally exportable
        isUsed: false,
        parameters: [],
        calls: [],
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
      });
    }

    // Parse Python classes
    const classRegex = /class\s+(\w+)/g;

    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const name = match[1];

      classes.push({
        name,
        isExported: true,
        isUsed: false,
        methods: [],
        properties: [],
        line,
        column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
      });
    }

    return {
      filePath,
      imports,
      exports,
      unusedImports: [],
      missingImports: [],
      circularDependencies: [],
      deadCode: [],
      variables,
      functions,
      classes,
    };
  }

  private async analyzeUsage(
    filePath: string,
    content: string,
    imports: ImportStatement[],
    exports: ExportStatement[],
    variables: VariableInfo[],
    functions: FunctionInfo[],
    classes: ClassInfo[]
  ): Promise<void> {
    // Mark imports as used if they appear in the code
    for (const imp of imports) {
      const regex = new RegExp(`\\b${imp.localName || imp.name}\\b`, "g");
      if (regex.test(content)) {
        imp.isUsed = true;
      }
    }

    // Mark exports as used if they appear in other files
    for (const exp of exports) {
      // This would require cross-file analysis
      // For now, we'll mark exports as potentially unused
      exp.isUsed = false;
    }

    // Mark variables as used
    for (const variable of variables) {
      const regex = new RegExp(`\\b${variable.name}\\b`, "g");
      variable.isUsed = regex.test(
        content.replace(new RegExp(`(?:const|let|var)\\s+${variable.name}\\s*=`), "")
      );
    }

    // Mark functions as used
    for (const func of functions) {
      const regex = new RegExp(`\\b${func.name}\\s*\\(`, "g");
      func.isUsed = regex.test(
        content.replace(
          new RegExp(`function\\s+${func.name}\\s*\\(|const\\s+${func.name}\\s*=\\s*function`),
          ""
        )
      );
    }

    // Mark classes as used
    for (const cls of classes) {
      const regex = new RegExp(`\\bnew\\s+${cls.name}\\b|\\bclass\\s+${cls.name}\\s+extends`, "g");
      cls.isUsed = regex.test(content.replace(new RegExp(`class\\s+${cls.name}\\s*`), ""));
    }
  }

  private findMissingImports(
    content: string,
    imports: ImportStatement[],
    variables: VariableInfo[],
    functions: FunctionInfo[],
    classes: ClassInfo[]
  ): MissingImport[] {
    const missingImports: MissingImport[] = [];
    const importedNames = new Set(imports.map((imp) => imp.localName || imp.name));

    // Find function calls that don't match imports
    const functionCallRegex = /(\w+)\s*\(/g;
    let match;

    while ((match = functionCallRegex.exec(content)) !== null) {
      const name = match[1];

      if (
        !importedNames.has(name) &&
        !variables.some((v) => v.name === name) &&
        !functions.some((f) => f.name === name) &&
        !this.isJavaScriptBuiltin(name)
      ) {
        missingImports.push({
          name,
          type: "function",
          line: content.substring(0, match.index).split("\n").length,
          column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
          suggestedSource: this.suggestImportSource(name),
        });
      }
    }

    return missingImports;
  }

  private async findCircularDependencies(filePath: string): Promise<CircularDependency[]> {
    const circularDependencies: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (currentPath: string, path: string[]): boolean => {
      if (recursionStack.has(currentPath)) {
        // Found a cycle
        const cycleStart = path.indexOf(currentPath);
        const cycle = path.slice(cycleStart).concat([currentPath]);

        circularDependencies.push({
          files: cycle,
          severity: cycle.length > 3 ? "high" : cycle.length > 2 ? "medium" : "low",
          description: `Circular dependency detected: ${cycle.join(" → ")}`,
        });

        return true;
      }

      if (visited.has(currentPath)) {
        return false;
      }

      visited.add(currentPath);
      recursionStack.add(currentPath);

      const dependencies = this.dependencyGraph.get(currentPath) || [];
      for (const dep of dependencies) {
        if (dfs(dep.file, path.concat([currentPath]))) {
          return true;
        }
      }

      recursionStack.delete(currentPath);
      return false;
    };

    dfs(filePath, []);

    return circularDependencies;
  }

  private findDeadCode(
    variables: VariableInfo[],
    functions: FunctionInfo[],
    classes: ClassInfo[],
    imports: ImportStatement[]
  ): DeadCodeSegment[] {
    const deadCode: DeadCodeSegment[] = [];

    // Unused variables
    for (const variable of variables) {
      if (!variable.isUsed && !variable.isExported) {
        deadCode.push({
          type: "variable",
          name: variable.name,
          line: variable.line,
          column: variable.column,
          size: 1,
          reason: "Variable is never used",
        });
      }
    }

    // Unused functions
    for (const func of functions) {
      if (!func.isUsed && !func.isExported) {
        deadCode.push({
          type: "function",
          name: func.name,
          line: func.line,
          column: func.column,
          size: 10, // Estimated size
          reason: "Function is never called",
        });
      }
    }

    // Unused classes
    for (const cls of classes) {
      if (!cls.isUsed && !cls.isExported) {
        deadCode.push({
          type: "class",
          name: cls.name,
          line: cls.line,
          column: cls.column,
          size: 20, // Estimated size
          reason: "Class is never instantiated",
        });
      }
    }

    // Unused imports
    for (const imp of imports) {
      if (!imp.isUsed) {
        deadCode.push({
          type: "import",
          name: imp.source,
          line: imp.line,
          column: imp.column,
          size: 1,
          reason: "Import is never used",
        });
      }
    }

    return deadCode;
  }

  private isJavaScriptBuiltin(name: string): boolean {
    const builtins = [
      "console",
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
      "Promise",
      "Array",
      "Object",
      "String",
      "Number",
      "Boolean",
      "Date",
      "Math",
      "JSON",
      "RegExp",
      "Error",
      "Map",
      "Set",
      "WeakMap",
      "WeakSet",
      "fetch",
      "localStorage",
      "sessionStorage",
      "window",
      "document",
      "navigator",
    ];
    return builtins.includes(name);
  }

  private suggestImportSource(name: string): string {
    // Simple heuristic for suggesting import sources
    const commonSources: { [key: string]: string } = {
      React: "react",
      useState: "react",
      useEffect: "react",
      Component: "react",
      axios: "axios",
      lodash: "lodash",
      moment: "moment",
      uuid: "uuid",
      classnames: "classnames",
    };

    return commonSources[name] || "";
  }

  private createEmptyAnalysis(filePath: string): CodeAnalysisResult {
    return {
      filePath,
      imports: [],
      exports: [],
      unusedImports: [],
      missingImports: [],
      circularDependencies: [],
      deadCode: [],
      variables: [],
      functions: [],
      classes: [],
    };
  }

  // Integration Flow Tracing Methods
  async traceFrontendBackendConnections(files: any[]): Promise<{
    frontendComponents: ComponentConnection[];
    backendEndpoints: EndpointConnection[];
    connections: FrontendBackendConnection[];
    missingConnections: MissingConnection[];
  }> {
    const frontendFiles = files.filter(
      (f) => f.path.endsWith(".tsx") || f.path.endsWith(".jsx") || f.path.endsWith(".vue")
    );
    const backendFiles = files.filter(
      (f) => f.path.endsWith(".py") || f.path.endsWith(".js") || f.path.endsWith(".ts")
    );

    const frontendComponents = await this.analyzeFrontendComponents(frontendFiles);
    const backendEndpoints = await this.analyzeBackendEndpoints(backendFiles);
    const connections = await this.findConnections(frontendComponents, backendEndpoints);
    const missingConnections = await this.findMissingConnections(
      frontendComponents,
      backendEndpoints
    );

    return {
      frontendComponents,
      backendEndpoints,
      connections,
      missingConnections,
    };
  }

  private async analyzeFrontendComponents(files: any[]): Promise<ComponentConnection[]> {
    const components: ComponentConnection[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, "utf8");
        const analysis = await this.analyzeCodeFile(file.path);

        // Find button click handlers
        const buttonClickRegex = /onClick\s*=\{(?:([^}]+)|([^)]+)\s*=>\s*([^}]+))\}/g;
        let match;

        while ((match = buttonClickRegex.exec(content)) !== null) {
          const handler = match[1] || match[2];
          const line = content.substring(0, match.index).split("\n").length;

          components.push({
            filePath: file.path,
            componentName: this.extractComponentName(file.path),
            type: "button",
            handler: handler.trim(),
            line,
            column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
            apiCalls: this.extractAPICalls(handler),
          });
        }

        // Find API calls
        for (const func of analysis.functions) {
          const apiCalls = this.extractAPICallsFromFunction(func, content);
          if (apiCalls.length > 0) {
            components.push({
              filePath: file.path,
              componentName: this.extractComponentName(file.path),
              type: "function",
              handler: func.name,
              line: func.line,
              column: func.column,
              apiCalls,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze frontend component ${file.path}:`, error);
      }
    }

    return components;
  }

  private async analyzeBackendEndpoints(files: any[]): Promise<EndpointConnection[]> {
    const endpoints: EndpointConnection[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, "utf8");

        // Find API endpoints (simplified for different frameworks)
        const endpointPatterns = [
          /app\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // Flask
          /router\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // Express
          /@\w+\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // FastAPI
        ];

        for (const pattern of endpointPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const endpoint = match[1];
            const method = this.extractHTTPMethod(match[0]);
            const line = content.substring(0, match.index).split("\n").length;

            endpoints.push({
              filePath: file.path,
              endpoint,
              method,
              line,
              column: match.index - content.lastIndexOf("\n", match.index - 1) - 1,
              parameters: this.extractParameters(content, match.index),
              responses: this.extractResponses(content, match.index),
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze backend endpoints in ${file.path}:`, error);
      }
    }

    return endpoints;
  }

  private async findConnections(
    frontendComponents: ComponentConnection[],
    backendEndpoints: EndpointConnection[]
  ): Promise<FrontendBackendConnection[]> {
    const connections: FrontendBackendConnection[] = [];

    for (const component of frontendComponents) {
      for (const apiCall of component.apiCalls) {
        const matchingEndpoint = backendEndpoints.find(
          (endpoint) =>
            endpoint.endpoint === apiCall.endpoint ||
            endpoint.endpoint.includes(apiCall.endpoint) ||
            apiCall.endpoint.includes(endpoint.endpoint)
        );

        if (matchingEndpoint) {
          connections.push({
            frontendComponent: component,
            backendEndpoint: matchingEndpoint,
            confidence: this.calculateConnectionConfidence(component, matchingEndpoint),
            issues: [],
          });
        }
      }
    }

    return connections;
  }

  private async findMissingConnections(
    frontendComponents: ComponentConnection[],
    backendEndpoints: EndpointConnection[]
  ): Promise<MissingConnection[]> {
    const missingConnections: MissingConnection[] = [];

    for (const component of frontendComponents) {
      for (const apiCall of component.apiCalls) {
        const matchingEndpoint = backendEndpoints.find(
          (endpoint) =>
            endpoint.endpoint === apiCall.endpoint ||
            endpoint.endpoint.includes(apiCall.endpoint) ||
            apiCall.endpoint.includes(endpoint.endpoint)
        );

        if (!matchingEndpoint) {
          missingConnections.push({
            frontendComponent: component,
            apiCall,
            suggestedEndpoint: this.suggestEndpoint(apiCall),
            confidence: "low",
          });
        }
      }
    }

    return missingConnections;
  }

  // Helper methods for integration tracing
  private extractComponentName(filePath: string): string {
    const basename = filePath.split(/[/\\]/).pop() || "";
    return basename.replace(/\.(tsx?|jsx?|vue)$/, "");
  }

  private extractAPICalls(handler: string): APICall[] {
    const calls: APICall[] = [];
    const apiCallPatterns = [
      /fetch\s*\(\s*['"]([^'"]+)['"]/, // fetch
      /axios\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // axios
      /\.get\s*\(\s*['"]([^'"]+)['"]/, // HTTP client get
      /\.post\s*\(\s*['"]([^'"]+)['"]/, // HTTP client post
    ];

    for (const pattern of apiCallPatterns) {
      let match;
      while ((match = pattern.exec(handler)) !== null) {
        calls.push({
          endpoint: match[1],
          method: this.extractHTTPMethod(match[0]),
          line: 0, // Would need more sophisticated parsing
          column: 0,
        });
      }
    }

    return calls;
  }

  private extractAPICallsFromFunction(func: FunctionInfo, content: string): APICall[] {
    // Extract the function body and analyze for API calls
    const functionStart = content.indexOf(func.name);
    if (functionStart === -1) return [];

    // This is a simplified implementation
    // In a real implementation, you'd need proper AST parsing
    return this.extractAPICalls(content.substring(functionStart, functionStart + 1000));
  }

  private extractHTTPMethod(match: string): string {
    if (match.includes("get")) return "GET";
    if (match.includes("post")) return "POST";
    if (match.includes("put")) return "PUT";
    if (match.includes("delete")) return "DELETE";
    if (match.includes("patch")) return "PATCH";
    return "GET";
  }

  private extractParameters(content: string, position: number): string[] {
    // Simplified parameter extraction
    return [];
  }

  private extractResponses(content: string, position: number): string[] {
    // Simplified response extraction
    return [];
  }

  private calculateConnectionConfidence(
    component: ComponentConnection,
    endpoint: EndpointConnection
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if endpoint names match exactly
    if (component.apiCalls.some((call) => call.endpoint === endpoint.endpoint)) {
      confidence += 0.3;
    }

    // Higher confidence if HTTP methods match
    if (component.apiCalls.some((call) => call.method === endpoint.method)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private suggestEndpoint(apiCall: APICall): string {
    // Simple suggestion based on common patterns
    if (apiCall.endpoint.includes("/api/")) {
      return apiCall.endpoint;
    }

    return `/api${apiCall.endpoint.startsWith("/") ? "" : "/"}${apiCall.endpoint}`;
  }

  // Public API methods
  async getDependencyGraph(): Promise<Map<string, FileDependency[]>> {
    return this.dependencyGraph;
  }

  async getFileDependencies(filePath: string): Promise<FileDependency[]> {
    return this.dependencyGraph.get(filePath) || [];
  }

  async getProjectDependencies(): Promise<{ [project: string]: string[] }> {
    const projects: { [project: string]: string[] } = {};

    for (const [file, _dependencies] of this.dependencyGraph.entries()) {
      const project = this.getProjectRoot(file);
      if (!projects[project]) {
        projects[project] = [];
      }
      projects[project].push(file);
    }

    return projects;
  }

  // New public methods for enhanced features
  async getCodeAnalysis(filePath: string): Promise<CodeAnalysisResult> {
    return this.analyzeCodeFile(filePath);
  }

  async getAllCodeAnalyses(files: any[]): Promise<Map<string, CodeAnalysisResult>> {
    const analyses = new Map<string, CodeAnalysisResult>();

    for (const file of files) {
      if (this.isCodeFile(file.path)) {
        const analysis = await this.analyzeCodeFile(file.path);
        analyses.set(file.path, analysis);
      }
    }

    return analyses;
  }

  async getIntegrationFlowAnalysis(files: any[]): Promise<{
    frontendComponents: ComponentConnection[];
    backendEndpoints: EndpointConnection[];
    connections: FrontendBackendConnection[];
    missingConnections: MissingConnection[];
  }> {
    return this.traceFrontendBackendConnections(files);
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".h"];
    return codeExtensions.some((ext) => filePath.endsWith(ext));
  }
}

// Additional interfaces for integration tracing
interface ComponentConnection {
  filePath: string;
  componentName: string;
  type: "button" | "function" | "effect";
  handler: string;
  line: number;
  column: number;
  apiCalls: APICall[];
}

interface EndpointConnection {
  filePath: string;
  endpoint: string;
  method: string;
  line: number;
  column: number;
  parameters: string[];
  responses: string[];
}

interface APICall {
  endpoint: string;
  method: string;
  line: number;
  column: number;
}

interface FrontendBackendConnection {
  frontendComponent: ComponentConnection;
  backendEndpoint: EndpointConnection;
  confidence: number;
  issues: string[];
}

interface MissingConnection {
  frontendComponent: ComponentConnection;
  apiCall: APICall;
  suggestedEndpoint: string;
  confidence: "low" | "medium" | "high";
}

export const dependencyCheckerService = DependencyCheckerService.getInstance();
