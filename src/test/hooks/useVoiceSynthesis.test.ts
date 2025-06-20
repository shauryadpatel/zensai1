import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mocks need to be set up before importing the hook
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockImplementation(() => Promise.resolve({
        data: {
          success: true,
          audio_url: 'data:audio/mpeg;base64,test123',
          timestamp: new Date().toISOString()
        },
        error: null
      }))
    }
  }
}));

// Create mock for usePremium
vi.mock('../../hooks/usePremium', () => ({
  usePremium: vi.fn(() => ({
    isPremium: true, 
    trackFeatureUsage: vi.fn(() => true)
  }))
}));

// Import after mocks are set up
import { useVoiceSynthesis } from '../../hooks/useVoiceSynthesis';
import { usePremium } from '../../hooks/usePremium';

// Mock Audio
class MockAudio {
  src: string;
  paused: boolean = true;
  currentTime: number = 0;
  
  // Event handlers
  onloadstart: ((this: HTMLAudioElement, ev: Event) => any) | null = null;
  onended: ((this: HTMLAudioElement, ev: Event) => any) | null = null;
  onerror: ((this: HTMLAudioElement, ev: Event) => any) | null = null;
  
  // Add event listener implementation
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'loadstart') this.onloadstart = listener as any;
    if (type === 'ended') this.onended = listener as any;
    if (type === 'error') this.onerror = listener as any;
  }
  
  // Remove event listener implementation
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'loadstart' && this.onloadstart === listener) this.onloadstart = null;
    if (type === 'ended' && this.onended === listener) this.onended = null;
    if (type === 'error' && this.onerror === listener) this.onerror = null;
  }
  
  constructor(src: string) {
    this.src = src;
    this.currentTime = 0;
  }
  
  play() {
    this.paused = false;
    // Immediately trigger the loadstart event
    if (this.onloadstart) {
      this.onloadstart(new Event('loadstart') as any);
    } 
    return Promise.resolve();
  }
  
  pause() {
    this.paused = true;
  }
}

// Replace global Audio with mock
global.Audio = MockAudio as any;

describe('useVoiceSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should generate and play speech successfully', async () => {
    const { result } = renderHook(() => useVoiceSynthesis());
    
    let success = false;
    
    await act(async () => {
      success = await result.current.generateAndPlaySpeech('Hello, world!');
    });
    
    // Check result of the function call
    expect(success).toBe(true);
    
    // Check state after successful generation
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.error).toBeNull();
  });
  
  it('should handle empty text input', async () => {
    const { result } = renderHook(() => useVoiceSynthesis());
    
    let success = false;
    
    await act(async () => {
      success = await result.current.generateAndPlaySpeech('');
    });
    
    // Check result
    expect(success).toBe(false);
    
    // Check error state
    expect(result.current.error).toContain('Text is required');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });
  
  it('should stop speech playback', async () => {
    const { result } = renderHook(() => useVoiceSynthesis());
    
    // First play something
    await act(async () => {
      await result.current.generateAndPlaySpeech('Hello, world!');
    });
    
    // Then stop it
    act(() => {
      result.current.stopSpeech();
    });
    
    // Check state after stopping
    expect(result.current.isPlaying).toBe(false);
  });
  
  it('should clear errors', async () => {
    const { result } = renderHook(() => useVoiceSynthesis());
    
    // Generate an error
    await act(async () => {
      await result.current.generateAndPlaySpeech('');
    });
    
    // Verify error exists
    expect(result.current.error).not.toBeNull();
    
    // Clear the error
    act(() => {
      result.current.clearError();
    });
    
    // Check error is cleared
    expect(result.current.error).toBeNull();
  });
});

// Test with non-premium user
describe('useVoiceSynthesis with non-premium user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Override the mock for non-premium user tests
    const usePremiumMock = vi.mocked(usePremium);
    usePremiumMock.mockReturnValue({
      isPremium: false,
      trackFeatureUsage: vi.fn(() => false)
    });
  });
  
  it('should show premium required error for free users', async () => {
    const { result } = renderHook(() => useVoiceSynthesis());
    
    let success = false;
    
    await act(async () => {
      success = await result.current.generateAndPlaySpeech('Hello, world!');
    });
    
    // Check result
    expect(success).toBe(false);
    
    // Check error state
    expect(result.current.error).toContain('premium feature');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });
});