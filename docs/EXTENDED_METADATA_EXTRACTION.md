# Space Analyzer Pro 2026 - Extended Metadata Extraction Capabilities

**Date:** January 8, 2026  
**Document Type:** Technical Specification  
**Scope:** Directory Analysis Enhancement

---

## Executive Summary

This document outlines comprehensive metadata extraction capabilities that extend Space Analyzer Pro's information gathering beyond basic file statistics. Each capability integrates with the existing Rust CLI backend and outputs consistent JSON formats while providing deep insights for developers managing and maintaining projects.

---

## 1. Dependency Relationship Extraction

### Description
Map inter-file and inter-module dependency relationships to understand coupling, identify circular dependencies, and visualize architecture.

### Implementation Approach (Rust)

```rust
// cli/src/core/dependency_analyzer.rs

use std::collections::{HashMap, HashSet, BTreeMap};
use std::path::PathBuf;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub nodes: Vec<DependencyNode>,
    pub edges: Vec<DependencyEdge>,
    pub circular_dependencies: Vec<Vec<String>>,
    pub metrics: DependencyMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyNode {
    pub id: String,
    pub path: String,
    pub name: String,
    pub language: String,
    pub dependencies: Vec<String>,
    pub dependents: Vec<String>,
    pub lines_of_code: usize,
    pub complexity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyEdge {
    pub from: String,
    pub to: String,
    pub edge_type: DependencyType,
    pub strength: f64, // 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DependencyType {
    Import,
    Require,
    Include,
    Extend,
    Implement,
    Template,
    Style,
    Config,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyMetrics {
    pub total_nodes: usize,
    pub total_edges: usize,
    pub average_dependencies: f64,
    pub max_depth: usize,
    pub coupling: CouplingMetrics,
    pub instability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouplingMetrics {
    pub afferent_coupling: HashMap<String, usize>, // How many modules depend on this
    pub efferent_coupling: HashMap<String, usize>, // How many modules this depends on
    pub abstractness: f64,
    pub instability: f64,
}

impl DependencyAnalyzer {
    pub fn new() -> Self {
        Self {
            import_patterns: vec![
                // JavaScript/TypeScript
                Regex::new(r#"(?:import|from)\s+["']([^"']+)["']"#).unwrap(),
                Regex::new(r#"require\s*\(\s*["']([^"']+)["']\s*\)"#).unwrap(),
                // Python
                Regex::new(r#"^(?:from|import)\s+(\w+(?:\.\w+)*)"#).unwrap(),
                // Java
                Regex::new(r#"import\s+([a-zA-Z0-9_.]+);"#).unwrap(),
                // C/C++
                Regex::new(r#"#include\s*[<"]([^>"]+)[>"]"#).unwrap(),
                // Go
                Regex::new(r#"^\s*import\s*.*?"([^"]+)""#).unwrap(),
                // Rust
                Regex::new(r#"use\s+([a-zA-Z0-9_:]+)"#).unwrap(),
                // CSS
                Regex::new(r#"@import\s+["']([^"']+)["']"#).unwrap(),
            ],
            ..Default::default()
        }
    }

    pub async fn analyze(&self, project_path: &PathBuf) -> Result<DependencyGraph, AnalysisError> {
        let files = self.discover_source_files(project_path).await?;
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut all_dependencies: HashMap<String, HashSet<String>> = HashMap::new();
        
        // First pass: extract dependencies from each file
        for file in &files {
            if let Ok(content) = tokio::fs::read_to_string(file).await {
                let deps = self.extract_dependencies(file, &content);
                let node_id = self.node_id(file);
                all_dependencies.insert(node_id.clone(), deps);
            }
        }
        
        // Second pass: build nodes and edges
        for (node_id, deps) in &all_dependencies {
            let node = self.build_node(node_id, deps, &files);
            nodes.push(node);
            
            for dep in deps {
                edges.push(DependencyEdge {
                    from: node_id.clone(),
                    to: dep.clone(),
                    edge_type: self.classify_dependency(dep),
                    strength: self.calculate_strength(dep),
                });
            }
        }
        
        // Detect circular dependencies
        let circular = self.detect_circular_dependencies(&edges);
        
        // Calculate metrics
        let metrics = self.calculate_metrics(&nodes, &edges);
        
        Ok(DependencyGraph {
            nodes,
            edges,
            circular_dependencies: circular,
            metrics,
        })
    }

    fn extract_dependencies(&self, file: &PathBuf, content: &str) -> HashSet<String> {
        let mut deps = HashSet::new();
        
        for pattern in &self.import_patterns {
            for cap in pattern.captures_iter(content) {
                if let Some(m) = cap.get(1) {
                    let normalized = self.normalize_dependency(m.as_str(), file);
                    if !normalized.is_empty() {
                        deps.insert(normalized);
                    }
                }
            }
        }
        
        deps
    }

    fn normalize_dependency(&self, dep: &str, file: &PathBuf) -> String {
        // Handle relative imports
        if dep.starts_with('.') {
            let parent = file.parent().unwrap_or(PathBuf::new());
            let abs_path = parent.join(dep);
            return self.node_id(&abs_path);
        }
        
        // Handle package imports - extract module name
        let parts: Vec<&str> = dep.split('/').collect();
        if parts.first().map_or(false, |p| p.starts_with('@')) {
            // Scoped package: @org/package -> @org/package
            if parts.len() >= 2 {
                return format!("{}//{}", parts[0], parts[1]);
            }
        } else if let Some(first) = parts.first() {
            // Regular package: package-name -> package-name
            return first.to_string();
        }
        
        dep.to_string()
    }

    fn detect_circular_dependencies(&self, edges: &[DependencyEdge]) -> Vec<Vec<String>> {
        let mut graph: HashMap<&String, Vec<&String>> = HashMap::new();
        
        for edge in edges {
            graph.entry(&edge.from).or_default().push(&edge.to);
        }
        
        let mut cycles = Vec::new();
        
        fn dfs<'a>(
            node: &'a String,
            graph: &HashMap<&String, Vec<&String>>,
            path: &mut Vec<&'a String>,
            visited: &mut HashSet<&'a String>,
            cycles: &mut Vec<Vec<String>>,
        ) {
            if path.contains(&node) {
                let cycle_start = path.iter().position(|&n| n == node).unwrap();
                let cycle: Vec<String> = path[cycle_start..]
                    .iter()
                    .map(|&s| s.clone())
                    .chain(std::iter::once(node.clone()))
                    .collect();
                cycles.push(cycle);
                return;
            }
            
            if visited.contains(&node) {
                return;
            }
            
            visited.insert(node);
            path.push(node);
            
            if let Some(neighbors) = graph.get(node) {
                for &neighbor in neighbors {
                    dfs(neighbor, graph, path, visited, cycles);
                }
            }
            
            path.pop();
            visited.remove(node);
        }
        
        for &node in graph.keys() {
            let mut path = Vec::new();
            let mut visited = HashSet::new();
            dfs(node, &graph, &mut path, &mut visited, &mut cycles);
        }
        
        cycles
    }
}
```

