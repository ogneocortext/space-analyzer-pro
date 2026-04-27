import React, { useState, useCallback, useRef, FC } from "react";
import { Upload, File, X, AlertCircle, CheckCircle } from "lucide-react";
import { bridge } from "../services/AnalysisBridge";
import "./DragDropAnalysis.css";

interface DragDropProps {
  onFilesAnalyzed?: (results: any) => void;
  onAnalysisStart?: () => void;
  onAnalysisComplete?: () => void;
  className?: string;
  multiple?: boolean;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
  disabled?: boolean;
}

interface DraggedFile {
  file: File;
  id: string;
  status: "pending" | "analyzing" | "completed" | "error";
  result?: any;
  error?: string;
}

const DragDropAnalysis: FC<DragDropProps> = ({
  onFilesAnalyzed,
  onAnalysisStart,
  onAnalysisComplete,
  className = "",
  multiple = true,
  acceptedTypes = ["*/*"],
  maxFileSize = 100 * 1024 * 1024, // 100MB
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<DraggedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file validation
  const validateFiles = useCallback(
    (files: FileList): DraggedFile[] => {
      const validFiles: DraggedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        // Check file size
        if (file.size > maxFileSize) {
          errors.push(
            `${file.name} is too large (${formatFileSize(file.size)} > ${formatFileSize(maxFileSize)})`
          );
          return;
        }

        // Check file type
        if (acceptedTypes[0] !== "*/*") {
          const fileType = file.type || getFileExtension(file.name);
          if (!acceptedTypes.some((type) => fileType.includes(type.replace("*/*", "")))) {
            errors.push(`${file.name} has unsupported type (${fileType})`);
            return;
          }
        }

        validFiles.push({
          file,
          id: Math.random().toString(36).substr(2, 9),
          status: "pending",
        });
      });

      if (errors.length > 0) {
        // Show errors (could use a toast notification)
        console.error("File validation errors:", errors);
      }

      return validFiles;
    },
    [acceptedTypes, maxFileSize]
  );

  // Handle dropped files
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const validFiles = validateFiles(files);
      if (validFiles.length === 0) return;

      setDraggedFiles((prev) => [...prev, ...validFiles].slice(0, multiple ? 10 : 1));
    },
    [disabled, multiple, validateFiles]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const validFiles = validateFiles(files);
      if (validFiles.length === 0) return;

      setDraggedFiles((prev) => [...prev, ...validFiles].slice(0, multiple ? 10 : 1));

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [disabled, multiple, validateFiles]
  );

  // Analyze files
  const analyzeFiles = useCallback(async () => {
    if (draggedFiles.length === 0) return;

    setIsAnalyzing(true);
    onAnalysisStart?.();

    try {
      const results = [];

      for (let i = 0; i < draggedFiles.length; i++) {
        const draggedFile = draggedFiles[i];

        // Update file status
        setDraggedFiles((prev) =>
          prev.map((f) => (f.id === draggedFile.id ? { ...f, status: "analyzing" } : f))
        );

        // Update progress
        setAnalysisProgress((i / draggedFiles.length) * 100);

        // Analyze file
        const formData = new FormData();
        formData.append("file", draggedFile.file);
        formData.append("fileName", draggedFile.file.name);
        formData.append("fileSize", draggedFile.file.size.toString());

        try {
          const response = await fetch("/api/analyze/file", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            results.push(result.data);

            // Update file status
            setDraggedFiles((prev) =>
              prev.map((f) =>
                f.id === draggedFile.id ? { ...f, status: "completed", result: result.data } : f
              )
            );
          } else {
            throw new Error(result.error || "Analysis failed");
          }
        } catch (error) {
          // Update file status with error
          setDraggedFiles((prev) =>
            prev.map((f) =>
              f.id === draggedFile.id ? { ...f, status: "error", error: error.message } : f
            )
          );
        }
      }

      setAnalysisProgress(100);
      onFilesAnalyzed?.(results);
      onAnalysisComplete?.();

      // Clear files after a delay
      setTimeout(() => {
        setDraggedFiles([]);
        setAnalysisProgress(0);
        setIsAnalyzing(false);
      }, 2000);
    } catch (error) {
      console.error("Analysis error:", error);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [draggedFiles, onFilesAnalyzed, onAnalysisComplete]);

  // Remove file from queue
  const removeFile = useCallback((id: string) => {
    setDraggedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setDraggedFiles([]);
    setAnalysisProgress(0);
    setIsAnalyzing(false);
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
  };

  // Get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  return (
    <div
      className={`drag-drop-container ${className} ${isDragOver ? "drag-over" : ""} ${disabled ? "disabled" : ""}`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(",")}
        onChange={handleFileSelect}
        disabled={disabled || isAnalyzing}
        style={{ display: "none" }}
      />

      {/* Drag and drop area */}
      <div
        className="drag-drop-area"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drag-drop-content">
          {isAnalyzing ? (
            <div className="analysis-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analysisProgress}%` }} />
              </div>
              <div className="progress-text">Analyzing... {Math.round(analysisProgress)}%</div>
            </div>
          ) : (
            <>
              <Upload size={48} className="upload-icon" />
              <div className="drag-text">
                <h3>Drop files here or click to browse</h3>
                <p>
                  {multiple ? "Drop multiple files" : "Drop a single file"}
                  {maxFileSize && ` (max ${formatFileSize(maxFileSize)})`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File queue */}
      {draggedFiles.length > 0 && (
        <div className="file-queue">
          <div className="queue-header">
            <h4>Files to Analyze ({draggedFiles.length})</h4>
            <div className="queue-actions">
              {!isAnalyzing && (
                <>
                  <button
                    onClick={analyzeFiles}
                    className="analyze-btn"
                    disabled={draggedFiles.length === 0}
                  >
                    <File size={16} />
                    Analyze All
                  </button>
                  <button onClick={clearFiles} className="clear-btn">
                    <X size={16} />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="file-list">
            {draggedFiles.map((draggedFile) => (
              <div key={draggedFile.id} className={`file-item ${draggedFile.status}`}>
                <div className="file-info">
                  <File size={16} className="file-icon" />
                  <div className="file-details">
                    <div className="file-name">{draggedFile.file.name}</div>
                    <div className="file-size">{formatFileSize(draggedFile.file.size)}</div>
                  </div>
                </div>

                <div className="file-status">
                  {draggedFile.status === "pending" && <div className="status-pending">Ready</div>}
                  {draggedFile.status === "analyzing" && (
                    <div className="status-analyzing">
                      <div className="spinner"></div>
                      Analyzing...
                    </div>
                  )}
                  {draggedFile.status === "completed" && (
                    <div className="status-completed">
                      <CheckCircle size={16} />
                      Complete
                    </div>
                  )}
                  {draggedFile.status === "error" && (
                    <div className="status-error">
                      <AlertCircle size={16} />
                      {draggedFile.error || "Failed"}
                    </div>
                  )}
                </div>

                {!isAnalyzing && (
                  <button onClick={() => removeFile(draggedFile.id)} className="remove-btn">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DragDropAnalysis;
