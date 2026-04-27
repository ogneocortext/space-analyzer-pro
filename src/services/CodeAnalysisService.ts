/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

import { dependencyCheckerService } from "./DependencyCheckerService";

export interface CodeIssue {
  file: string;
  line: number;
  column: number;
  type:
    | "missing_dependency"
    | "unused_variable"
    | "unused_import"
    | "undefined_variable"
    | "dead_code"
    | "potential_bug";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string;
  code?: string;
}

export interface ProjectHealthMetrics {
  totalFiles: number;
  filesWithIssues: number;
  totalIssues: number;
  issuesByType: { [key: string]: number };
  issuesBySeverity: { [key: string]: number };
  healthScore: number; // 0-100
  recommendations: string[];
}

export interface DependencyHealthAnalysis {
  missingDependencies: {
    dependency: string;
    files: string[];
    suggestedPackage: string;
    installCommand: string;
    severity: "error" | "warning";
  }[];
  unusedImports: {
    file: string;
    imports: string[];
    linesToRemove: number[];
  }[];
  unusedVariables: {
    file: string;
    variables: { name: string; line: number; type: string }[];
  }[];
  undefinedVariables: {
    file: string;
    variables: { name: string; line: number; usageCount: number }[];
  }[];
  deadCode: {
    file: string;
    functions: { name: string; line: number; reason: string }[];
    classes: { name: string; line: number; reason: string }[];
  }[];
  potentialBugs: {
    file: string;
    issues: { type: string; line: number; description: string; suggestion: string }[];
  }[];
}

export class CodeAnalysisService {
  private static instance: CodeAnalysisService;

  static getInstance(): CodeAnalysisService {
    if (!CodeAnalysisService.instance) {
      CodeAnalysisService.instance = new CodeAnalysisService();
    }
    return CodeAnalysisService.instance;
  }

  async analyzeCodeHealth(files: any[]): Promise<ProjectHealthMetrics> {
    console.warn("🔍 Analyzing code health...");

    const issues: CodeIssue[] = [];
    const filesWithIssues = new Set<string>();

    // Analyze each file for issues
    for (const file of files) {
      const fileIssues = await this.analyzeFile(file);
      issues.push(...fileIssues);

      if (fileIssues.length > 0) {
        filesWithIssues.add(file.path);
      }
    }

    // Calculate metrics
    const issuesByType = this.groupIssuesByType(issues);
    const issuesBySeverity = this.groupIssuesBySeverity(issues);
    const healthScore = this.calculateHealthScore(files.length, issues.length, issuesBySeverity);
    const recommendations = this.generateHealthRecommendations(issuesByType, issuesBySeverity);

    return {
      totalFiles: files.length,
      filesWithIssues: filesWithIssues.size,
      totalIssues: issues.length,
      issuesByType,
      issuesBySeverity,
      healthScore,
      recommendations,
    };
  }

  async analyzeDependencies(files: any[]): Promise<DependencyHealthAnalysis> {
    console.warn("🔗 Analyzing dependency health...");

    const analysis: DependencyHealthAnalysis = {
      missingDependencies: [],
      unusedImports: [],
      unusedVariables: [],
      undefinedVariables: [],
      deadCode: [],
      potentialBugs: [],
    };

    // Group files by language
    const filesByLanguage = this.groupFilesByLanguage(files);

    // Analyze each language group
    for (const [language, languageFiles] of Object.entries(filesByLanguage)) {
      switch (language) {
        case "javascript":
        case "typescript":
          await this.analyzeJavaScriptFiles(languageFiles, analysis);
          break;
        case "python":
          await this.analyzePythonFiles(languageFiles, analysis);
          break;
        case "react":
          await this.analyzeReactFiles(languageFiles, analysis);
          break;
      }
    }

    return analysis;
  }

  private async analyzeFile(file: any): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    try {
      const fileType = this.getFileType(file.path);
      const content = await this.readFileContent(file);

      switch (fileType) {
        case "javascript":
        case "typescript":
          issues.push(...this.analyzeJavaScriptFile(file.path, content));
          break;
        case "python":
          issues.push(...this.analyzePythonFile(file.path, content));
          break;
        case "react":
          issues.push(...this.analyzeReactFile(file.path, content));
          break;
      }
    } catch (error) {
      console.error(`Failed to analyze file ${file.path}:`, error);
    }