### Output Format Extension

```json
{
  "dependency_analysis": {
    "graph": {
      "nodes": [
        {
          "id": "src/components/App.tsx",
          "path": "/project/src/components/App.tsx",
          "name": "App.tsx",
          "language": "typescript",
          "dependencies": ["react", "./Header", "../utils/api"],
          "dependents": ["./Dashboard", "./Settings"],
          "lines_of_code": 245,
          "complexity": 12
        }
      ],
      "edges": [
        {
          "from": "src/components/App.tsx",
          "to": "react",
          "edge_type": "Import",
          "strength": 0.9
        }
      ],
      "circular_dependencies": [
        ["src/utils/auth.ts", "src/utils/session.ts", "src/utils/auth.ts"]
      ]
    },
    "metrics": {
      "total_nodes": 150,
      "total_edges": 423,
      "average_dependencies": 2.82,
      "max_depth": 8,
      "coupling": {
        "afferent_coupling": { "utils/api.ts": 15, "utils/auth.ts": 8 },
        "efferent_coupling": { "src/components/App.tsx": 5, "src/components/Dashboard.tsx": 3 },
        "abstractness": 0.35,
        "instability": 0.67
      },
      "instability": 0.72
    }
  }
}
```

---

## 2. Code Quality Indicators & Technical Debt

### Description
Detect code quality issues, complexity hotspots, and technical debt markers to prioritize refactoring efforts.

### Implementation Approach

