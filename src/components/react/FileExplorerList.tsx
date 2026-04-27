import React from "react";
import { Folder, FileText, Eye, ExternalLink } from "lucide-react";
import { formatFileSize, getCategoryColor } from "../utils/fileUtils";
import { fileSystemService } from "../services/FileSystemService";

interface FileExplorerListProps {
  files: any[];
  onFileClick?: (file: any) => void;
  onFolderSelect?: (path: string) => void;
}

export const FileExplorerList: React.FC<FileExplorerListProps> = ({
  files,
  onFileClick,
  onFolderSelect,
}) => {
  if (files.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No files found matching your criteria</p>
      </div>
    );
  }

  const handleFolderClick = async (file: any, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Use File System Access API to select directory
      const directoryInfo = await fileSystemService.selectDirectory();

      if (directoryInfo) {
        console.log("Selected directory:", directoryInfo);

        // Call the parent callback with the selected path
        if (onFolderSelect) {
          onFolderSelect(directoryInfo.path);
        }
      }
    } catch (error) {
      console.error("Failed to select directory:", error);

      // Fallback to regular file click behavior
      if (onFileClick) {
        onFileClick(file);
      }
    }
  };

  return (
    <div className="divide-y divide-white/10">
      {files.map((file: any, index: number) => (
        <div
          key={`${file.path}-${index}`}
          className="p-4 hover:bg-white/5 transition-colors cursor-pointer group"
          onClick={() => onFileClick?.(file)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                {file.category === "Directory" ? (
                  <Folder size={16} className="text-blue-400" />
                ) : (
                  <FileText size={16} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{file.name}</div>
                <div className="text-gray-400 text-sm truncate">{file.path}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-right">
              <div className="hidden sm:block">
                <span className={`text-sm font-medium ${getCategoryColor(file.category)}`}>
                  {file.category}
                </span>
                {file.extension && <div className="text-gray-500 text-xs">.{file.extension}</div>}
              </div>
              <div className="text-white font-mono text-sm min-w-16">
                {formatFileSize(file.size)}
              </div>
              <div className="flex space-x-2">
                {file.category === "Directory" && (
                  <button
                    className="p-2 bg-blue-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500/30"
                    onClick={(e) => handleFolderClick(file, e)}
                    title="Select this folder for analysis"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button
                  className="p-2 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClick?.(file);
                  }}
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
