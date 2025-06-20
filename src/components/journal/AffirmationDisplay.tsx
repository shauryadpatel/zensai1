import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import VoiceButton from '../VoiceButton';
import { MoodLevel } from '../../types';
import { JOURNAL } from '../../constants/uiStrings';

/**
 * AffirmationDisplay - Displays personalized affirmations with voice playback option
 * 
 * @component
 * @param {string|null} affirmation - Affirmation text to display
 * @param {boolean} showAffirmation - Whether to show the affirmation
 * @param {string|null} affirmationError - Error message if affirmation generation failed
 * @param {boolean} isGeneratingSpeech - Whether speech is being generated
 * @param {boolean} isSpeechPlaying - Whether speech is currently playing
 * @param {function} onPlaySpeech - Function to play affirmation as speech
 * @param {function} onStopSpeech - Function to stop speech playback
 * @param {MoodLevel} [selectedMood=3] - User's selected mood
 * @param {boolean} [isPremiumUser=true] - Whether user has premium access
 * @param {function} [onUpsellTrigger] - Function to trigger premium upsell
 */
interface AffirmationDisplayProps {
  affirmation: string | null;
  affirmationError: string | null;
  isGeneratingSpeech: boolean;
  isSpeechPlaying: boolean;
  onPlaySpeech: () => void;
  onStopSpeech: () => void;
  isPremiumUser?: boolean;
  onUpsellTrigger?: () => void;
}

const AffirmationDisplay = React.memo(function AffirmationDisplay({
  affirmation,
  affirmationError,
  isGeneratingSpeech,
  isSpeechPlaying,
  onPlaySpeech,
  onStopSpeech,
  isPremiumUser = true,
  onUpsellTrigger
}: AffirmationDisplayProps) {
  if (!affirmation) return null;

  return (
    <div className="flex items-start space-x-3">
      <Sparkles className="w-5 h-5 text-zen-peach-500 mt-1 flex-shrink-0" aria-hidden="true" />
      <div>
        <p className="text-zen-sage-700 dark:text-gray-200 font-medium leading-relaxed">
          {affirmation}
        </p>
        {affirmationError && (
          <p className="text-zen-sage-500 dark:text-gray-400 text-sm mt-2 italic">
            {affirmationError}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">
        <VoiceButton
          isGenerating={isGeneratingSpeech}
          isPlaying={isSpeechPlaying}
          onPlay={onPlaySpeech}
          onStop={onStopSpeech}
          size="sm"
          isPremiumUser={isPremiumUser}
          onUpsellTrigger={onUpsellTrigger}
        />
      </div>
    </div>
  );
});

export default AffirmationDisplay;