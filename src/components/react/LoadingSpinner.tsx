import React, { type FC, memo } from "react";
import { Loader2, Zap, BrainCircuit, Database, Search, Activity } from "lucide-react";
import styles from "./LoadingSpinner.module.css";

// Constants for spinner sizes
export const SPINNER_SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const;

export type SpinnerSizeType = (typeof SPINNER_SIZES)[keyof typeof SPINNER_SIZES];

// Loading contexts for contextual spinners
export const LOADING_CONTEXTS = {
  ANALYSIS: "analysis",
  AI: "ai",
  SEARCH: "search",
  EXPORT: "export",
  MONITORING: "monitoring",
  GENERAL: "general",
} as const;

export type LoadingContextType = (typeof LOADING_CONTEXTS)[keyof typeof LOADING_CONTEXTS];

interface LoadingSpinnerProps {
  size?: SpinnerSizeType;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  progress?: number; // 0-100
  showProgress?: boolean;
  context?: LoadingContextType;
  "aria-label"?: string;
  className?: string;
  animated?: boolean;
}

const LoadingSpinner: FC<LoadingSpinnerProps> = memo(
  ({
    size = SPINNER_SIZES.MEDIUM,
    text,
    fullScreen = false,
    overlay = false,
    progress,
    showProgress = false,
    context = LOADING_CONTEXTS.GENERAL,
    "aria-label": ariaLabel,
    className = "",
    animated = true,
  }) => {
    // Get contextual icon and text
    const getContextualContent = (context: LoadingContextType) => {
      const contexts = {
        [LOADING_CONTEXTS.ANALYSIS]: {
          icon: Database,
          defaultText: "Analyzing files...",
          ariaLabel: "Analyzing file system",
        },
        [LOADING_CONTEXTS.AI]: {
          icon: BrainCircuit,
          defaultText: "AI processing...",
          ariaLabel: "AI processing data",
        },
        [LOADING_CONTEXTS.SEARCH]: {
          icon: Search,
          defaultText: "Searching...",
          ariaLabel: "Searching files",
        },
        [LOADING_CONTEXTS.EXPORT]: {
          icon: Activity,
          defaultText: "Exporting data...",
          ariaLabel: "Exporting data",
        },
        [LOADING_CONTEXTS.MONITORING]: {
          icon: Activity,
          defaultText: "Monitoring...",
          ariaLabel: "Monitoring system",
        },
        [LOADING_CONTEXTS.GENERAL]: {
          icon: Loader2,
          defaultText: "Loading...",
          ariaLabel: "Loading content",
        },
      };

      return contexts[context] || contexts[LOADING_CONTEXTS.GENERAL];
    };

    const contextualContent = getContextualContent(context);
    const displayText = text || contextualContent.defaultText;
    const finalAriaLabel = ariaLabel || contextualContent.ariaLabel;

    // Size mappings
    const getSizeClass = (size: SpinnerSizeType): string => {
      switch (size) {
        case SPINNER_SIZES.SMALL:
          return styles.spinnerSmall;
        case SPINNER_SIZES.MEDIUM:
          return styles.spinnerMedium;
        case SPINNER_SIZES.LARGE:
          return styles.spinnerLarge;
        default:
          return styles.spinnerMedium;
      }
    };

    const getIconSize = (size: SpinnerSizeType): number => {
      switch (size) {
        case SPINNER_SIZES.SMALL:
          return 20;
        case SPINNER_SIZES.MEDIUM:
          return 28;
        case SPINNER_SIZES.LARGE:
          return 40;
        default:
          return 28;
      }
    };

    const IconComponent = contextualContent.icon;

    const content = (
      <div
        className={`${styles.spinnerContainer} ${getSizeClass(size)} ${className}`}
        role="status"
        aria-label={finalAriaLabel}
        aria-live="polite"
      >
        {/* Main spinner with branding */}
        <div className={`${styles.spinnerWrapper} ${animated ? styles.animated : ""}`}>
          <div className={styles.spinnerIcon}>
            <IconComponent size={getIconSize(size)} />
          </div>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerGlow}></div>
        </div>

        {/* Text */}
        {displayText && <div className={styles.spinnerText}>{displayText}</div>}

        {/* Progress bar */}
        {showProgress && progress !== undefined && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className={styles.progressText}>{Math.round(progress)}%</div>
          </div>
        )}

        {/* Animated dots for additional visual feedback */}
        {animated && (
          <div className={styles.loadingDots}>
            <div className={styles.loadingDot}></div>
            <div className={styles.loadingDot}></div>
            <div className={styles.loadingDot}></div>
          </div>
        )}
      </div>
    );

    if (fullScreen) {
      return (
        <div
          className={`${styles.fullScreen} ${overlay ? styles.overlay : ""}`}
          role="presentation"
          aria-hidden="true"
        >
          {content}
        </div>
      );
    }

    return content;
  }
);

export default LoadingSpinner;
