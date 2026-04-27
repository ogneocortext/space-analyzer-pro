import { Sparkles } from "lucide-react";

export const SmartActionTrigger = ({ context }: { context: string }) => {
  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Logic to open side panel and inject prompt:
    console.log(`Asking AI about: ${context}`);
  };

  return (
    <button
      onClick={handleAskAI}
      className="group relative flex items-center justify-center p-1.5 rounded-md hover:bg-purple-500/20 transition-all border border-transparent hover:border-purple-500/40"
      title="Analyze with AI"
    >
      <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-purple-600 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
        Analyze {context}
      </span>
    </button>
  );
};
