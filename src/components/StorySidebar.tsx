import { useState, useEffect } from "react";
import { StorySummary } from "../types";
import { storyManager } from "../services/storyManager";
import StoryList from "./StoryList";
import StorageWarning from "./StorageWarning";
import CloseButton from "./CloseButton";

interface StorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentStoryId: string | null;
  onLoadStory: (storyId: string, stepNumber?: number) => void;
  onNewStory: () => void;
  onDeleteStory: (storyId: string) => void;
}

const StorySidebar = ({
  isOpen,
  onClose,
  currentStoryId,
  onLoadStory,
  onNewStory,
  onDeleteStory,
}: StorySidebarProps) => {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storageStats, setStorageStats] = useState({
    usage: 0,
    quota: 0,
    percentUsed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStories();
    loadStorageStats();
  }, []);

  const loadStories = async () => {
    setIsLoading(true);
    try {
      const summaries = await storyManager.getAllStorySummaries();
      setStories(summaries);
    } catch (error) {
      console.error("Failed to load stories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const stats = await storyManager.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error("Failed to load storage stats:", error);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await onDeleteStory(storyId);
      await loadStories();
      await loadStorageStats();
    } catch (error) {
      console.error("Failed to delete story:", error);
    }
  };

  const handleNewStory = () => {
    onNewStory();
    onClose();
  };

  // Refresh stories list when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadStories();
      loadStorageStats();
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 flex flex-col z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Stories</h2>
            <CloseButton onClick={onClose} />
          </div>
          <button
            onClick={handleNewStory}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New Story</span>
          </button>
        </div>

        {/* Storage Warning */}
        <StorageWarning
          percentUsed={storageStats.percentUsed}
          usage={storageStats.usage}
          quota={storageStats.quota}
        />

        {/* Stories List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : stories.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="mb-2">No saved stories yet</p>
              <p className="text-sm">Start your first adventure!</p>
            </div>
          ) : (
            <StoryList
              stories={stories}
              currentStoryId={currentStoryId}
              onLoadStory={onLoadStory}
              onDeleteStory={handleDeleteStory}
            />
          )}
        </div>

        {/* Storage Stats Footer */}
        <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Storage:</span>
            <span>
              {formatBytes(storageStats.usage)} /{" "}
              {formatBytes(storageStats.quota)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + " " + sizes[i];
}

export default StorySidebar;
