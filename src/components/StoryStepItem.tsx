import { StoryStep } from "../types";

interface StoryStepItemProps {
  step: StoryStep;
  isCurrent: boolean;
  onLoadStep: (stepNumber: number) => void;
}

const StoryStepItem = ({ step, isCurrent, onLoadStep }: StoryStepItemProps) => {
  const getPreview = (content: string): string => {
    // Remove [DYNAMIC_EVENT] and [TOOL_CALL] markers
    const cleaned = content
      .replace(/\[DYNAMIC_EVENT[^\]]*\]/g, "")
      .replace(/\[TOOL_CALL\][^\]]*$/g, "")
      .trim();
    return cleaned.substring(0, 80) + (cleaned.length > 80 ? "..." : "");
  };

  const userPreview = getPreview(step.userMessage.content);
  const aiPreview = getPreview(step.aiResponse.content);

  return (
    <button
      onClick={() => onLoadStep(step.stepNumber)}
      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
        isCurrent ? "bg-blue-50 border-l-2 border-blue-600" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs font-medium ${
            isCurrent ? "text-blue-700" : "text-gray-500"
          }`}
        >
          Step {step.stepNumber}
          {isCurrent && (
            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">
              Current
            </span>
          )}
        </span>
        {step.componentCode && (
          <span
            className="text-xs text-purple-600"
            title="Interactive component"
          >
            🎮
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-gray-600">
          <span className="font-medium">You:</span>{" "}
          <span className="text-gray-700">{userPreview}</span>
        </div>
        <div className="text-xs text-gray-600">
          <span className="font-medium">AI:</span>{" "}
          <span className="text-gray-700">{aiPreview}</span>
        </div>
      </div>
    </button>
  );
};

export default StoryStepItem;
