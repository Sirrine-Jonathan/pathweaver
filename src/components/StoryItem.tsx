import { useState, useEffect } from "react";
import { StorySummary } from "../types";
import { storyManager } from "../services/storyManager";
import StoryStepList from "./StoryStepList";

interface StoryItemProps {
  story: StorySummary;
  isActive: boolean;
  onLoadStory: (storyId: string, stepNumber?: number) => void;
  onDeleteStory: (storyId: string) => void;
}

const StoryItem = ({
  story,
  isActive,
  onLoadStory,
  onDeleteStory,
}: StoryItemProps) => {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(story.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-expand active story
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== story.title) {
      try {
        await storyManager.updateTitle(story.id, editedTitle.trim());
        story.title = editedTitle.trim();
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }
    setIsEditing(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(story.title);
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      handleTitleCancel();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDeleteStory(story.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <div
      className={`${
        isActive ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-gray-50"
      }`}
    >
      {/* Story Header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={handleToggle}
            className="flex-1 min-w-0 text-left flex items-start space-x-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 text-gray-400 mt-0.5 transition-transform ${
                isExpanded ? "transform rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <div className="flex-1 min-w-0 overflow-hidden">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="overflow-hidden">
                  <h3
                    className={`font-medium truncate ${
                      isActive ? "text-blue-900" : "text-gray-900"
                    }`}
                    title={story.title}
                    onDoubleClick={handleTitleClick}
                  >
                    {story.title}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                    <span>{story.stepCount} steps</span>
                    <span>•</span>
                    <span>{getRelativeTime(story.lastPlayed)}</span>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete story"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {/* Preview */}
        {!isExpanded && story.preview && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2 ml-7">
            {story.preview}
          </p>
        )}
      </div>

      {/* Expanded Content - Steps */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-white">
          <StoryStepList
            storyId={story.id}
            currentStepNumber={
              isActive ? storyManager.getCurrentStory()?.currentStep : undefined
            }
            onLoadStep={(stepNumber) => onLoadStory(story.id, stepNumber)}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Story?
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{story.title}"? This action
              cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryItem;