```rust
// cli/src/core/code_quality_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityReport {
    pub overall_score: f64,
    pub technical_debt: TechnicalDebtSummary,
    pub quality_metrics: Vec<QualityMetric>,
    pub code_smells: Vec<CodeSmell>,
    pub hotspots: Vec<Hotspot>,
    pub recommendations: Vec<Recommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalDebtSummary {
    pub total_debt_hours: f64,
    pub critical_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
    pub debt_ratio: f64,
    pub remediation_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSmell {
    pub id: String,
    pub type_: SmellType,
    pub severity: Severity,
    pub file: String,
    pub line: usize,
    pub message: String,
    pub remediation: String,
    pub effort_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SmellType {
    LongMethod,
    LargeClass,
    DuplicateCode,
    MagicNumbers,
    ComplexCondition,
    LongParameterList,
    FeatureEnvy,
    DataClumps,
    SpeculativeGenerality,
    DeadCode,
    GodComponent,
    CyclomaticComplexity,
    CognitiveComplexity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hotspot {
    pub file: String,
    pub change_risk: f64,
    pub complexity_score: f64,
    defactoring_effort: f64,
    priority: usize,
}

impl CodeQualityAnalyzer {
    pub fn new() -> Self {
        Self {
            cyclomatic_threshold: 10,
            cognitive_threshold: 15,
            long_method_threshold: 50,
            large_class_threshold: 300,
            duplicate_threshold: 6,
        }
    }

    pub async fn analyze(&self, files: &[PathBuf]) -> Result<CodeQualityReport, AnalysisError> {
        let mut quality_metrics = Vec::new();
        let mut code_smells = Vec::new();
        let mut hotspots = Vec::new();
        
        let mut total_debt_hours = 0.0;
        let mut critical_count = 0;
        let mut warning_count = 0;
        let mut info_count = 0;
        
        for file in files {
            if let Ok(content) = tokio::fs::read_to_string(file).await {
                let metrics = self.calculate_metrics(&file, &content);
                quality_metrics.push(metrics.clone());
                
                let smells = self.detect_smells(&file, &content, &metrics);
                code_smells.extend(smells);
                
                let file_hotspots = self.identify_hotspots(&file, &metrics);
                hotspots.extend(file_hotspots);
            }
        }
        
        // Calculate summary
        for smell in &code_smells {
            total_debt_hours += smell.effort_hours;
            match smell.severity {
                Severity::Critical => critical_count += 1,
                Severity::Warning => warning_count += 1,
                Severity::Info => info_count += 1,
            }
        }
        
        // Sort hotspots by priority
        hotspots.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        // Generate recommendations
        let recommendations = self.generate_recommendations(&code_smells, &hotspots);
        
        let debt_ratio = if !quality_metrics.is_empty() {
            total_debt_hours / quality_metrics.iter()
                .map(|m| m.maintainability_index)
                .sum::<f64>()
                * 100.0
        } else {
            0.0
        };
        
        Ok(CodeQualityReport {
            overall_score: self.calculate_overall_score(&quality_metrics),
            technical_debt: TechnicalDebtSummary {
                total_debt_hours,
                critical_count,
                warning_count,
                info_count,
                debt_ratio,
                remediation_cost: total_debt_hours * 100.0, // Assuming $100/hour
            },
            quality_metrics,
            code_smells,
            hotspots: hotspots.into_iter().take(20).collect(),
            recommendations,
        })
    }

    fn detect_smells(&self, file: &PathBuf, content: &str, metrics: &FileMetrics) -> Vec<CodeSmell> {
        let mut smells = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        // Long method detection
        if metrics.max_function_length > self.long_method_threshold {
            smells.push(CodeSmell {
                id: format!("SMELL-{:x}", self.generate_id()),
                type_: SmellType::LongMethod,
                severity: Severity::Warning,
                file: file.display().to_string(),
                line: metrics.longest_function_line,
                message: format!("Function exceeds {} lines ({} lines)", 
                    self.long_method_threshold, metrics.max_function_length),
                remediation: "Consider breaking this function into smaller, focused functions",
                effort_hours: (metrics.max_function_length - self.long_method_threshold) as f64 * 0.5,
            });
        }
        
        // Cyclomatic complexity
        if metrics.cyclomatic_complexity > self.cyclomatic_threshold {
            smells.push(CodeSmell {
                id: format!("SMELL-{:x}", self.generate_id()),
                type_: SmellType::CyclomaticComplexity,
                severity: if metrics.cyclomatic_complexity > self.cyclomatic_threshold * 2 {
                    Severity::Critical
                } else {
                    Severity::Warning
                },
                file: file.display().to_string(),
                line: metrics.highest_complexity_line,
                message: format!("Cyclomatic complexity {} exceeds threshold {}", 
                    metrics.cyclomatic_complexity, self.cyclomatic_threshold),
                remediation: "Simplify conditions or extract complex logic into separate functions",
                effort_hours: (metrics.cyclomatic_complexity - self.cyclomatic_threshold) as f64 * 2.0,
            });
        }
        
        // Magic numbers
        let magic_number_pattern = Regex::new(r"[=+\-*/%&|^<>!]\s*[2-9][0-9]*\s*[=+\-*/%&|^<>]").unwrap();
        let magic_count = magic_number_pattern.find_iter(content).count();
        if magic_count > 3 {
            smells.push(CodeSmell {
                id: format!("SMELL-{:x}", self.generate_id()),
                type_: SmellType::MagicNumbers,
                severity: Severity::Info,
                file: file.display().to_string(),
                line: 1,
                message: format!("Found {} potential magic numbers in code", magic_count),
                remediation: "Replace magic numbers with named constants",
                effort_hours: magic_count as f64 * 0.25,
            });
        }
        
        // Duplicate code detection
        if let Some(dup_info) = &metrics.duplicate_code {
            smells.push(CodeSmell {
                id: format!("SMELL-{:x}", self.generate_id()),
                type_: SmellType::DuplicateCode,
                severity: Severity::Warning,
                file: file.display().to_string(),
                line: dup_info.line,
                message: format!("Duplicate code block found ({} lines, {}% match)", 
                    dup_info.length, dup_info.similarity),
                remediation: "Extract duplicate code into a shared function or constant",
                effort_hours: dup_info.length as f64 * 1.5,
            });
        }
        
        // Dead code detection
        let unused_patterns = vec![
            Regex::new(r"\b(unused|deprecated|obsolete)\b").unwrap(),
            Regex::new(r"(?:function|const|let|var)\s+\w+\s*[=:]\s*(?:function)?.*//\s*never\s+called").unwrap(),
        ];
        
        for pattern in unused_patterns {
            if pattern.is_match(content) {
                smells.push(CodeSmell {
                    id: format!("SMELL-{:x}", self.generate_id()),
                    type_: SmellType::DeadCode,
                    severity: Severity::Warning,
                    file: file.display().to_string(),
                    line: 1,
                    message: "Potential dead or unused code detected",
                    remediation: "Remove unused code or add TODO comments with removal plan",
                    effort_hours: 0.5,
                });
            }
        }
        
        smells
    }

    fn calculate_metrics(&self, file: &PathBuf, content: &str) -> FileMetrics {
        let lines: Vec<&str> = content.lines().collect();
        let total_lines = lines.len();
        let code_lines = lines.iter()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with("//") && !l.trim().starts_with("/*"))
            .count();
        let comment_lines = lines.iter()
            .filter(|l| l.trim().starts_with("//") || l.trim().starts_with("/*") || l.trim().starts_with("*"))
            .count();
        
        // Calculate complexity
        let complexity = self.calculate_cyclomatic_complexity(content);
        
        // Find longest function
        let (max_function_length, longest_function_line) = self.find_longest_function(content);
        
        // Count functions/methods
        let function_count = self.count_functions(content);
        
        FileMetrics {
            file_path: file.display().to_string(),
            total_lines,
            code_lines,
            comment_lines,
            blank_lines: total_lines - code_lines - comment_lines,
            comment_ratio: if total_lines > 0 { comment_lines as f64 / total_lines as f64 } else { 0.0 },
            cyclomatic_complexity: complexity,
            max_function_length,
            longest_function_line,
            function_count,
            maintainability_index: self.calculate_maintainability_index(content, complexity, total_lines),
            duplicate_code: None,
        }
    }

    fn calculate_cyclomatic_complexity(&self, content: &str) -> u32 {
        let patterns = vec![
            r"if\s*\(", r"else\s*{", r"elseif\s*\(",
            r"for\s*\(", r"while\s*\(", r"do\s*{",
            r"case\s+", r"catch\s*\(", r"\?\s*[^:]+:",
            r"&&", r"\|\|", r"\^",
        ];
        
        let mut complexity = 1; // Base complexity
        for pattern in &patterns {
            if let Ok(re) = Regex::new(pattern) {
                complexity += re.find_iter(content).count() as u32;
            }
        }
        
        complexity
    }
}
```

