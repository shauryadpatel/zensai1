import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '../utils';
import MoodSelector from '../../components/MoodSelector';
import { MoodLevel } from '../../types';
import { moods } from '../../data/moods';

describe('MoodSelector', () => {
  it('renders all mood options', () => {
    act(() => {
      render(
        <MoodSelector
          onMoodSelect={vi.fn()}
        />
      );
    });
    
    // Check that all moods are rendered
    moods.forEach(mood => {
      const moodElement = screen.getByText(mood.label);
      expect(moodElement).toBeInTheDocument();
      
      // Find the parent button that contains this mood
      const moodButton = moodElement.closest('button');
      expect(moodButton).not.toBeNull();
      
      // Check that the emoji is in the same button
      if (moodButton) {
        expect(within(moodButton).getByText(mood.emoji)).toBeInTheDocument();
      }
    });
  });
  
  it('shows selected mood', () => {
    const selectedMood: MoodLevel = 4; // Good
    
    act(() => {
      render(
        <MoodSelector
          selectedMood={selectedMood}
          onMoodSelect={vi.fn()}
        />
      );
    });
    
    // Check that the selected mood has the correct aria-checked state
    const selectedMoodButton = screen.getByRole('radio', { checked: true });
    expect(selectedMoodButton).toHaveTextContent(moods.find(m => m.level === selectedMood)?.label || '');
  });
  
  it('calls onMoodSelect when a mood is clicked', () => {
    const mockOnMoodSelect = vi.fn();
    
    act(() => {
      render(
        <MoodSelector
          onMoodSelect={mockOnMoodSelect}
        />
      );
    });
    
    // Click on the "Good" mood
    act(() => {
      const goodMood = screen.getByText('Good');
      fireEvent.click(goodMood);
    });
    
    // Check that onMoodSelect was called with the correct mood level
    expect(mockOnMoodSelect).toHaveBeenCalledWith(4);
  });
  
  it('handles keyboard navigation', () => {
    const mockOnMoodSelect = vi.fn();
    
    act(() => {
      render(
        <MoodSelector
          onMoodSelect={mockOnMoodSelect}
        />
      );
    });
    
    // Find all mood buttons
    const moodButtons = screen.getAllByRole('radio');
    
    // Press Enter key on the "Good" mood
    act(() => {
      fireEvent.keyDown(moodButtons[3], { key: 'Enter' });
    });
    expect(mockOnMoodSelect).toHaveBeenCalledWith(4);
    
    // Press Space key on the "Amazing" mood
    act(() => {
      fireEvent.keyDown(moodButtons[4], { key: ' ' });
    });
    expect(mockOnMoodSelect).toHaveBeenCalledWith(5);
  });
  
  it('respects disabled state', () => {
    const mockOnMoodSelect = vi.fn();
    
    act(() => {
      render(
        <MoodSelector
          onMoodSelect={mockOnMoodSelect}
          disabled={true}
        />
      );
    });
    
    // Click on a mood
    act(() => {
      const goodMood = screen.getByText('Good');
      fireEvent.click(goodMood);
    });
    
    // onMoodSelect should not be called
    expect(mockOnMoodSelect).not.toHaveBeenCalled();
  });
  
  it('renders with different sizes', () => {
    let rerender;
    
    act(() => {
      const result = render(
        <MoodSelector
          onMoodSelect={vi.fn()}
          size="sm"
        />
      );
      rerender = result.rerender;
    });
    
    // Check small size
    let moodButtons = screen.getAllByRole('radio');
    expect(moodButtons[0]).toHaveClass('p-2');
    
    // Check medium size
    act(() => {
      rerender(
        <MoodSelector
          onMoodSelect={vi.fn()}
          size="md"
        />
      );
    });
    
    moodButtons = screen.getAllByRole('radio');
    expect(moodButtons[0]).toHaveClass('p-3');
    
    // Check large size
    act(() => {
      rerender(
        <MoodSelector
          onMoodSelect={vi.fn()}
          size="lg"
        />
      );
    });
    
    moodButtons = screen.getAllByRole('radio');
    expect(moodButtons[0]).toHaveClass('p-4');
  });
  
  it('renders with different layouts', () => {
    let rerender;
    
    act(() => {
      const result = render(
        <MoodSelector
          onMoodSelect={vi.fn()}
          layout="horizontal"
        />
      );
      rerender = result.rerender;
    });
    
    // Check horizontal layout
    let container = screen.getByRole('radiogroup');
    expect(container.firstChild).toHaveClass('flex');
    
    // Check grid layout
    act(() => {
      rerender(
        <MoodSelector
          onMoodSelect={vi.fn()}
          layout="grid"
        />
      );
    });
    
    container = screen.getByRole('radiogroup');
    expect(container.firstChild).toHaveClass('grid');
  });
});