import React, { useRef, useEffect, useState } from "react";
import styles from "./MobileGestures.module.css";

interface MobileGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number;
  preventDefault?: boolean;
}

const MobileGestures: React.FC<MobileGesturesProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  threshold = 50,
  preventDefault = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [showGestureHint, setShowGestureHint] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        setTouchStart({
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        });
        setTouchEnd({ x: touch.clientX, y: touch.clientY });
        setPinchDistance(null);
      } else if (e.touches.length === 2 && onPinch) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        setPinchDistance(distance);
      }

      if (preventDefault) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchStart) {
        const touch = e.touches[0];
        setTouchEnd({ x: touch.clientX, y: touch.clientY });
      } else if (e.touches.length === 2 && onPinch && pinchDistance !== null) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const scale = currentDistance / pinchDistance;
        onPinch(scale);
      }

      if (preventDefault) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || !touchEnd) return;

      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      const deltaTime = Date.now() - touchStart.time;

      // Check if it's a swipe (fast movement)
      const isSwipe =
        deltaTime < 500 && (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold);

      if (isSwipe) {
        // Horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight();
            showGestureIndicator("swipe-right");
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft();
            showGestureIndicator("swipe-left");
          }
        }
        // Vertical swipe
        else {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown();
            showGestureIndicator("swipe-down");
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp();
            showGestureIndicator("swipe-up");
          }
        }
      }

      // Reset touch state
      setTouchStart(null);
      setTouchEnd(null);
      setPinchDistance(null);
    };

    const showGestureIndicator = (gesture: string) => {
      setShowGestureHint(gesture);
      setTimeout(() => setShowGestureHint(""), 1000);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: !preventDefault });
    container.addEventListener("touchmove", handleTouchMove, { passive: !preventDefault });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    touchStart,
    touchEnd,
    pinchDistance,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    threshold,
    preventDefault,
  ]);

  return (
    <div ref={containerRef} className={styles.gestureContainer}>
      {children}

      {/* Gesture Indicators */}
      {showGestureHint && (
        <div className={`${styles.gestureIndicator} ${styles[showGestureHint]}`}>
          {showGestureHint === "swipe-left" && "← Swipe Left"}
          {showGestureHint === "swipe-right" && "Swipe Right →"}
          {showGestureHint === "swipe-up" && "↑ Swipe Up"}
          {showGestureHint === "swipe-down" && "↓ Swipe Down"}
        </div>
      )}
    </div>
  );
};

export default MobileGestures;