### Output Format Extension

```json
{
  "code_quality": {
    "overall_score": 78.5,
    "technical_debt": {
      "total_debt_hours": 42.5,
      "critical_count": 3,
      "warning_count": 15,
      "info_count": 8,
      "debt_ratio": 12.3,
      "remediation_cost": 4250.0
    },
    "quality_metrics": [
      {
        "file": "src/components/Dashboard.tsx",
        "total_lines": 450,
        "code_lines": 320,
        "comment_lines": 80,
        "cyclomatic_complexity": 15,
        "maintainability_index": 68.5
      }
    ],
    "code_smells": [
      {
        "id": "SMELL-a1b2c3d4",
        "type": "CyclomaticComplexity",
        "severity": "warning",
        "file": "src/utils/processor.ts",
        "line": 124,
        "message": "Cyclomatic complexity 18 exceeds threshold 10",
        "remediation": "Simplify conditions or extract complex logic into separate functions",
        "effort_hours": 16.0
      },
      {
        "id": "SMELL-e5f6g7h8",
        "type": "LongMethod",
        "severity": "warning",
        "file": "src/services/api.ts",
        "line": 45,
        "message": "Function exceeds 50 lines (78 lines)",
        "remediation": "Consider breaking this function into smaller, focused functions",
        "effort_hours": 14.0
      }
    ],
    "hotspots": [
      {
        "file": "src/core/engine.ts",
        "change_risk": 0.85,
        "complexity_score": 9.2,
        "refactoring_effort": 24.0,
        "priority": 1
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "category": "complexity",
        "title": "Reduce cyclomatic complexity in processor.ts",
        "description": "The processor.ts file has a cyclomatic complexity of 18, significantly exceeding the recommended threshold of 10.",
        "impact": "High",
        "effort": "16 hours",
        "files_affected": ["src/utils/processor.ts"]
      }
    ]
  }
}
```

---

## 3. Configuration Pattern Detection

### Description
Parse and analyze configuration files to understand project setup, environment-specific settings, and potential issues.

### Implementation Approach

