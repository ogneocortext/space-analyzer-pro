import React, { useState, useEffect } from "react";
import styles from "./AIOnboardingTour.module.css";

interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: () => void;
}

interface AIOnboardingTourProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStep?: number;
}

const AIOnboardingTour: React.FC<AIOnboardingTourProps> = ({
  isVisible,
  onComplete,
  onSkip,
  currentStep = 0,
}) => {
  const [activeStep, setActiveStep] = useState(currentStep);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  const tourSteps: TourStep[] = [
    {
      id: "ai-chat",
      target: ".ai-chat-button",
      title: "AI Assistant",
      content:
        "Ask questions about your files using natural language. Get insights, recommendations, and help with file management.",
      position: "bottom",
      action: () => {
        // Highlight AI chat button
        const element = document.querySelector(".ai-chat-button") as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
    {
      id: "neural-view",
      target: ".neural-view-button",
      title: "Neural Network Visualization",
      content:
        "Explore file relationships through an interactive neural network. Discover patterns and connections in your data.",
      position: "left",
      action: () => {
        const element = document.querySelector(".neural-view-button") as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
    {
      id: "smart-analysis",
      target: ".smart-analysis-button",
      title: "Smart Analysis",
      content:
        "Get AI-powered insights about your storage usage, duplicate files, and optimization opportunities.",
      position: "top",
      action: () => {
        const element = document.querySelector(".smart-analysis-button") as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
    {
      id: "command-palette",
      target: ".command-palette-trigger",
      title: "Command Palette",
      content:
        "Press Ctrl+K to quickly access any feature. Search, navigate, and execute commands instantly.",
      position: "bottom",
      action: () => {
        const element = document.querySelector(".command-palette-trigger") as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
    {
      id: "time-travel",
      target: ".time-travel-button",
      title: "Time Travel Analysis",
      content:
        "Compare file system snapshots over time. Track changes and analyze storage evolution.",
      position: "right",
      action: () => {
        const element = document.querySelector(".time-travel-button") as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
  ];

  useEffect(() => {
    if (isVisible && tourSteps[activeStep]) {
      const step = tourSteps[activeStep];
      const element = document.querySelector(step.target) as HTMLElement;

      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add highlight class
        element.classList.add(styles.tourHighlight);

        return () => {
          element.classList.remove(styles.tourHighlight);
        };
      }
    }
  }, [isVisible, activeStep]);

  const handleNext = () => {
    if (activeStep < tourSteps.length - 1) {
      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      tourSteps[nextStep].action?.();
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      const prevStep = activeStep - 1;
      setActiveStep(prevStep);
      tourSteps[prevStep].action?.();
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!isVisible || !tourSteps[activeStep]) {
    return null;
  }

  const currentTourStep = tourSteps[activeStep];

  return (
    <>
      {/* Overlay */}
      <div className={styles.tourOverlay} />

      {/* Tour Tooltip */}
      <div className={`${styles.tourTooltip} ${styles[currentTourStep.position || "bottom"]}`}>
        <div className={styles.tourHeader}>
          <h3 className={styles.tourTitle}>{currentTourStep.title}</h3>
          <button className={styles.closeButton} onClick={handleSkip} aria-label="Skip tour">
            ×
          </button>
        </div>

        <div className={styles.tourContent}>
          <p className={styles.tourDescription}>{currentTourStep.content}</p>
        </div>

        <div className={styles.tourFooter}>
          <div className={styles.progressIndicator}>
            {activeStep + 1} of {tourSteps.length}
          </div>

          <div className={styles.tourActions}>
            {activeStep > 0 && (
              <button className={styles.previousButton} onClick={handlePrevious}>
                Previous
              </button>
            )}

            <button className={styles.nextButton} onClick={handleNext}>
              {activeStep === tourSteps.length - 1 ? "Complete" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIOnboardingTour;
