import React, { useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { designTokens } from "../../styles/tokens";
import { withMemoization, MemoizationLevel } from "../../utils/memoization";

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  modified: Date;
  path: string;
}

interface VirtualizedFileListProps {
  files: FileItem[];
  height?: number;
  itemHeight?: number;
  onItemClick?: (file: FileItem) => void;
  onItemSelect?: (file: FileItem) => void;
  selectedItems?: Set<string>;
  className?: string;
}

const FileListItem: React.FC<{
  file: FileItem;
  onClick?: (file: FileItem) => void;
  onSelect?: (file: FileItem) => void;
  isSelected?: boolean;
  style: React.CSSProperties;
}> = withMemoization(({ file, onClick, onSelect, isSelected, style }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleClick = () => {
    onClick?.(file);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(file);
  };

  const getFileIcon = (type: string): string => {
    if (type.includes("folder") || type.includes("directory")) return "📁";
    if (type.includes("image")) return "🖼️";
    if (type.includes("video")) return "🎥";
    if (type.includes("audio")) return "🎵";
    if (type.includes("pdf")) return "📄";
    if (type.includes("zip") || type.includes("archive")) return "📦";
    if (type.includes("javascript") || type.includes("typescript")) return "📜";
    return "📄";
  };

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
        borderBottom: `1px solid ${designTokens.colors.neutral[200]}`,
        cursor: "pointer",
        backgroundColor: isSelected ? designTokens.colors.primary[50] : "transparent",
        transition: designTokens.transitions.fast,
        userSelect: "none",
      }}
      onClick={handleClick}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-selected={isSelected}
    >
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={isSelected || false}
        // @ts-ignore - onChange type mismatch
        onChange={handleSelect as any}
        style={{
          marginRight: designTokens.spacing.sm,
          cursor: "pointer",
        }}
        aria-label={`Select ${file.name}`}
      />

      {/* File Icon */}
      <span
        style={{
          fontSize: "1.2em",
          marginRight: designTokens.spacing.sm,
          flexShrink: 0,
        }}
        role="img"
        aria-label={`${file.type} file`}
      >
        {getFileIcon(file.type)}
      </span>

      {/* File Name */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          marginRight: designTokens.spacing.md,
        }}
      >
        <div
          style={{
            fontWeight: designTokens.typography.fontWeight.medium,
            color: designTokens.colors.neutral[900],
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {file.name}
        </div>
        <div
          style={{
            fontSize: designTokens.typography.fontSize.sm,
            color: designTokens.colors.neutral[500],
            marginTop: "2px",
          }}
        >
          {file.path}
        </div>
      </div>

      {/* File Size */}
      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          marginRight: designTokens.spacing.md,
          fontSize: designTokens.typography.fontSize.sm,
          color: designTokens.colors.neutral[600],
          minWidth: "80px",
        }}
      >
        {formatFileSize(file.size)}
      </div>

      {/* Modified Date */}
      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          fontSize: designTokens.typography.fontSize.sm,
          color: designTokens.colors.neutral[600],
          minWidth: "120px",
        }}
      >
        {formatDate(file.modified)}
      </div>
    </div>
  );
}, MemoizationLevel.PROPS);

const VirtualizedFileList: React.FC<VirtualizedFileListProps> = withMemoization(
  ({
    files,
    height = 400,
    itemHeight = 60,
    onItemClick,
    onItemSelect,
    selectedItems = new Set(),
    className = "",
  }) => {
    // Sort files for consistent rendering
    const sortedFiles = useMemo(() => {
      return [...files].sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    // Virtualizer setup
    const parentRef = React.useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
      count: sortedFiles.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => itemHeight,
      overscan: 5, // Render 5 extra items outside visible area
    });

    const handleItemClick = React.useCallback(
      (file: FileItem) => {
        onItemClick?.(file);
      },
      [onItemClick]
    );

    const handleItemSelect = React.useCallback(
      (file: FileItem) => {
        onItemSelect?.(file);
      },
      [onItemSelect]
    );

    if (sortedFiles.length === 0) {
      return (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: designTokens.colors.neutral[500],
            fontSize: designTokens.typography.fontSize.lg,
            border: `1px solid ${designTokens.colors.neutral[200]}`,
            borderRadius: designTokens.borderRadius.md,
          }}
          className={className}
        >
          No files found
        </div>
      );
    }

    return (
      <div
        ref={parentRef}
        style={{
          height,
          overflow: "auto",
          border: `1px solid ${designTokens.colors.neutral[200]}`,
          borderRadius: designTokens.borderRadius.md,
          backgroundColor: "white",
        }}
        className={className}
        role="grid"
        aria-label="File list"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const file = sortedFiles[virtualItem.index];
            const isSelected = selectedItems.has(file.id);

            return (
              <FileListItem
                key={file.id}
                file={file}
                onClick={handleItemClick}
                onSelect={handleItemSelect}
                isSelected={isSelected}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  },
  MemoizationLevel.PROPS
);

export default VirtualizedFileList;
