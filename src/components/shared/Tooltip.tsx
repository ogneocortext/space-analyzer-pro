import React, { useState, useRef, useEffect } from 'react';
import styles from '../../styles/components/Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Tooltip component that shows contextual help information
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current && tooltipRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };

        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = triggerRect.top - tooltipRect.height - 8;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'bottom':
            top = triggerRect.bottom + 8;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'left':
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.left - tooltipRect.width - 8;
            break;
          case 'right':
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.right + 8;
            break;
        }

        // Adjust for viewport boundaries
        if (left < 0) left = 8;
        if (left + tooltipRect.width > viewport.width) {
          left = viewport.width - tooltipRect.width - 8;
        }
        if (top < 0) top = 8;
        if (top + tooltipRect.height > viewport.height) {
          top = viewport.height - tooltipRect.height - 8;
        }

        setTooltipPosition({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className={`${styles.tooltipContainer} ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`${styles.tooltip} ${styles[`tooltip-${position}`]}`}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left
          }}
          role="tooltip"
        >
          <div className={styles.tooltipContent}>
            {content}
          </div>
          <div className={styles.tooltipArrow} />
        </div>
      )}
    </div>
  );
};

/**
 * Simple tooltip variant for icons and small elements
 */
export const IconTooltip: React.FC<Omit<TooltipProps, 'children'> & { icon: React.ReactNode }> = ({
  icon,
  ...props
}) => (
  <Tooltip {...props}>
    <div className={styles.iconWrapper}>
      {icon}
    </div>
  </Tooltip>
);

export default Tooltip;