import { Story, StoryStep, ChatMessage } from "../types";
import { storageService } from "./storage";
import { LLMService } from "./llm";

class StoryManager {
  private currentStory: Story | null = null;

  // Create a new story
  createNewStory(): Story {
    const now = new Date();
    const story: Story = {
      id: `story-${Date.now()}`,
      title: `Story from ${now.toLocaleDateString()}`,
      steps: [],
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.currentStory = story;
    return story;
  }

  // Get the current active story
  getCurrentStory(): Story | null {
    return this.currentStory;
  }

  // Set the current story
  setCurrentStory(story: Story): void {
    this.currentStory = story;
  }

  // Add a step to the current story
  async addStep(
    userMessage: ChatMessage,
    aiResponse: ChatMessage,
    componentCode?: string
  ): Promise<void> {
    if (!this.currentStory) {
      throw new Error("No active story");
    }

    const step: StoryStep = {
      stepNumber: this.currentStory.steps.length + 1,
      userMessage,
      aiResponse,
      componentCode,
      timestamp: new Date(),
    };

    this.currentStory.steps.push(step);
    this.currentStory.currentStep = step.stepNumber;
    this.currentStory.updatedAt = new Date();

    // Generate title from first user message if still using default
    if (
      this.currentStory.steps.length === 1 &&
      this.currentStory.title.startsWith("Story from")
    ) {
      const firstMessage = userMessage.content.replace(
        /\[DYNAMIC_EVENT[^\]]*\]/g,
        ""
      );
      this.currentStory.title =
        firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");
    }

    await storageService.saveStory(this.currentStory);
  }

  // Load a story and optionally jump to a specific step
  async loadStory(storyId: string, stepNumber?: number): Promise<Story> {
    const story = await storageService.getStory(storyId);
    if (!story) {
      throw new Error(`Story not found: ${storyId}`);
    }

    // If stepNumber provided, load up to that step
    if (stepNumber !== undefined) {
      story.currentStep = Math.min(stepNumber, story.steps.length);
    }

    this.currentStory = story;

    // Rebuild LLM history up to current step
    await this.syncLLMHistory();

    return story;
  }

  // Sync LLM history with current story state
  private async syncLLMHistory(): Promise<void> {
    if (!this.currentStory) return;

    // Clear existing history
    LLMService.clearHistory();

    // Replay messages up to current step
    const stepsToReplay = this.currentStory.steps.slice(
      0,
      this.currentStory.currentStep
    );

    for (const step of stepsToReplay) {
      LLMService.addToHistory(step.userMessage);
      LLMService.addToHistory(step.aiResponse);
    }
  }

  // Update story title
  async updateTitle(storyId: string, newTitle: string): Promise<void> {
    const story = await storageService.getStory(storyId);
    if (!story) {
      throw new Error(`Story not found: ${storyId}`);
    }

    story.title = newTitle;
    story.updatedAt = new Date();
    await storageService.saveStory(story);

    if (this.currentStory?.id === storyId) {
      this.currentStory.title = newTitle;
    }
  }

  // Delete a story
  async deleteStory(storyId: string): Promise<void> {
    await storageService.deleteStory(storyId);

    if (this.currentStory?.id === storyId) {
      this.currentStory = null;
      LLMService.clearHistory();
    }
  }

  // Get all story summaries
  async getAllStorySummaries() {
    return storageService.getStorySummaries();
  }

  // Get storage statistics
  async getStorageStats() {
    return storageService.getStorageEstimate();
  }

  // Navigate to a specific step in current story
  async goToStep(stepNumber: number): Promise<void> {
    if (!this.currentStory) {
      throw new Error("No active story");
    }

    if (stepNumber < 1 || stepNumber > this.currentStory.steps.length) {
      throw new Error(`Invalid step number: ${stepNumber}`);
    }

    this.currentStory.currentStep = stepNumber;
    this.currentStory.updatedAt = new Date();
    await storageService.saveStory(this.currentStory);

    // Resync LLM history
    await this.syncLLMHistory();
  }

  // Save current story without adding a step
  async saveCurrentStory(): Promise<void> {
    if (!this.currentStory) return;

    this.currentStory.updatedAt = new Date();
    await storageService.saveStory(this.currentStory);
  }
}

export const storyManager = new StoryManager();
