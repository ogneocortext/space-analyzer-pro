import React, { useState, useEffect } from "react";
import AIOnboardingTour from "./AIOnboardingTour";
import styles from "./AIOnboardingManager.module.css";

interface AIOnboardingManagerProps {
  children: React.ReactNode;
}

const AIOnboardingManager: React.FC<AIOnboardingManagerProps> = ({ children }) => {
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);

  useEffect(() => {
    // Check if user has completed the tour
    const completed = localStorage.getItem("ai-onboarding-completed") === "true";
    setHasCompletedTour(completed);

    // Show tour for first-time users after a short delay
    // COMMENTED OUT TO DISABLE TOUR
    // if (!completed) {
    //   const timer = setTimeout(() => {
    //     setShowTour(true);
    //   }, 2000);
    //
    //   return () => clearTimeout(timer);
    // }
  }, []);

  const handleTourComplete = () => {
    setShowTour(false);
    setHasCompletedTour(true);
    localStorage.setItem("ai-onboarding-completed", "true");
  };

  const handleTourSkip = () => {
    setShowTour(false);
    localStorage.setItem("ai-onboarding-completed", "true");
  };

  const restartTour = () => {
    setTourStep(0);
    setShowTour(true);
    localStorage.removeItem("ai-onboarding-completed");
  };

  return (
    <div className={styles.onboardingContainer}>
      {children}

      {/* Tour Trigger Button (for users who want to restart) */}
      {hasCompletedTour && (
        <button
          className={styles.tourTrigger}
          onClick={restartTour}
          title="Restart AI Features Tour"
        >
          <span className={styles.tourTriggerIcon}>🎯</span>
        </button>
      )}

      {/* AI Onboarding Tour */}
      <AIOnboardingTour
        isVisible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        currentStep={tourStep}
      />
    </div>
  );
};

export default AIOnboardingManager;
