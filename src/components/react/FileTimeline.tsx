import React, { useMemo, useState, type FC } from "react";
import { Clock, File, Folder, ArrowUp, ArrowDown, Calendar, Filter } from "lucide-react";

interface FileWithTime {
  name: string;
  size: number;
  path: string;
  extension: string;
  category: string;
  modifiedAt?: Date;
}

interface FileTimelineProps {
  files: FileWithTime[];
  width?: number;
  height?: number;
}

export const FileTimeline: FC<FileTimelineProps> = ({ files, width = 800, height = 400 }) => {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [groupBy, setGroupBy] = useState<"month" | "week" | "day">("month");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Process files with simulated modification times (for demo - in real app would use actual file metadata)
  const processedFiles = useMemo(() => {
    return files.map((file) => ({
      ...file,
      // Simulate modification times based on file hash for consistency
      modifiedAt: new Date(
        Date.now() - Math.abs(hashCode(file.path) % (365 * 24 * 60 * 60 * 1000))
      ),
    }));
  }, [files]);

  // Group files by time period
  const groupedFiles = useMemo(() => {
    const groups: { [key: string]: FileWithTime[] } = {};

    for (const file of processedFiles) {
      const date = file.modifiedAt!;
      let key: string;

      switch (groupBy) {
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(file);
    }

    // Sort groups by date
    const sortedGroups: Array<{ period: string; files: FileWithTime[] }> = Object.entries(groups)
      .map(([period, files]) => ({
        period,
        files:
          sortOrder === "newest"
            ? files.sort((a, b) => (b.modifiedAt?.getTime() || 0) - (a.modifiedAt?.getTime() || 0))
            : files.sort((a, b) => (a.modifiedAt?.getTime() || 0) - (b.modifiedAt?.getTime() || 0)),
      }))
      .sort((a, b) => {
        const dateA = new Date(a.period);
        const dateB = new Date(b.period);
        return sortOrder === "newest"
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });

    return sortedGroups;
  }, [processedFiles, groupBy, sortOrder]);

  // Calculate statistics
  const stats = useMemo(() => {
    const dates = processedFiles.map((f) => f.modifiedAt!.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalSize = processedFiles.reduce((sum, f) => sum + f.size, 0);

    return {
      totalFiles: processedFiles.length,
      totalSize,
      dateRange: `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`,
      daysSpan: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }, [processedFiles]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    switch (groupBy) {
      case "day":
        return date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      case "week":
        return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      case "month":
        return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      default:
        return dateStr;
    }
  };

  // Simple hash function for consistent "random" dates
  const hashCode = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  // Toggle group selection
  const toggleGroup = (period: string) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(period)) {
        newSet.delete(period);
      } else {
        newSet.add(period);
      }
      return newSet;
    });
  };

  // Select/deselect all groups
  const toggleAllGroups = () => {
    if (selectedGroups.size === groupedFiles.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groupedFiles.map((g) => g.period)));
    }
  };

  if (!files || files.length === 0) {
    return (
      <div
        className="timeline-container glass-panel"
        style={{ padding: "2rem", textAlign: "center" }}
      >
        <Calendar size={48} style={{ color: "var(--text-secondary)", marginBottom: "1rem" }} />
        <p style={{ color: "var(--text-secondary)" }}>
          No files available for timeline visualization
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          Run an analysis first to see the timeline
        </p>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
          <Clock size={20} style={{ color: "var(--accent-blue)" }} />
          File Modification Timeline
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0.5rem 0 0 0" }}>
          Visualize file modification patterns over time
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem",
          padding: "1rem",
          background: "rgba(0, 0, 0, 0.2)",
          borderRadius: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Sort:</span>
          <button
            onClick={() => setSortOrder("newest")}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "none",
              background: sortOrder === "newest" ? "var(--accent-blue)" : "rgba(255,255,255,0.1)",
              color: "white",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            <ArrowDown size={12} style={{ marginRight: "0.25rem" }} /> Newest First
          </button>
          <button
            onClick={() => setSortOrder("oldest")}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "none",
              background: sortOrder === "oldest" ? "var(--accent-blue)" : "rgba(255,255,255,0.1)",
              color: "white",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            <ArrowUp size={12} style={{ marginRight: "0.25rem" }} /> Oldest First
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--border-glass)",
              background: "rgba(0,0,0,0.3)",
              color: "white",
              fontSize: "0.75rem",
            }}
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "auto" }}>
          <button
            onClick={toggleAllGroups}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            {selectedGroups.size === groupedFiles.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div className="stat-card glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-blue)" }}>
            {stats.totalFiles.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total Files</div>
        </div>
        <div className="stat-card glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-green)" }}>
            {formatSize(stats.totalSize)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total Size</div>
        </div>
        <div className="stat-card glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-purple)" }}>
            {stats.daysSpan}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Days Span</div>
        </div>
        <div className="stat-card glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
            {groupedFiles.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Time Groups</div>
        </div>
      </div>

      {/* Timeline visualization */}
      <div
        style={{
          maxHeight: `${height}px`,
          overflowY: "auto",
          background: "rgba(0, 0, 0, 0.2)",
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        {groupedFiles.map((group, groupIndex) => {
          const isSelected = selectedGroups.size === 0 || selectedGroups.has(group.period);
          const groupTotalSize = group.files.reduce((sum, f) => sum + f.size, 0);
          const barWidth = Math.min(100, (groupTotalSize / stats.totalSize) * 100);

          return (
            <div
              key={group.period}
              style={{
                marginBottom: groupIndex < groupedFiles.length - 1 ? "1rem" : 0,
                opacity: isSelected ? 1 : 0.5,
                transition: "opacity 0.2s",
              }}
            >
              {/* Group header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.5rem",
                  cursor: "pointer",
                }}
                onClick={() => toggleGroup(group.period)}
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.size === 0 || selectedGroups.has(group.period)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.period);
                  }}
                />
                <Calendar size={16} style={{ color: "var(--accent-blue)" }} />
                <span style={{ fontWeight: 600 }}>{formatDate(group.period)}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    marginLeft: "auto",
                  }}
                >
                  {group.files.length} files • {formatSize(groupTotalSize)}
                </span>
                {/* Activity bar */}
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "4px",
                    background: `linear-gradient(90deg, var(--accent-blue), var(--accent-purple))`,
                    borderRadius: "2px",
                    minWidth: "20px",
                  }}
                />
              </div>

              {/* File list for this group */}
              {isSelected && (
                <div
                  style={{
                    marginLeft: "2rem",
                    paddingLeft: "1rem",
                    borderLeft: "2px solid var(--border-glass)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  {group.files.slice(0, 10).map((file, fileIndex) => (
                    <div
                      key={file.path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.25rem 0.5rem",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      <File size={12} style={{ color: "var(--text-secondary)" }} />
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.name}
                      </span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.625rem" }}>
                        {formatSize(file.size)}
                      </span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.625rem" }}>
                        {file.modifiedAt?.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                  {group.files.length > 10 && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        padding: "0.25rem 0.5rem",
                        fontStyle: "italic",
                      }}
                    >
                      ... and {group.files.length - 10} more files
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileTimeline;
