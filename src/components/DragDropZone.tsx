import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File, Folder, AlertCircle } from 'lucide-react';

interface DragDropZoneProps {
  onDrop: (files: File[], context?: string) => void;
  onTextDrop?: (text: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  accept?: string[];
  maxSize?: number; // in bytes
  multiple?: boolean;
}

interface DropZoneState {
  isDragging: boolean;
  isDragOver: boolean;
  dragCounter: number;
  error: string | null;
}

const DragDropZone: React.FC<DragDropZoneProps> = ({
  onDrop,
  onTextDrop,
  children,
  className = '',
  disabled = false,
  accept = [],
  maxSize = 100 * 1024 * 1024, // 100MB default
  multiple = true
}) => {
  const [state, setState] = useState<DropZoneState>({
    isDragging: false,
    isDragOver: false,
    dragCounter: 0,
    error: null
  });

  const dragCounter = useRef(0);
  // @ts-ignore - useRef with no initial value
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const showError = useCallback((message: string) => {
    setState(prev => ({ ...prev, error: message }));
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(clearError, 3000);
  }, [clearError]);

  const validateFiles = useCallback((files: FileList): File[] => {
    const validFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > maxSize) {
        showError(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`);
        continue;
      }
      
      // Check file type if accept is specified
      if (accept.length > 0 && !accept.some(type => file.type.includes(type) || file.name.endsWith(type))) {
        showError(`File type "${file.type}" not accepted`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    return validFiles;
  }, [accept, maxSize, showError]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    dragCounter.current++;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setState(prev => ({
        ...prev,
        isDragging: true,
        isDragOver: true,
        dragCounter: dragCounter.current
      }));
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setState(prev => ({
        ...prev,
        isDragging: false,
        isDragOver: false,
        dragCounter: 0
      }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    if (e.dataTransfer.dropEffect === 'copy') {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      isDragOver: false,
      dragCounter: 0
    }));
    
    dragCounter.current = 0;

    // Handle text drop
    if (e.dataTransfer.types.includes('text/plain') && onTextDrop) {
      const text = e.dataTransfer.getData('text/plain');
      if (text.trim()) {
        onTextDrop(text);
        return;
      }
    }

    // Handle file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = validateFiles(e.dataTransfer.files);
      
      if (files.length > 0) {
        if (!multiple && files.length > 1) {
          showError('Only one file can be dropped at a time');
          return;
        }
        
        // Determine context from the drop target
        const context = (e.target as HTMLElement).closest('[data-drop-context]')?.getAttribute('data-drop-context') || undefined;
        onDrop(files, context);
      }
    }
  }, [disabled, validateFiles, multiple, onDrop, onTextDrop, showError]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-drop-context="general"
    >
      {children}
      
      {/* Drag Overlay */}
      <AnimatePresence>
        {state.isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-4"
              >
                <Upload className="w-12 h-12 text-blue-400 mx-auto" />
              </motion.div>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-blue-300 font-medium mb-2">
                  Drop files here to analyze
                </p>
                <p className="text-blue-400/70 text-sm">
                  {multiple ? 'Drop multiple files' : 'Drop one file'}
                </p>
                {maxSize && (
                  <p className="text-blue-400/50 text-xs mt-1">
                    Max size: {formatFileSize(maxSize)}
                  </p>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-w-sm z-20"
          >
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-300 text-sm">{state.error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Hook for AI Chat drag and drop
export const useAIDragDrop = () => {
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [droppedText, setDroppedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileDrop = useCallback(async (files: File[], context?: string) => {
    setIsProcessing(true);
    setDroppedFiles(files);

    try {
      // Generate AI prompt based on dropped files
      const fileNames = files.map(f => f.name).join(', ');
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      
      let prompt = `Analyze the following file(s): ${fileNames}\n`;
      prompt += `Total size: ${formatFileSize(totalSize)}\n`;
      
      if (context) {
        prompt += `Context: ${context}\n`;
      }
      
      // Add file-specific analysis
      for (const file of files) {
        prompt += `\n- ${file.name} (${formatFileSize(file.size)})`;
        
        // Add file type specific suggestions
        const extension = file.name.split('.').pop()?.toLowerCase();
        switch (extension) {
          case 'js':
          case 'jsx':
          case 'ts':
          case 'tsx':
            prompt += ' - JavaScript/TypeScript file: Check for unused dependencies and bundle size optimization';
            break;
          case 'png':
          case 'jpg':
          case 'jpeg':
          case 'gif':
            prompt += ' - Image file: Consider compression or conversion to WebP';
            break;
          case 'mp4':
          case 'avi':
          case 'mov':
            prompt += ' - Video file: Large media file, consider compression or cloud storage';
            break;
          case 'log':
            prompt += ' - Log file: Can likely be cleared if old';
            break;
          default:
            prompt += ' - File: Review if still needed';
        }
      }
      
      prompt += '\n\nPlease provide specific recommendations for optimizing storage and suggest cleanup actions.';
      
      setDroppedText(prompt);
    } catch (error) {
      console.error('Error processing dropped files:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleTextDrop = useCallback((text: string) => {
    setDroppedText(text);
  }, []);

  const clearDrops = useCallback(() => {
    setDroppedFiles([]);
    setDroppedText('');
  }, []);

  return {
    droppedFiles,
    droppedText,
    isProcessing,
    handleFileDrop,
    handleTextDrop,
    clearDrops
  };
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default DragDropZone;
