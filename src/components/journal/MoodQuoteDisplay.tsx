import React from 'react';

/**
 * MoodQuoteDisplay - Displays inspirational quotes based on the user's mood
 * 
 * @component
 * @param {Object|null} moodQuote - Quote object with text and optional attribution
 * 
 * @example
 * return (
 *   <MoodQuoteDisplay
 *     moodQuote={{ quote: "The best way to predict the future is to create it.", attribution: "Abraham Lincoln" }}
 *   />
 * )
 */
interface MoodQuoteDisplayProps {
  moodQuote: { quote: string; attribution?: string } | null;
}

const MoodQuoteDisplay = React.memo(function MoodQuoteDisplay({
  moodQuote
}: MoodQuoteDisplayProps) {
  if (!moodQuote) return null;

  return (
    <div>
      <p className="text-sm text-zen-sage-700 dark:text-gray-300 italic leading-relaxed">
        "{moodQuote.quote}"
      </p>
      {moodQuote.attribution && (
        <p className="text-xs text-zen-sage-500 dark:text-gray-400 mt-1">
          — {moodQuote.attribution}
        </p>
      )}
    </div>
  );
});

export default MoodQuoteDisplay;