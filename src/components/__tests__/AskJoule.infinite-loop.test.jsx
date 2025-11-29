import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import AskJoule from "../AskJoule";

// Track call counts to detect infinite loops
let speakCallCount = 0;
let stopListeningCallCount = 0;
let startListeningCallCount = 0;
let toggleSpeechCallCount = 0;
let stopSpeakingCallCount = 0;

// Mock useSpeechSynthesis hook with state tracking
let mockIsSpeaking = false;
let mockIsEnabled = false;

const mockSpeak = vi.fn((text) => {
  speakCallCount++;
  // Simulate speech starting
  mockIsSpeaking = true;
  // Simulate speech ending after a delay
  setTimeout(() => {
    mockIsSpeaking = false;
  }, 100);
});

const mockStopSpeaking = vi.fn(() => {
  stopSpeakingCallCount++;
  mockIsSpeaking = false;
});

const mockToggleSpeech = vi.fn(() => {
  toggleSpeechCallCount++;
  mockIsEnabled = !mockIsEnabled;
});

// Mock useSpeechRecognition hook with state tracking
let mockIsListening = false;
const mockStartListening = vi.fn(() => {
  startListeningCallCount++;
  mockIsListening = true;
});
const mockStopListening = vi.fn(() => {
  stopListeningCallCount++;
  mockIsListening = false;
});

vi.mock("../../hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => {
    // Return reactive values
    return {
      speak: mockSpeak,
      stop: mockStopSpeaking,
      get isSpeaking() { return mockIsSpeaking; },
      get isEnabled() { return mockIsEnabled; },
      toggleEnabled: mockToggleSpeech,
      isSupported: true,
    };
  },
}));

vi.mock("../../hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    supported: true,
    get isListening() { return mockIsListening; },
    transcript: "",
    startListening: mockStartListening,
    stopListening: mockStopListening,
  }),
}));

// Mock answerWithAgent to return a response
vi.mock("../../lib/groqAgent", () => ({
  answerWithAgent: vi.fn(async () => ({
    success: true,
    message: "This is a test response that should be spoken.",
  })),
}));

describe("AskJoule - Infinite Loop Prevention", () => {
  beforeEach(() => {
    // Reset all counters
    speakCallCount = 0;
    stopListeningCallCount = 0;
    startListeningCallCount = 0;
    toggleSpeechCallCount = 0;
    stopSpeakingCallCount = 0;
    mockIsSpeaking = false;
    mockIsEnabled = false;
    mockIsListening = false;
    mockOnEndCallback = null;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should not create infinite loop when microphone is active and response arrives", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    render(
      <BrowserRouter>
        <AskJoule
          hasLocation={true}
          userSettings={{}}
          groqKey="test-key"
        />
      </BrowserRouter>
    );

    // Step 1: User clicks microphone button (starts listening)
    const micButton = screen.getByTitle(/click to speak|listening/i);
    await user.click(micButton);
    
    expect(mockIsListening).toBe(true);
    expect(startListeningCallCount).toBe(1);

    // Step 2: Simulate a response arriving (this should trigger speech)
    const input = screen.getByLabelText("Ask Joule");
    await user.type(input, "test question");
    const askButton = screen.getByText("Ask");
    await user.click(askButton);

    // Wait for response to be set
    await waitFor(() => {
      expect(screen.getByText(/test response/i)).toBeInTheDocument();
    });

    // Step 3: Advance timers to trigger speech
    await act(async () => {
      vi.advanceTimersByTime(600); // Past the 500ms delay
    });

    // Step 4: Simulate speech starting
    mockIsSpeaking = true;
    mockIsEnabled = true;

    // Step 5: Advance time to check for loops
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Assertions: Should not have excessive calls
    expect(speakCallCount).toBeLessThanOrEqual(2); // Initial call, maybe one retry max
    expect(toggleSpeechCallCount).toBeLessThanOrEqual(1); // Should only toggle once
    expect(stopListeningCallCount).toBeLessThanOrEqual(1); // Should pause once when speaking
  });

  it("should not create infinite loop when stop button is clicked", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    render(
      <BrowserRouter>
        <AskJoule
          hasLocation={true}
          userSettings={{}}
          groqKey="test-key"
        />
      </BrowserRouter>
    );

    // Step 1: Start with microphone on
    const micButton = screen.getByTitle(/click to speak|listening/i);
    await user.click(micButton);
    mockIsListening = true;

    // Step 2: Get a response and start speaking
    const input = screen.getByLabelText("Ask Joule");
    await user.type(input, "test");
    const askButton = screen.getByText("Ask");
    await user.click(askButton);

    await waitFor(() => {
      expect(screen.getByText(/test response/i)).toBeInTheDocument();
    });

    // Step 3: Trigger speech
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    mockIsSpeaking = true;
    mockIsEnabled = true;

    // Step 4: Click stop button
    const stopButton = screen.getByText("Stop");
    await user.click(stopButton);

    // Step 5: Advance time significantly to check for loops
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Assertions: Stop should prevent further speech
    expect(stopSpeakingCallCount).toBe(1);
    expect(speakCallCount).toBeLessThanOrEqual(1); // Should not speak again after stop
    expect(mockIsListening).toBe(false); // Should not auto-resume after manual stop
  });

  it("should not toggle speaker repeatedly when microphone is active", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    render(
      <BrowserRouter>
        <AskJoule
          hasLocation={true}
          userSettings={{}}
          groqKey="test-key"
        />
      </BrowserRouter>
    );

    // Start with microphone on
    const micButton = screen.getByTitle(/click to speak|listening/i);
    await user.click(micButton);
    mockIsListening = true;

    // Get multiple responses
    const input = screen.getByLabelText("Ask Joule");
    for (let i = 0; i < 3; i++) {
      await user.clear(input);
      await user.type(input, `question ${i}`);
      const askButton = screen.getByText("Ask");
      await user.click(askButton);
      
      await waitFor(() => {
        expect(screen.getByText(/test response/i)).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
      });
    }

    // Should only toggle speaker once (when first response arrives)
    expect(toggleSpeechCallCount).toBeLessThanOrEqual(1);
  });

  it("should handle rapid state changes without loops", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    render(
      <BrowserRouter>
        <AskJoule
          hasLocation={true}
          userSettings={{}}
          groqKey="test-key"
        />
      </BrowserRouter>
    );

    // Rapidly toggle microphone
    const micButton = screen.getByTitle(/click to speak|listening/i);
    for (let i = 0; i < 5; i++) {
      await user.click(micButton);
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    }

    // Should not have excessive calls
    expect(startListeningCallCount + stopListeningCallCount).toBeLessThanOrEqual(10);
  });
});

