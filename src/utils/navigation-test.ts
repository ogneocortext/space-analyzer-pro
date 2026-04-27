// Navigation Testing Utility
// This file provides utilities to test all navigation links and routes

import { ROUTES } from "../config/routes";

export interface NavigationTestResult {
  routeId: string;
  path: string;
  title: string;
  status: "working" | "broken" | "missing";
  message: string;
}

export class NavigationTester {
  private results: NavigationTestResult[] = [];

  /**
   * Test all routes to ensure they are properly configured
   */
  testAllRoutes(): NavigationTestResult[] {
    this.results = [];

    ROUTES.forEach((route) => {
      this.testRoute(route);
    });

    return this.results;
  }

  /**
   * Test a specific route
   */
  private testRoute(route: any): void {
    const result: NavigationTestResult = {
      routeId: route.id,
      path: route.path,
      title: route.title,
      status: "working",
      message: "Route is properly configured",
    };

    // Check if route has required properties
    if (!route.id) {
      result.status = "broken";
      result.message = "Route missing ID";
    } else if (!route.title) {
      result.status = "broken";
      result.message = "Route missing title";
    } else if (!route.icon) {
      result.status = "broken";
      result.message = "Route missing icon";
    } else if (!route.group) {
      result.status = "broken";
      result.message = "Route missing group";
    } else if (!route.enabled) {
      result.status = "broken";
      result.message = "Route is disabled";
    }

    this.results.push(result);
  }

  /**
   * Get summary of test results
   */
  getSummary(): {
    total: number;
    working: number;
    broken: number;
    missing: number;
  } {
    const total = this.results.length;
    const working = this.results.filter((r) => r.status === "working").length;
    const broken = this.results.filter((r) => r.status === "broken").length;
    const missing = this.results.filter((r) => r.status === "missing").length;

    return { total, working, broken, missing };
  }

  /**
   * Print test results to console
   */
  printResults(): void {
    const summary = this.getSummary();

    console.warn("\n=== Navigation Test Results ===");
    console.warn(`Total routes: ${summary.total}`);
    console.warn(`Working: ${summary.working}`);
    console.warn(`Broken: ${summary.broken}`);
    console.warn(`Missing: ${summary.missing}`);
    console.warn("\nDetailed Results:");

    this.results.forEach((result) => {
      const statusIcon =
        result.status === "working" ? "✅" : result.status === "broken" ? "❌" : "⚠️";
      console.warn(`${statusIcon} ${result.routeId}: ${result.message}`);
    });

    if (summary.broken > 0) {
      console.warn("\n⚠️  Found broken routes. Please fix these issues.");
    } else {
      console.warn("\n✅ All routes are working correctly!");
    }
  }

  /**
   * Validate route consistency
   */
  validateRouteConsistency(): {
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate route IDs
    const routeIds = ROUTES.map((r) => r.id);
    const uniqueIds = new Set(routeIds);
    if (routeIds.length !== uniqueIds.size) {
      issues.push("Duplicate route IDs found");
    }

    // Check for duplicate paths
    const paths = ROUTES.map((r) => r.path);
    const uniquePaths = new Set(paths);
    if (paths.length !== uniquePaths.size) {
      issues.push("Duplicate route paths found");
    }

    // Check for missing icons in icon map
    const availableIcons = [
      "LayoutDashboard",
      "BrainCircuit",
      "MessageSquare",
      "BarChart3",
      "Settings",
      "Folder",
      "Play",
      "Activity",
      "AlertTriangle",
      "Zap",
      "TrendingUp",
      "Database",
      "Shield",
      "Search",
      "Download",
      "Globe",
      "Cpu",
      "Eye",
      "Code",
      "Brain",
      "Network",
      "Calendar",
      "PieChart",
      "Layers",
      "Copy",
    ];

    ROUTES.forEach((route) => {
      if (!availableIcons.includes(route.icon)) {
        warnings.push(`Route ${route.id} uses icon "${route.icon}" which may not be available`);
      }
    });

    return { issues, warnings };
  }
}

// Export a singleton instance for easy testing
export const navigationTester = new NavigationTester();

// Auto-run tests in development
if (process.env.NODE_ENV === "development") {
  setTimeout(() => {
    navigationTester.testAllRoutes();
    navigationTester.printResults();

    const consistency = navigationTester.validateRouteConsistency();
    if (consistency.issues.length > 0) {
      console.error("❌ Route consistency issues found:", consistency.issues);
    }
    if (consistency.warnings.length > 0) {
      console.warn("⚠️  Route warnings:", consistency.warnings);
    }
  }, 1000);
}
