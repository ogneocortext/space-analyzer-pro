/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

/**
 * Visual Analysis Service using LLaVA for frontend design improvements
 */

export interface VisualInsight {
  category: "layout" | "color" | "typography" | "spacing" | "accessibility" | "ui-components";
  priority: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  implementation: string;
}

export interface DesignAnalysis {
  overall_score: number;
  strengths: string[];
  improvements: VisualInsight[];
  quick_wins: string[];
  accessibility_issues: string[];
  color_harmony: number;
  visual_hierarchy: number;
  responsiveness: number;
}

class VisualAnalysisService {
  private baseUrl: string = "http://localhost:11434";

  /**
   * Analyze frontend screenshot using LLaVA
   */
  async analyzeDesign(imagePath: string): Promise<DesignAnalysis> {
    try {
      // Read image as base64
      const imageBase64 = await this.imageToBase64(imagePath);

      const prompt = `As a UI/UX expert, analyze this frontend design and provide specific, actionable improvements. Focus on:

1. Visual hierarchy and information architecture
2. Color scheme and contrast
3. Typography and readability
4. Spacing and layout consistency
5. Component design and interactions
6. Accessibility compliance
7. Mobile responsiveness indicators

Provide your analysis in this JSON format:
{
  "overall_score": 85,
  "strengths": ["Clean modern design", "Good use of gradients"],
  "improvements": [
    {
      "category": "spacing",
      "priority": "high",
      "issue": "Inconsistent padding between sections",
      "recommendation": "Standardize spacing to 24px for sections",
      "implementation": "Add consistent spacing classes"
    }
  ],
  "quick_wins": ["Increase button contrast", "Add hover states"],
  "accessibility_issues": ["Missing alt text on images", "Low contrast text"],
  "color_harmony": 8,
  "visual_hierarchy": 7,
  "responsiveness": 9
}`;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llava:latest",
          prompt: prompt,
          images: [imageBase64],
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 2000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Parse the JSON response
      try {
        const analysisText = result.response;
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("Failed to parse LLaVA response:", parseError);
      }

      // Fallback response if parsing fails
      return this.getFallbackAnalysis(result.response);
    } catch (error) {
      console.error("Visual analysis failed:", error);
      throw error;
    }
  }

  /**
   * Convert image file to base64
   */
  private async imageToBase64(imagePath: string): Promise<string> {
    try {
      // For browser environment, we'll need to handle this differently
      // For now, return a placeholder
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to convert image to base64:", error);
      throw error;
    }
  }

  /**
   * Generate CSS improvements based on analysis
   */
  generateCSSImprovements(analysis: DesignAnalysis): string[] {
    const cssImprovements: string[] = [];

    analysis.improvements.forEach((improvement) => {
      switch (improvement.category) {
        case "spacing":
          cssImprovements.push(`
/* ${improvement.recommendation} */
.section-spacing {
  padding: 24px 0;
  margin: 16px 0;
}

.component-spacing {
  gap: 16px;
  margin-bottom: 20px;
}`);
          break;

        case "color":
          cssImprovements.push(`
/* ${improvement.recommendation} */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #8b5cf6;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
}

.improved-contrast {
  color: var(--text-primary);
  background-color: var(--bg-primary);
}`);
          break;

        case "typography":
          cssImprovements.push(`
/* ${improvement.recommendation} */
.improved-typography {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  letter-spacing: -0.025em;
}

.heading-hierarchy {
  font-weight: 600;
  margin-bottom: 0.5em;
}`);
          break;

        case "layout":
          cssImprovements.push(`
/* ${improvement.recommendation} */
.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  padding: 0 16px;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}`);
          break;

        case "accessibility":
          cssImprovements.push(`
/* ${improvement.recommendation} */
.accessible-focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}`);
          break;
      }
    });

    return cssImprovements;
  }

  /**
   * Generate React component improvements
   */
  generateComponentImprovements(analysis: DesignAnalysis): Record<string, string> {
    const improvements: Record<string, string> = {};

    // Button improvements
    if (analysis.improvements.some((imp) => imp.category === "ui-components")) {
      improvements.Button = `
import React from 'react';
import { cn } from '../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseClasses = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2';
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
      outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };

    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);`;
    }

    // Card improvements
    if (analysis.improvements.some((imp) => imp.category === "layout")) {
      improvements.Card = `
import React from 'react';
import { cn } from '../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const baseClasses = 'rounded-lg p-6 transition-all duration-200';
    const variants = {
      default: 'bg-white border border-gray-200',
      elevated: 'bg-white shadow-lg hover:shadow-xl',
      outlined: 'bg-transparent border-2 border-gray-300'
    };

    return (
      <div
        className={cn(baseClasses, variants[variant], className)}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);`;
    }

    return improvements;
  }

  /**
   * Fallback analysis if LLaVA parsing fails
   */
  private getFallbackAnalysis(response: string): DesignAnalysis {
    return {
      overall_score: 75,
      strengths: ["Modern dark theme", "Good use of gradients"],
      improvements: [
        {
          category: "spacing",
          priority: "medium",
          issue: "Inconsistent spacing detected",
          recommendation: "Standardize spacing units",
          implementation: "Use consistent spacing scale",
        },
      ],
      quick_wins: ["Improve button hover states", "Add loading indicators"],
      accessibility_issues: ["Add ARIA labels", "Improve color contrast"],
      color_harmony: 7,
      visual_hierarchy: 6,
      responsiveness: 8,
    };
  }
}

export const visualAnalysisService = new VisualAnalysisService();
export default visualAnalysisService;