```rust
// cli/src/core/config_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigAnalysis {
    pub config_files: Vec<ConfigFile>,
    pub environments: Vec<EnvironmentConfig>,
    pub secrets_detected: Vec<SecretWarning>,
    pub best_practices: Vec<BestPractice>,
    pub recommendations: Vec<ConfigRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub path: String,
    pub config_type: ConfigType,
    pub format: String,
    pub keys: Vec<String>,
    pub nested_keys: Vec<String>,
    pub environment_variables: Vec<String>,
    pub last_modified: Option<chrono::DateTime<chrono::Utc>>,
    pub size_bytes: u64,
    pub has_issues: bool,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigType {
    PackageJson,
    CargoToml,
    RequirementsTxt,
    Pipfile,
    GoMod,
    PomXml,
    BuildGradle,
    Makefile,
    DockerCompose,
    KubernetesYaml,
    Terraform,
    Environment,
    TypeScriptConfig,
    ESLintConfig,
    PrettierConfig,
    WebpackConfig,
    ViteConfig,
    NextConfig,
    NuxtConfig,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    pub name: String,
    pub variables: Vec<EnvironmentVariable>,
    pub source: String,
    pub production: bool,
    pub staging: bool,
    pub development: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    pub source: String,
    pub masked: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretWarning {
    pub file: String,
    pub line: usize,
    pub pattern: String,
    pub severity: SecretSeverity,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecretSeverity {
    Critical,
    High,
    Medium,
    Low,
}

impl ConfigAnalyzer {
    pub fn new() -> Self {
        Self {
            secret_patterns: vec![
                (Regex::new(r"(?i)(api_key|apikey|api-key)\s*[:=]\s*['\"][a-zA-Z0-9_]{20,}['\"]").unwrap(), "API Key"),
                (Regex::new(r"(?i)(secret|password|pwd|pass)\s*[:=]\s*['\"][^'\"]{8,}['\"]").unwrap(), "Password/Secret"),
                (Regex::new(r"(?i)aws_access_key_id\s*=\s*[A-Z0-9]{20}").unwrap(), "AWS Access Key"),
                (Regex::new(r"(?i)aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}").unwrap(), "AWS Secret Key"),
                (Regex::new(r"(?i)(private_key|privatekey|privkey)\s*[:=]\s*['\"][-A-Za-z0-9+/=]{100,}['\"]").unwrap(), "Private Key"),
                (Regex::new(r"(?i)Bearer\s+[a-zA-Z0-9\-\._~\+\/]{30,}").unwrap(), "Bearer Token"),
                (Regex::new(r"(?i)ghp_[a-zA-Z0-9]{36}").unwrap(), "GitHub PAT"),
                (Regex::new(r"(?i)eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+").unwrap(), "JWT Token"),
            ],
            config_parsers: HashMap::new(),
        }
    }

    pub async fn analyze(&self, project_path: &PathBuf) -> Result<ConfigAnalysis, AnalysisError> {
        let config_files = self.discover_config_files(project_path).await?;
        let mut analyzed_files = Vec::new();
        
        for config_file in &config_files {
            if let Ok(analysis) = self.analyze_config_file(config_file).await {
                analyzed_files.push(analysis);
            }
        }
        
        let environments = self.detect_environments(project_path).await?;
        let secrets = self.detect_secrets(project_path).await?;
        let best_practices = self.check_best_practices(&config_files);
        let recommendations = self.generate_recommendations(&config_files, &secrets, &best_practices);
        
        Ok(ConfigAnalysis {
            config_files: analyzed_files,
            environments,
            secrets_detected: secrets,
            best_practices,
            recommendations,
        })
    }

    async fn analyze_config_file(&self, file: &PathBuf) -> Result<ConfigFile, AnalysisError> {
        let content = tokio::fs::read_to_string(file).await?;
        let config_type = self.detect_config_type(file, &content);
        let format = self.detect_format(&content);
        let keys = self.extract_keys(&content, &format);
        let nested_keys = self.extract_nested_keys(&content, &format);
        let env_vars = self.extract_env_vars(&content);
        
        let issues = self.find_config_issues(&content, &config_type);
        
        let metadata = tokio::fs::metadata(file).await?;
        
        Ok(ConfigFile {
            path: file.display().to_string(),
            config_type,
            format,
            keys,
            nested_keys,
            environment_variables: env_vars,
            last_modified: metadata.modified()
                .ok()
                .map(|t| chrono::DateTime::from(t)),
            size_bytes: metadata.len(),
            has_issues: !issues.is_empty(),
            issues,
        })
    }

    fn detect_config_type(&self, file: &PathBuf, content: &str) -> ConfigType {
        let file_name = file.file_name()
            .to_string_lossy()
            .to_lowercase();
        
        // Extension and filename based detection
        match file_name.as_str() {
            "package.json" => ConfigType::PackageJson,
            "package-lock.json" => ConfigType::PackageJson,
            "cargo.toml" | "cargo.lock" => ConfigType::CargoToml,
            "requirements.txt" => ConfigType::RequirementsTxt,
            "Pipfile" | "Pipfile.lock" => ConfigType::Pipfile,
            "go.mod" | "go.sum" => ConfigType::GoMod,
            "pom.xml" => ConfigType::PomXml,
            "build.gradle" | "build.gradle.kts" => ConfigType::BuildGradle,
            "Makefile" | "GNUmakefile" => ConfigType::Makefile,
            "docker-compose.yml" | "docker-compose.yaml" => ConfigType::DockerCompose,
            "kustomization.yaml" | "kustomization.yml" => ConfigType::KubernetesYaml,
            "main.tf" | "variables.tf" => ConfigType::Terraform,
            ".env" | ".env.local" | ".env.production" | ".env.development" => ConfigType::Environment,
            "tsconfig.json" => ConfigType::TypeScriptConfig,
            ".eslintrc" | ".eslintrc.js" | ".eslintrc.json" | ".eslintrc.yml" => ConfigType::ESLintConfig,
            ".prettierrc" | ".prettierrc.js" | ".prettierrc.json" | ".prettierrc.yml" => ConfigType::PrettierConfig,
            "webpack.config.js" | "webpack.config.ts" | "webpack.config.cjs" => ConfigType::WebpackConfig,
            "vite.config.ts" | "vite.config.js" => ConfigType::ViteConfig,
            "next.config.js" | "next.config.ts" | "next.config.mjs" => ConfigType::NextConfig,
            "nuxt.config.ts" | "nuxt.config.js" => ConfigType::NuxtConfig,
            _ => {
                // Content-based detection
                if content.trim_start().starts_with("{") {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
                        if json.get("dependencies").is_some() || json.get("devDependencies").is_some() {
                            return ConfigType::PackageJson;
                        }
                        if json.get("compilerOptions").is_some() {
                            return ConfigType::TypeScriptConfig;
                        }
                    }
                }
                ConfigType::Unknown
            }
        }
    }

    fn extract_keys(&self, content: &str, format: &str) -> Vec<String> {
        match format {
            "json" => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
                    self.flatten_json_keys(&json, "")
                } else {
                    Vec::new()
                }
            }
            "yaml" | "yml" => {
                if let Ok(yaml) = serde_yaml::from_str::<serde_yaml::Value>(content) {
                    self.flatten_yaml_keys(&yaml, "")
                } else {
                    Vec::new()
                }
            }
            "toml" => {
                if let Ok(toml) = toml::from_str::<toml::Value>(content) {
                    self.flatten_toml_keys(&toml, "")
                } else {
                    Vec::new()
                }
            }
            _ => Vec::new(),
        }
    }

    fn flatten_json_keys(&self, value: &serde_json::Value, prefix: &str) -> Vec<String> {
        let mut keys = Vec::new();
        
        match value {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    let full_key = if prefix.is_empty() { k.clone() } else { format!("{}.{}", prefix, k) };
                    keys.push(full_key.clone());
                    keys.extend(self.flatten_json_keys(&v, &full_key));
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, v) in arr.iter().enumerate() {
                    let indexed_key = format!("{}[{}]", prefix, i);
                    keys.extend(self.flatten_json_keys(&v, &indexed_key));
                }
            }
            _ => {}
        }
        
        keys
    }

    fn find_config_issues(&self, content: &str, config_type: &ConfigType) -> Vec<String> {
        let mut issues = Vec::new();
        
        match config_type {
            ConfigType::PackageJson => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
                    // Check for deprecated Node versions
                    if let Some(engines) = json.get("engines") {
                        if let Some(node) = engines.get("node") {
                            if let Some(node_str) = node.as_str() {
                                if node_str.starts_with("<14") {
                                    issues.push("Node version requirement is outdated (<14)");
                                }
                            }
                        }
                    }
                    
                    // Check for insecure dependencies
                    if let Some(deps) = json.get("dependencies").or(json.get("devDependencies")) {
                        for (name, version) in deps.as_object().iter().flatten() {
                            if let Some(ver) = version.as_str() {
                                if ver.starts_with('^') || ver.starts_with('~') {
                                    // Potentially outdated version range
                                    issues.push(format!("Consider using exact versions for {}", name));
                                }
                            }
                        }
                    }
                }
            }
            ConfigType::TypeScriptConfig => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
                    if let Some(strict) = json.get("strict").and_then(|v| v.as_bool()) {
                        if !strict {
                            issues.push("TypeScript strict mode is disabled - enable for better type safety");
                        }
                    }
                    if json.get("noImplicitAny").is_none() {
                        issues.push("noImplicitAny is not explicitly set - consider enabling");
                    }
                }
            }
            ConfigType::Environment => {
                if content.contains("PASSWORD=") || content.contains("SECRET=") {
                    issues.push("Plain-text secrets found in .env file - use .env.secrets or secret manager");
                }
            }
            _ => {}
        }
        
        issues
    }
}
```

