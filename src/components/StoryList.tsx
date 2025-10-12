import { StorySummary } from "../types";
import StoryItem from "./StoryItem";

interface StoryListProps {
  stories: StorySummary[];
  currentStoryId: string | null;
  onLoadStory: (storyId: string, stepNumber?: number) => void;
  onDeleteStory: (storyId: string) => void;
}

const StoryList = ({
  stories,
  currentStoryId,
  onLoadStory,
  onDeleteStory,
}: StoryListProps) => {
  // Sort stories to put current story at top
  const sortedStories = [...stories].sort((a, b) => {
    if (a.id === currentStoryId) return -1;
    if (b.id === currentStoryId) return 1;
    return b.lastPlayed.getTime() - a.lastPlayed.getTime();
  });

  return (
    <div className="divide-y divide-gray-200">
      {sortedStories.map((story) => (
        <StoryItem
          key={story.id}
          story={story}
          isActive={story.id === currentStoryId}
          onLoadStory={onLoadStory}
          onDeleteStory={onDeleteStory}
        />
      ))}
    </div>
  );
};

export default StoryList;
