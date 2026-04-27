import React, { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, Image, Film, Music } from "lucide-react";

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSize?: number; // in bytes
  className?: string;
}

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  maxFiles = 10,
  acceptedTypes = ["*/*"],
  maxSize = 50 * 1024 * 1024, // 50MB default
  className = "",
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`;
    }

    if (acceptedTypes.length > 0 && !acceptedTypes.includes("*/*")) {
      const fileType = file.type || "";
      const isAccepted = acceptedTypes.some((type) => {
        if (type.endsWith("/*")) {
          return fileType.startsWith(type.slice(0, -2));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return `File type ${fileType} is not accepted`;
      }
    }

    return null;
  };

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (type.startsWith("video/")) return <Film className="w-4 h-4" />;
    if (type.startsWith("audio/")) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFiles = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files);

      if (uploadedFiles.length + fileArray.length > maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const newFiles: UploadedFile[] = fileArray.map((file) => {
        const error = validateFile(file);
        return {
          file,
          id: Math.random().toString(36).substr(2, 9),
          progress: 0,
          status: error ? "error" : "pending",
          error,
        };
      });

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      const validFiles = newFiles.filter((f) => !f.error).map((f) => f.file);
      if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }
    },
    [uploadedFiles.length, maxFiles, maxSize, acceptedTypes, onFileUpload]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={`file-upload-container ${className}`}>
      <div
        className={`file-upload-dropzone ${dragOver ? "drag-over" : ""}`}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            openFileDialog();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          onChange={handleFileChange}
          accept={acceptedTypes.join(",")}
          style={{ display: "none" }}
        />

        <div className="upload-content">
          <Upload className="upload-icon" />
          <div className="upload-text">
            <p className="upload-title">
              {dragOver ? "Drop files here" : "Click to upload or drag and drop"}
            </p>
            <p className="upload-subtitle">
              Maximum {maxFiles} files • Up to {Math.round(maxSize / 1024 / 1024)}MB each
            </p>
            {acceptedTypes.length > 0 && !acceptedTypes.includes("*/*") && (
              <p className="upload-types">Accepted: {acceptedTypes.join(", ")}</p>
            )}
          </div>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="file-list">
          <h4>Uploaded Files ({uploadedFiles.length})</h4>
          {uploadedFiles.map((uploadedFile) => (
            <div key={uploadedFile.id} className="file-item">
              <div className="file-info">
                {getFileIcon(uploadedFile.file)}
                <div className="file-details">
                  <p className="file-name">{uploadedFile.file.name}</p>
                  <p className="file-meta">
                    {formatFileSize(uploadedFile.file.size)} • {uploadedFile.file.type}
                  </p>
                </div>
              </div>

              <div className="file-actions">
                {uploadedFile.status === "error" && (
                  <span className="error-message" title={uploadedFile.error}>
                    Error
                  </span>
                )}
                <button
                  onClick={() => removeFile(uploadedFile.id)}
                  className="remove-button"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* @ts-ignore - jsx prop */}
      <style jsx>{`
        .file-upload-container {
          width: 100%;
        }

        .file-upload-dropzone {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background-color: #f9fafb;
        }

        .file-upload-dropzone:hover {
          border-color: #6366f1;
          background-color: #f0f9ff;
        }

        .file-upload-dropzone.drag-over {
          border-color: #6366f1;
          background-color: #e0f2fe;
          transform: scale(1.02);
        }

        .upload-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .upload-icon {
          width: 48px;
          height: 48px;
          color: #6b7280;
        }

        .upload-text {
          color: #374151;
        }

        .upload-title {
          font-weight: 600;
          margin: 0;
          font-size: 1.1rem;
        }

        .upload-subtitle,
        .upload-types {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .file-list {
          margin-top: 1.5rem;
        }

        .file-list h4 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          margin-bottom: 0.5rem;
          background-color: #ffffff;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .file-details {
          flex: 1;
        }

        .file-name {
          margin: 0;
          font-weight: 500;
          color: #111827;
          word-break: break-all;
        }

        .file-meta {
          margin: 0;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .file-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .error-message {
          font-size: 0.75rem;
          color: #dc2626;
          background-color: #fef2f2;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .remove-button {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .remove-button:hover {
          background-color: #f3f4f6;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
};

export default React.memo(FileUpload);