### Output Format Extension

```json
{
  "configuration_analysis": {
    "config_files": [
      {
        "path": "package.json",
        "config_type": "package_json",
        "format": "json",
        "keys": ["name", "version", "dependencies", "devDependencies", "scripts", "engines"],
        "nested_keys": ["dependencies.react", "devDependencies.typescript", "scripts.build"],
        "environment_variables": ["NODE_ENV"],
        "last_modified": "2026-01-05T10:30:00Z",
        "size_bytes": 2048,
        "has_issues": true,
        "issues": ["Consider using exact versions for production dependencies"]
      },
      {
        "path": "src/config/environments.ts",
        "config_type": "typescript_config",
        "format": "typescript",
        "keys": ["development", "staging", "production"],
        "nested_keys": [],
        "environment_variables": [],
        "last_modified": "2026-01-02T14:20:00Z",
        "size_bytes": 1024,
        "has_issues": false,
        "issues": []
      }
    ],
    "environments": [
      {
        "name": "development",
        "variables": [
          {
            "key": "API_URL",
            "value": "https://api-dev.example.com",
            "source": ".env.development",
            "masked": false,
            "description": "Development API endpoint"
          },
          {
            "key": "DEBUG",
            "value": "true",
            "source": ".env.development",
            "masked": false,
            "description": "Enable debug mode"
          }
        ],
        "source": ".env.development",
        "production": false,
        "staging": false,
        "development": true
      },
      {
        "name": "production",
        "variables": [],
        "source": ".env.production",
        "production": true,
        "staging": false,
        "development": false
      }
    ],
    "secrets_detected": [
      {
        "file": ".env.local",
        "line": 5,
        "pattern": "AWS Access Key",
        "severity": "critical",
        "suggestion": "Move AWS credentials to AWS Secrets Manager or environment variables"
      }
    ],
    "best_practices": [
      {
        "check": "Version pinning",
        "status": "pass",
        "description": "All dependencies have exact versions specified"
      },
      {
        "check": "TypeScript strict mode",
        "status": "pass",
        "description": "TypeScript strict mode is enabled"
      },
      {
        "check": "ESLint configured",
        "status": "pass",
        "description": "ESLint configuration found with recommended rules"
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "category": "security",
        "title": "Remove hardcoded AWS credentials",
        "description": "AWS Access Key found in .env.local file",
        "impact": "Security vulnerability",
        "action": "Move to AWS Secrets Manager or IAM roles"
      }
    ]
  }
}
```

---

## 4. Build & Deployment Configuration

### Description
Analyze build scripts, CI/CD pipelines, and deployment configurations to understand project delivery setup.

### Implementation Approach

```rust
// cli/src/core/build_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildAnalysis {
    pub build_systems: Vec<BuildSystem>,
    pub ci_cd_pipelines: Vec<CICD Pipeline>,
    pub docker_config: Option<DockerAnalysis>,
    pub kubernetes_config: Option<KubernetesAnalysis>,
    pub deployment_strategies: Vec<DeploymentStrategy>,
    pub build_metrics: BuildMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildSystem {
    pub name: String,
    pub file: String,
    pub scripts: Vec<BuildScript>,
    pub plugins: Vec<String>,
    pub output_directories: Vec<String>,
    pub last_modified: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildScript {
    pub name: String,
    pub command: String,
    pub description: Option<String>,
    pub depends_on: Vec<String>,
    pub estimated_duration: Option<u64>, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CICDPipeline {
    pub provider: CIProvider,
    pub file: String,
    pub triggers: Vec<PipelineTrigger>,
    pub jobs: Vec<PipelineJob>,
    pub stages: Vec<String>,
    pub environment: PipelineEnvironment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CIProvider {
    GitHubActions,
    GitLabCI,
    Jenkins,
    CircleCI,
    TravisCI,
    AzurePipelines,
    BitbucketPipelines,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineTrigger {
    pub trigger_type: TriggerType,
    pub branches: Vec<String>,
    pub paths: Vec<String>,
    pub schedules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TriggerType {
    Push,
    PullRequest,
    Tag,
    Schedule,
    Manual,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineJob {
    pub name: String,
    pub stage: String,
    pub runs_on: String,
    pub steps: Vec<PipelineStep>,
    pub environment: Option<String>,
    pub needs: Vec<String>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStep {
    pub name: String,
    pub action: String,
    pub uses: Option<String>,
    pub run: Option<String>,
    pub with: HashMap<String, String>,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildMetrics {
    pub total_build_time: u64,
    pub total_test_time: u64,
    pub average_build_size: u64,
    pub cacheable_steps: usize,
    pub parallelizable_jobs: usize,
}
```

