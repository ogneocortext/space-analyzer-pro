import React from "react";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";

interface ProgressIndicatorProps {
  message: string;
  progress?: number;
  status?: "loading" | "success" | "error" | "info";
  showProgressBar?: boolean;
  className?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  message,
  progress,
  status = "loading",
  showProgressBar = false,
  className = "",
}) => {
  const getIcon = () => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
    }
  };

  const getProgressColor = () => {
    if (progress !== undefined) {
      if (progress < 33) return "bg-red-500";
      if (progress < 66) return "bg-yellow-500";
      return "bg-green-500";
    }
    return "bg-blue-500";
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 space-y-4 ${className}`}>
      <div className="flex items-center space-x-3">
        {getIcon()}
        <div className="text-center">
          <p className="text-lg font-medium text-white">{message}</p>
          {progress !== undefined && (
            <p className="text-sm text-slate-300 mt-1">{Math.round(progress)}% complete</p>
          )}
        </div>
      </div>

      {showProgressBar && progress !== undefined && (
        <div className="w-full max-w-md">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${getProgressColor()}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "loading" && !showProgressBar && (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        </div>
      )}
    </div>
  );
};

export default ProgressIndicator;
