import React from "react";

interface FileExplorerPaginationProps {
  currentPage: number;
  totalPages: number;
  totalFiles: number;
  onPageChange: (page: number) => void;
}

export const FileExplorerPagination: React.FC<FileExplorerPaginationProps> = ({
  currentPage,
  totalPages,
  totalFiles,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    // Calculate start page to center current page
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="p-4 border-t border-white/10 bg-white/5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Page {currentPage} of {totalPages} ({totalFiles.toLocaleString()} total files)
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-600 rounded text-sm transition-colors"
          >
            Previous
          </button>

          {/* Page numbers */}
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                pageNum === currentPage
                  ? "bg-cyan-500 text-white"
                  : "bg-white/10 hover:bg-white/20 text-gray-300"
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-600 rounded text-sm transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
