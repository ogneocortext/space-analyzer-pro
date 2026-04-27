import React, { useState, useMemo, type FC } from "react";
import { Calendar, Clock, File, ChevronDown, ChevronUp } from "lucide-react";

interface TimelineFile {
  name: string;
  size: number;
  path: string;
  modified?: number; // timestamp
  category: string;
}

interface TimelineViewProps {
  files: TimelineFile[];
  width?: number;
  height?: number;
}

interface TimeGroup {
  label: string;
  files: TimelineFile[];
  collapsed: boolean;
}

const TIME_RANGES = [
  { label: "Today", getTimestamp: () => Date.now() - 24 * 60 * 60 * 1000 },
  { label: "This Week", getTimestamp: () => Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { label: "This Month", getTimestamp: () => Date.now() - 30 * 24 * 60 * 60 * 1000 },
  { label: "This Year", getTimestamp: () => Date.now() - 365 * 24 * 60 * 60 * 1000 },
  { label: "Older", getTimestamp: () => 0 },
];

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (timestamp: number): string => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const TimelineView: FC<TimelineViewProps> = ({ files, width = 800, height = 500 }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "largest">("newest");

  const groupedFiles = useMemo(() => {
    if (!files || files.length === 0) return [];

    const now = Date.now();
    const groups: TimeGroup[] = TIME_RANGES.map((range, index) => ({
      label: range.label,
      files: [],
      collapsed: collapsedGroups.has(index),
    }));

    files.forEach((file) => {
      const timestamp = file.modified || (file as any).birthtime || now;
      const age = now - timestamp;

      if (age < 24 * 60 * 60 * 1000) {
        groups[0].files.push(file);
      } else if (age < 7 * 24 * 60 * 60 * 1000) {
        groups[1].files.push(file);
      } else if (age < 30 * 24 * 60 * 60 * 1000) {
        groups[2].files.push(file);
      } else if (age < 365 * 24 * 60 * 60 * 1000) {
        groups[3].files.push(file);
      } else {
        groups[4].files.push(file);
      }
    });

    // Sort files within each group
    groups.forEach((group) => {
      group.files.sort((a, b) => {
        const timeA = a.modified || 0;
        const timeB = b.modified || 0;

        if (sortOrder === "newest") {
          return timeB - timeA;
        } else if (sortOrder === "oldest") {
          return timeA - timeB;
        } else {
          return b.size - a.size;
        }
      });
    });

    // Filter out empty groups
    return groups.filter((group) => group.files.length > 0);
  }, [files, sortOrder, collapsedGroups]);

  const toggleGroup = (index: number) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const totalFiles = files?.length || 0;
  const oldestFile = useMemo(() => {
    if (!files || files.length === 0) return null;
    return files.reduce(
      (oldest, file) => {
        const time = file.modified || 0;
        const oldestTime = oldest?.modified || 0;
        return time < oldestTime && time > 0 ? file : oldest;
      },
      null as TimelineFile | null
    );
  }, [files]);

  const newestFile = useMemo(() => {
    if (!files || files.length === 0) return null;
    return files.reduce(
      (newest, file) => {
        const time = file.modified || 0;
        const newestTime = newest?.modified || 0;
        return time > newestTime ? file : newest;
      },
      null as TimelineFile | null
    );
  }, [files]);

  if (!files || files.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Calendar size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
          <p>No timeline data available</p>
          <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Run an analysis to see file modification timeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width, height: "auto", minHeight: height }}>
      {/* Header Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-blue)" }}>
            {totalFiles.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total Files</div>
        </div>
        <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-green)" }}>
            {newestFile ? formatDate(newestFile.modified || 0).split(",")[0] : "N/A"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Most Recent</div>
        </div>
        <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-purple)" }}>
            {oldestFile ? formatDate(oldestFile.modified || 0).split(",")[0] : "N/A"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Oldest File</div>
        </div>
      </div>

      {/* Sort Controls */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          padding: "0.5rem",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "8px",
        }}
      >
        <Clock size={16} style={{ color: "var(--text-secondary)" }} />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="largest">Largest First</option>
        </select>
      </div>

      {/* Timeline Groups */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxHeight: height - 150,
          overflowY: "auto",
        }}
      >
        {groupedFiles.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className="glass-panel"
            style={{
              overflow: "hidden",
              transition: "all 0.3s ease",
            }}
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(groupIndex)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "1rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{group.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {group.files.length} files
                </div>
              </div>
              {group.collapsed ? (
                <ChevronDown size={18} style={{ color: "var(--text-secondary)" }} />
              ) : (
                <ChevronUp size={18} style={{ color: "var(--text-secondary)" }} />
              )}
            </button>

            {/* Group Content */}
            {!group.collapsed && (
              <div
                style={{
                  padding: "0 1rem 1rem 1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {group.files.slice(0, 20).map((file, fileIndex) => (
                  <div
                    key={fileIndex}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "8px",
                      transition: "background 0.2s",
                    }}
                  >
                    <File size={16} style={{ color: "var(--text-secondary)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {formatSize(file.size)} • {formatDate(file.modified || 0)}
                      </div>
                    </div>
                  </div>
                ))}
                {group.files.length > 20 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "0.5rem",
                      color: "var(--text-secondary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    +{group.files.length - 20} more files
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineView;