---

## 5. Documentation Coverage Analysis

### Description
Measure documentation completeness, freshness, and identify documentation gaps.

```rust
// cli/src/core/docs_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationAnalysis {
    pub coverage_score: f64,
    pub overall_freshness: f64,
    pub document_types: Vec<DocumentTypeAnalysis>,
    pub api_documentation: Vec<APIDocEntry>,
    pub missing_documentation: Vec<MissingDoc>,
    pub recommendations: Vec<DocRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentTypeAnalysis {
    pub type_: DocType,
    pub file_count: usize,
    pub total_lines: u64,
    pub coverage_percent: f64,
    pub freshness_days: Vec<f64>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocType {
    Readme,
    Contributing,
    Changelog,
    License,
    ApiDoc,
    Architecture,
    GettingStarted,
    Troubleshooting,
    CodeComments,
    TypeDefinitions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APIDocEntry {
    pub name: String,
    pub file: String,
    pub line: usize,
    pub doc_comment: bool,
    pub params_documented: usize,
    pub total_params: usize,
    pub return_documented: bool,
    pub examples: usize,
    pub completeness_score: f64,
}
```

---

## 6. Test Coverage & Organization

### Description
Analyze test structure, coverage, and patterns to understand project quality assurance.

```rust
// cli/src/core/test_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestAnalysis {
    pub coverage: CoverageMetrics,
    pub test_organization: TestOrganization,
    pub test_patterns: Vec<TestPattern>,
    pub quality_indicators: TestQualityIndicators,
    pub flakiness_risk: FlakinessAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageMetrics {
    pub line_coverage: f64,
    pub branch_coverage: f64,
    pub function_coverage: f64,
    pub statement_coverage: f64,
    pub complexity_weighted_coverage: f64,
    pub uncovered_lines: Vec<UncoveredLine>,
    pub partially_covered_branches: Vec<BranchCoverage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestOrganization {
    pub test_frameworks: Vec<String>,
    pub test_directories: Vec<String>,
    pub test_file_count: usize,
    pub total_test_cases: usize,
    pub test_per_source_ratio: f64,
    pub organization_patterns: Vec<OrganizationPattern>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrganizationPattern {
    UnitTests,
    IntegrationTests,
    E2ETests,
    SnapshotTests,
    PerformanceTests,
    ContractTests,
}
```

---

## 7. Dependency Version Analysis

### Description
Detect outdated packages, security vulnerabilities, and upgrade recommendations.

```rust
// cli/src/core/dependency_version_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyVersionAnalysis {
    pub total_dependencies: usize,
    pub outdated: Vec<OutdatedDependency>,
    pub vulnerable: Vec<VulnerableDependency>,
    pub licenses: Vec<LicenseInfo>,
    pub upgrades: Vec<UpgradeRecommendation>,
    pub security_score: f64,
    pub maintenance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutdatedDependency {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub minor_behind: u32,
    pub major_behind: u32,
    pub release_date: String,
    pub days_since_update: u64,
    pub popularity: String,
    pub upgrade_risk: UpgradeRisk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpgradeRisk {
    Low,
    Medium,
    High,
    Breaking,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerableDependency {
    pub name: String,
    pub version: String,
    pub vulnerabilities: Vec<Vulnerability>,
    pub severity: VulnerabilitySeverity,
    pub fix_available: bool,
    pub fix_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vulnerability {
    pub id: String,
    pub severity: VulnerabilitySeverity,
    pub title: String,
    pub description: String,
    pub published: String,
    pub affected_range: String,
    pub cve: Option<String>,
}
```

---

## 8. Security Analysis

### Description
Comprehensive security analysis of codebase for vulnerabilities and best practice violations.

```rust
// cli/src/core/security_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAnalysis {
    pub security_score: f64,
    pub vulnerabilities: Vec<SecurityVulnerability>,
    pub code_security: CodeSecurityAnalysis,
    pub dependency_security: DependencySecurityAnalysis,
    pub secrets_found: Vec<SecretFinding>,
    pub security_recommendations: Vec<SecurityRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityVulnerability {
    pub id: String,
    pub category: VulnerabilityCategory,
    pub severity: VulnerabilitySeverity,
    pub file: String,
    pub line: usize,
    pub title: String,
    pub description: String,
    pub remediation: String,
    pub references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VulnerabilityCategory {
    Injection,
    XSS,
    CSRF,
    Authentication,
    Authorization,
    Cryptography,
    SensitiveData,
    Configuration,
    Logging,
    Validation,
}
```

---

## 9. Code Architecture Analysis