    return issues;
  }

  private async analyzeJavaScriptFiles(files: any[], analysis: DependencyHealthAnalysis) {
    for (const file of files) {
      try {
        const content = await this.readFileContent(file);
        const jsAnalysis = this.analyzeJavaScriptDependencies(file.path, content);

        // Merge results
        analysis.missingDependencies.push(...jsAnalysis.missingDependencies);
        analysis.unusedImports.push(...jsAnalysis.unusedImports);
        analysis.unusedVariables.push(...jsAnalysis.unusedVariables);
        analysis.undefinedVariables.push(...jsAnalysis.undefinedVariables);
        analysis.deadCode.push(...jsAnalysis.deadCode);
        analysis.potentialBugs.push(...jsAnalysis.potentialBugs);
      } catch (error) {
        console.error(`Failed to analyze JavaScript file ${file.path}:`, error);
      }
    }
  }

  private async analyzePythonFiles(files: any[], analysis: DependencyHealthAnalysis) {
    for (const file of files) {
      try {
        const content = await this.readFileContent(file);
        const pyAnalysis = this.analyzePythonDependencies(file.path, content);

        // Merge results
        analysis.missingDependencies.push(...pyAnalysis.missingDependencies);
        analysis.unusedImports.push(...pyAnalysis.unusedImports);
        analysis.unusedVariables.push(...pyAnalysis.unusedVariables);
        analysis.undefinedVariables.push(...pyAnalysis.undefinedVariables);
        analysis.deadCode.push(...pyAnalysis.deadCode);
        analysis.potentialBugs.push(...pyAnalysis.potentialBugs);
      } catch (error) {
        console.error(`Failed to analyze Python file ${file.path}:`, error);
      }
    }
  }

  private async analyzeReactFiles(files: any[], analysis: DependencyHealthAnalysis) {
    for (const file of files) {
      try {
        const content = await this.readFileContent(file);
        const reactAnalysis = this.analyzeReactDependencies(file.path, content);

        // Merge results
        analysis.missingDependencies.push(...reactAnalysis.missingDependencies);
        analysis.unusedImports.push(...reactAnalysis.unusedImports);
        analysis.unusedVariables.push(...reactAnalysis.unusedVariables);
        analysis.undefinedVariables.push(...reactAnalysis.undefinedVariables);
        analysis.deadCode.push(...reactAnalysis.deadCode);
        analysis.potentialBugs.push(...reactAnalysis.potentialBugs);
      } catch (error) {
        console.error(`Failed to analyze React file ${file.path}:`, error);
      }
    }
  }

  private analyzeJavaScriptDependencies(
    filePath: string,
    content: string
  ): DependencyHealthAnalysis {
    const analysis: DependencyHealthAnalysis = {
      missingDependencies: [],
      unusedImports: [],
      unusedVariables: [],
      undefinedVariables: [],
      deadCode: [],
      potentialBugs: [],
    };

    const lines = content.split("\n");

    // Find import statements
    const imports: { name: string; line: number; source: string }[] = [];
    const usedVariables = new Set<string>();
    const definedVariables = new Set<string>();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Import statements
      const importMatch = trimmedLine.match(/^(import|const)\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const importName = importMatch[0];
        const source = importMatch[2];
        imports.push({ name: importName, line: index + 1, source });

        // Check if it's a missing dependency
        if (this.isMissingDependency(source)) {
          analysis.missingDependencies.push({
            dependency: source,
            files: [filePath],
            suggestedPackage: this.suggestPackage(source),
            installCommand: `npm install ${source}`,
            severity: "error",
          });
        }
      }

      // Variable definitions
      const varMatch = trimmedLine.match(/^(const|let|var)\s+(\w+)/);
      if (varMatch) {
        definedVariables.add(varMatch[2]);
      }

      // Function definitions
      const funcMatch = trimmedLine.match(/^(function|const)\s+(\w+)/);
      if (funcMatch) {
        definedVariables.add(funcMatch[2]);
      }

      // Variable usage (simplified)
      const usageMatches = trimmedLine.match(/\b(\w+)\b/g);
      if (usageMatches) {
        usageMatches.forEach((match) => {
          if (definedVariables.has(match)) {
            usedVariables.add(match);
          }
        });
      }
    });

    // Find unused imports
    const unusedImportsList = imports.filter((imp) => {
      const importVar = imp.name.match(/\{([^}]+)\}/)?.[1] || imp.name.match(/import\s+(\w+)/)?.[1];
      return importVar && !usedVariables.has(importVar);
    });

    if (unusedImportsList.length > 0) {
      analysis.unusedImports.push({
        file: filePath,
        imports: unusedImportsList.map((imp) => imp.name),
        linesToRemove: unusedImportsList.map((imp) => imp.line),
      });
    }

    // Find unused variables
    const unusedVars = Array.from(definedVariables).filter(
      (varName) => !usedVariables.has(varName)
    );
    if (unusedVars.length > 0) {
      analysis.unusedVariables.push({
        file: filePath,
        variables: unusedVars.map((name) => ({ name, line: 0, type: "variable" })),
      });
    }

    return analysis;
  }

  private analyzePythonDependencies(filePath: string, content: string): DependencyHealthAnalysis {
    const analysis: DependencyHealthAnalysis = {
      missingDependencies: [],
      unusedImports: [],
      unusedVariables: [],
      undefinedVariables: [],
      deadCode: [],
      potentialBugs: [],
    };

    const lines = content.split("\n");

    // Find import statements
    const imports: { name: string; line: number; module: string }[] = [];
    const usedVariables = new Set<string>();
    const definedVariables = new Set<string>();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Import statements
      const importMatch = trimmedLine.match(/^(import|from)\s+(\w+)/);
      if (importMatch) {
        const moduleName = importMatch[2];
        imports.push({ name: trimmedLine, line: index + 1, module: moduleName });

        // Check if it's a missing dependency
        if (this.isMissingPythonDependency(moduleName)) {
          analysis.missingDependencies.push({
            dependency: moduleName,
            files: [filePath],
            suggestedPackage: this.suggestPythonPackage(moduleName),
            installCommand: `pip install ${moduleName}`,
            severity: "error",
          });
        }
      }

      // Variable definitions
      const varMatch = trimmedLine.match(/^(\w+)\s*=/);
      if (varMatch) {
        definedVariables.add(varMatch[1]);
      }

      // Function definitions
      const funcMatch = trimmedLine.match(/^(def|class)\s+(\w+)/);
      if (funcMatch) {
        definedVariables.add(funcMatch[2]);
      }

      // Variable usage (simplified)
      const usageMatches = trimmedLine.match(/\b(\w+)\b/g);
      if (usageMatches) {
        usageMatches.forEach((match) => {
          if (definedVariables.has(match)) {
            usedVariables.add(match);
          }
        });
      }
    });

    // Find unused imports
    const unusedImportsList = imports.filter((imp) => {
      return !usedVariables.has(imp.module);
    });

    if (unusedImportsList.length > 0) {
      analysis.unusedImports.push({
        file: filePath,
        imports: unusedImportsList.map((imp) => imp.name),
        linesToRemove: unusedImportsList.map((imp) => imp.line),
      });
    }

    // Find unused variables
    const unusedVars = Array.from(definedVariables).filter(
      (varName) => !usedVariables.has(varName)
    );
    if (unusedVars.length > 0) {
      analysis.unusedVariables.push({
        file: filePath,
        variables: unusedVars.map((name) => ({ name, line: 0, type: "variable" })),
      });
    }

    return analysis;
  }

  private analyzeReactDependencies(filePath: string, content: string): DependencyHealthAnalysis {
    const analysis: DependencyHealthAnalysis = {
      missingDependencies: [],
      unusedImports: [],
      unusedVariables: [],
      undefinedVariables: [],
      deadCode: [],
      potentialBugs: [],
    };

    const lines = content.split("\n");

    // React-specific analysis
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Check for React hooks usage
      if (trimmedLine.includes("useState") || trimmedLine.includes("useEffect")) {
        if (!content.includes("import React") && !content.includes("from 'react'")) {
          analysis.missingDependencies.push({
            dependency: "react",
            files: [filePath],
            suggestedPackage: "react",
            installCommand: "npm install react",
            severity: "error",
          });
        }
      }

      // Check for missing prop-types
      if (trimmedLine.includes("propTypes") && !content.includes("prop-types")) {
        analysis.missingDependencies.push({
          dependency: "prop-types",
          files: [filePath],
          suggestedPackage: "prop-types",
          installCommand: "npm install prop-types",
          severity: "warning",
        });
      }
    });

    // Include JavaScript analysis as well
    const jsAnalysis = this.analyzeJavaScriptDependencies(filePath, content);

    // Merge results
    analysis.missingDependencies.push(...jsAnalysis.missingDependencies);
    analysis.unusedImports.push(...jsAnalysis.unusedImports);
    analysis.unusedVariables.push(...jsAnalysis.unusedVariables);
    analysis.undefinedVariables.push(...jsAnalysis.undefinedVariables);
    analysis.deadCode.push(...jsAnalysis.deadCode);
    analysis.potentialBugs.push(...jsAnalysis.potentialBugs);

    return analysis;
  }

  private analyzeJavaScriptFile(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Check for common issues
      if (trimmedLine.includes("console.log") && !trimmedLine.includes("//")) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: trimmedLine.indexOf("console.log"),
          type: "potential_bug",
          severity: "warning",
          message: "Console.log statement found in production code",
          suggestion: "Remove or replace with proper logging",
          code: trimmedLine,
        });
      }

      // Check for unused variables (simplified)
      const varMatch = trimmedLine.match(/^(const|let|var)\s+(\w+)/);
      if (varMatch) {
        const varName = varMatch[2];
        // Simple check - in real implementation would be more sophisticated
        if (!content.includes(varName, content.indexOf(varMatch[0]) + varMatch[0].length)) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: varMatch[0].indexOf(varName),
            type: "unused_variable",
            severity: "warning",
            message: `Variable '${varName}' is defined but never used`,
            suggestion: "Remove the unused variable or use it in your code",
            code: trimmedLine,
          });
        }
      }
    });

    return issues;
  }

  private analyzePythonFile(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Check for common Python issues
      if (trimmedLine.includes("print(") && !trimmedLine.includes("#")) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: trimmedLine.indexOf("print("),
          type: "potential_bug",
          severity: "warning",
          message: "Print statement found in production code",
          suggestion: "Remove or replace with proper logging",
          code: trimmedLine,
        });
      }

      // Check for unused imports
      const importMatch = trimmedLine.match(/^(import|from)\s+(\w+)/);
      if (importMatch) {
        const moduleName = importMatch[2];
        // Simple check - in real implementation would be more sophisticated
        if (
          !content.includes(moduleName, content.indexOf(importMatch[0]) + importMatch[0].length)
        ) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: importMatch[0].indexOf(moduleName),
            type: "unused_import",
            severity: "warning",
            message: `Import '${moduleName}' is never used`,
            suggestion: "Remove the unused import",
            code: trimmedLine,
          });
        }
      }
    });

    return issues;
  }

  private analyzeReactFile(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split("\n");

    // React-specific issues
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Check for missing React import
      if (trimmedLine.includes("useState") || trimmedLine.includes("useEffect")) {
        if (!content.includes("import React") && !content.includes("from 'react'")) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: trimmedLine.match(/(useState|useEffect)/)?.index || 0,
            type: "missing_dependency",
            severity: "error",
            message: "React hooks used but React is not imported",
            suggestion: "Add \"import React from 'react'\" at the top of the file",
            code: trimmedLine,
          });
        }
      }

      // Check for missing key in lists
      if (trimmedLine.includes(".map(") && !trimmedLine.includes("key=")) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: trimmedLine.indexOf(".map("),
          type: "potential_bug",
          severity: "warning",
          message: 'Missing "key" prop in list rendering',
          suggestion: "Add a unique key prop to list items",
          code: trimmedLine,
        });
      }
    });

    return issues;
  }

  // Utility methods
  private getFileType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();

    if (["js", "jsx"].includes(ext || "")) return "javascript";
    if (["ts", "tsx"].includes(ext || "")) return "typescript";
    if (ext === "py") return "python";
    if (["jsx", "tsx"].includes(ext || "")) return "react";

    return "unknown";
  }

  private async readFileContent(file: any): Promise<string> {
    // In a real implementation, this would read the actual file content
    // For now, we'll simulate based on file patterns
    return `// Simulated content for ${file.path}`;
  }

  private groupFilesByLanguage(files: any[]): { [key: string]: any[] } {
    const grouped: { [key: string]: any[] } = {};

    files.forEach((file) => {
      const language = this.getFileType(file.path);
      if (!grouped[language]) {
        grouped[language] = [];
      }
      grouped[language].push(file);
    });

    return grouped;
  }

  private groupIssuesByType(issues: CodeIssue[]): { [key: string]: number } {
    const grouped: { [key: string]: number } = {};

    issues.forEach((issue) => {
      grouped[issue.type] = (grouped[issue.type] || 0) + 1;
    });

    return grouped;
  }

  private groupIssuesBySeverity(issues: CodeIssue[]): { [key: string]: number } {
    const grouped: { [key: string]: number } = {};

    issues.forEach((issue) => {
      grouped[issue.severity] = (grouped[issue.severity] || 0) + 1;
    });

    return grouped;
  }

  private calculateHealthScore(
    totalFiles: number,
    totalIssues: number,
    issuesBySeverity: { [key: string]: number }
  ): number {
    const errorCount = issuesBySeverity.error || 0;
    const warningCount = issuesBySeverity.warning || 0;
    const infoCount = issuesBySeverity.info || 0;

    // Weight issues by severity
    const weightedIssues = errorCount * 10 + warningCount * 3 + infoCount * 1;
    const maxPossibleIssues = totalFiles * 10; // Assume max 10 errors per file

    const score = Math.max(0, 100 - (weightedIssues / maxPossibleIssues) * 100);
    return Math.round(score);
  }

  private generateHealthRecommendations(
    issuesByType: { [key: string]: number },
    issuesBySeverity: { [key: string]: number }
  ): string[] {
    const recommendations: string[] = [];

    if (issuesBySeverity.error > 0) {
      recommendations.push(`🔴 Fix ${issuesBySeverity.error} critical errors first`);
    }

    if (issuesByType.missing_dependency > 0) {
      recommendations.push(`📦 Install ${issuesByType.missing_dependency} missing dependencies`);
    }

    if (issuesByType.unused_import > 0) {
      recommendations.push(`🧹 Remove ${issuesByType.unused_import} unused imports`);
    }

    if (issuesByType.unused_variable > 0) {
      recommendations.push(`🗑️ Clean up ${issuesByType.unused_variable} unused variables`);
    }

    if (issuesByType.potential_bug > 0) {
      recommendations.push(`🐛 Review ${issuesByType.potential_bug} potential bugs`);
    }

    return recommendations;
  }

  private isMissingDependency(dependency: string): boolean {
    // Common dependencies that might be missing
    const commonDeps = ["lodash", "axios", "moment", "react", "vue", "angular", "express"];
    return commonDeps.includes(dependency);
  }

  private isMissingPythonDependency(dependency: string): boolean {
    // Common Python dependencies that might be missing
    const commonDeps = ["numpy", "pandas", "requests", "flask", "django", "tensorflow", "pytorch"];
    return commonDeps.includes(dependency);
  }

  private suggestPackage(dependency: string): string {
    const suggestions: { [key: string]: string } = {
      lodash: "lodash",
      axios: "axios",
      moment: "moment",
      react: "react",
      vue: "vue",
      angular: "@angular/core",
    };

    return suggestions[dependency] || dependency;
  }

  private suggestPythonPackage(dependency: string): string {
    const suggestions: { [key: string]: string } = {
      numpy: "numpy",
      pandas: "pandas",
      requests: "requests",
      flask: "flask",
      django: "django",
      tensorflow: "tensorflow",
      pytorch: "torch",
    };

    return suggestions[dependency] || dependency;
  }
}

export const codeAnalysisService = CodeAnalysisService.getInstance();
