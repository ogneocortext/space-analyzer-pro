import { designTokens } from "../tokens";

export const buttonStyles = {
  base: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: ${designTokens.spacing.sm} ${designTokens.spacing.md};
    font-weight: ${designTokens.typography.fontWeight.medium};
    font-size: ${designTokens.typography.fontSize.sm};
    border-radius: ${designTokens.borderRadius.md};
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color ${designTokens.transitions.fast}, border-color ${designTokens.transitions.fast}, transform ${designTokens.transitions.fast}, box-shadow ${designTokens.transitions.fast};
    box-sizing: border-box;
    text-decoration: none;
    outline: none;
  `,

  variants: {
    primary: `
      background-color: ${designTokens.colors.primary[500]};
      color: white;
      &:hover {
        background-color: ${designTokens.colors.primary[600]};
        transform: translateY(-1px);
        box-shadow: ${designTokens.shadows.md};
      }
      &:active {
        transform: translateY(0);
      }
      &:focus {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
    `,

    secondary: `
      background-color: transparent;
      color: ${designTokens.colors.primary[500]};
      border-color: ${designTokens.colors.primary[500]};
      &:hover {
        background-color: ${designTokens.colors.primary[50]};
        border-color: ${designTokens.colors.primary[600]};
      }
      &:focus {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
    `,

    ghost: `
      background-color: transparent;
      color: ${designTokens.colors.neutral[600]};
      border-color: transparent;
      &:hover {
        background-color: ${designTokens.colors.neutral[100]};
        color: ${designTokens.colors.neutral[700]};
      }
    `,

    danger: `
      background-color: ${designTokens.colors.semantic.error};
      color: white;
      &:hover {
        background-color: #dc2626;
      }
    `,
  },

  sizes: {
    sm: `
      padding: ${designTokens.spacing.xs} ${designTokens.spacing.sm};
      font-size: ${designTokens.typography.fontSize.xs};
    `,
    md: `
      padding: ${designTokens.spacing.sm} ${designTokens.spacing.md};
      font-size: ${designTokens.typography.fontSize.sm};
    `,
    lg: `
      padding: ${designTokens.spacing.md} ${designTokens.spacing.lg};
      font-size: ${designTokens.typography.fontSize.base};
    `,
  },

  states: {
    disabled: `
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    `,
    loading: `
      position: relative;
      color: transparent;
      &::after {
        content: '';
        position: absolute;
        width: 1rem;
        height: 1rem;
        top: 50%;
        left: 50%;
        margin-left: -0.5rem;
        margin-top: -0.5rem;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
    `,
  },
};

// Utility functions for composing styles
export const getButtonStyles = (
  variant: keyof typeof buttonStyles.variants = "primary",
  size: keyof typeof buttonStyles.sizes = "md",
  disabled = false,
  loading = false
) => {
  let styles = buttonStyles.base + buttonStyles.variants[variant] + buttonStyles.sizes[size];

  if (disabled) {
    styles += buttonStyles.states.disabled;
  }

  if (loading) {
    styles += buttonStyles.states.loading;
  }

  return styles;
};