### Description
Analyze code organization against architectural patterns and principles.

```rust
// cli/src/core/architecture_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureAnalysis {
    pub architecture_type: ArchitectureType,
    pub layer_compliance: LayerCompliance,
    pub module_coupling: ModuleCoupling,
    pub component_health: ComponentHealth,
    pub pattern_violations: Vec<PatternViolation>,
    pub architectural_recommendations: Vec<ArchRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArchitectureType {
    Monolithic,
    ModularMonolith,
    Microservices,
    Serverless,
    CleanArchitecture,
    DomainDrivenDesign,
    Layered,
    Hexagonal,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerCompliance {
    pub layers: Vec<Layer>,
    pub violations: Vec<LayerViolation>,
    pub compliance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub name: String,
    pub path_pattern: String,
    pub dependencies_allowed: Vec<String>,
    pub files_count: usize,
    pub lines_of_code: usize,
}
```

---

## 10. Developer Activity Analysis

### Description
Analyze git history and project metadata for developer activity patterns.

```rust
// cli/src/core/developer_activity_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeveloperActivityAnalysis {
    pub activity_metrics: ActivityMetrics,
    pub contributor_stats: ContributorStats,
    pub ownership_analysis: OwnershipAnalysis,
    pub churn_analysis: ChurnAnalysis,
    pub bus_factor: BusFactorAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityMetrics {
    pub total_commits: u64,
    pub commit_frequency: f64, // commits per week
    pub average_commit_size: f64,
    pub last_commit_date: String,
    pub active_contributors: u32,
    pub new_contributors_30d: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusFactorAnalysis {
    pub bus_factor_score: f64,
    pub critical_files: Vec<CriticalFile>,
    pub single_points_of_failure: Vec<SPOF>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalFile {
    pub path: String,
    pub owners: Vec<String>,
    pub change_frequency: f64,
    pub knowledge_concentration: f64,
}
```

---

## 11. License & Compliance Analysis

### Description
Analyze project licenses and dependency licenses for compliance.

```rust
// cli/src/core/license_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseAnalysis {
    pub primary_license: Option<LicenseInfo>,
    pub dependency_licenses: Vec<LicenseInfo>,
    pub compliance_issues: Vec<ComplianceIssue>,
    pub license_compatibility: CompatibilityAnalysis,
    pub copyright_notices: Vec<CopyrightNotice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub name: String,
    pub spdx_id: String,
    pub url: String,
    pub permissions: Vec<String>,
    pub conditions: Vec<String>,
    pub limitations: Vec<String>,
    pub commercial_use: bool,
    pub open_source: bool,
}
```

---

## 12. Performance Metrics

### Description
Extract performance-related metrics from codebase.

```rust
// cli/src/core/performance_analyzer.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAnalysis {
    pub runtime_metrics: RuntimeMetrics,
    pub bundle_analysis: BundleAnalysis,
    pub database_patterns: DatabasePatternAnalysis,
    pub cache_patterns: CachePatternAnalysis,
    pub performance_recommendations: Vec<PerfRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleAnalysis {
    pub total_size: u64,
    pub gzipped_size: u64,
    pub chunk_count: usize,
    pub largest_chunks: Vec<ChunkInfo>,
    pub duplicate_packages: Vec<DuplicatePackage>,
    pub tree_shakeable_modules: usize,
    pub side_effectful_modules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicatePackage {
    pub name: String,
    pub versions: Vec<String>,
    pub size_impact: u64,
    pub files_causing_duplication: Vec<String>,
}
```

---

## Complete Output Format

The extended analysis output maintains consistency with the existing format while providing comprehensive new insights:

```json
{
  "analysis_metadata": {
    "version": "3.0.0",
    "timestamp": "2026-01-08T16:44:42.752Z",
    "path_analyzed": "/project",
    "analysis_duration_ms": 45230
  },
  "basic_analysis": {
    "total_files": 1234,
    "total_size_bytes": 52428800,
    "categories": { ... },
    "extension_stats": { ... }
  },
  "extended_analysis": {
    "dependency_graph": { ... },
    "code_quality": { ... },
    "configuration": { ... },
    "build_analysis": { ... },
    "documentation": { ... },
    "test_coverage": { ... },
    "dependency_versions": { ... },
    "security": { ... },
    "architecture": { ... },
    "developer_activity": { ... },
    "licenses": { ... },
    "performance": { ... }
  },
  "ai_insights": {
    "recommendations": [ ... ],
    "predictions": [ ... ],
    "risk_assessment": { ... }
  }
}
```

---

## Implementation Priority Matrix

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Dependency Analysis | P0 | Medium | File discovery |
| Code Quality | P0 | Medium | Language parsers |
| Configuration Analysis | P1 | Low | File discovery |
| Security Analysis | P0 | Medium | Secret patterns |
| Test Coverage | P1 | Medium | Test frameworks |
| Version Analysis | P1 | Low | Package managers |
| Documentation | P2 | Low | File discovery |
| Build Analysis | P1 | Medium | CI/CD detection |
| Architecture | P2 | High | Dependency analysis |
| Developer Activity | P2 | Medium | Git integration |
| Licenses | P2 | Low | Package managers |
| Performance | P2 | Medium | Build analysis |

---

## Conclusion

These extended metadata extraction capabilities would transform Space Analyzer Pro from a storage analysis tool into a comprehensive project intelligence platform. Each capability builds on existing infrastructure while providing significant value to developers managing and maintaining projects.

The implementation is modular, allowing incremental adoption based on priority and available resources.
