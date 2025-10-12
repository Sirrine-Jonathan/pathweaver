import { useState, useEffect } from "react";
import { Story } from "../types";
import { storageService } from "../services/storage";
import StoryStepItem from "./StoryStepItem";

interface StoryStepListProps {
  storyId: string;
  currentStepNumber?: number;
  onLoadStep: (stepNumber: number) => void;
}

const StoryStepList = ({
  storyId,
  currentStepNumber,
  onLoadStep,
}: StoryStepListProps) => {
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStory();
  }, [storyId]);

  const loadStory = async () => {
    setIsLoading(true);
    try {
      const loadedStory = await storageService.getStory(storyId);
      setStory(loadedStory);
    } catch (error) {
      console.error("Failed to load story steps:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!story || story.steps.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">No steps yet</div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {story.steps.map((step) => (
        <StoryStepItem
          key={step.stepNumber}
          step={step}
          isCurrent={step.stepNumber === currentStepNumber}
          onLoadStep={onLoadStep}
        />
      ))}
    </div>
  );
};

export default StoryStepList;
