import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, BarChart3, BookOpen, EyeOff } from 'lucide-react';
import { PREMIUM } from '../../constants/uiStrings';

/**
 * BenefitsSection - Displays the key benefits of premium subscription
 * 
 * @component
 * @example
 * return <BenefitsSection />
 */
const BenefitsSection = React.memo(function BenefitsSection() {
  const { BENEFITS_SECTION } = PREMIUM;
  
  // Map benefit titles to appropriate icons
  const getIconForBenefit = (title: string) => {
    switch (title) {
      case "Voice Affirmations":
        return <Volume2 className="w-6 h-6 text-zen-mint-500" aria-hidden="true" />;
      case "Advanced Analytics":
        return <BarChart3 className="w-6 h-6 text-zen-mint-500" aria-hidden="true" />;
      case "Unlimited Journaling":
        return <BookOpen className="w-6 h-6 text-zen-mint-500" aria-hidden="true" />;
      case "Ad-Free Experience":
        return <EyeOff className="w-6 h-6 text-zen-mint-500" aria-hidden="true" />;
      default:
        return <Volume2 className="w-6 h-6 text-zen-mint-500" aria-hidden="true" />;
    }
  };

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 dark:border-gray-600/20">
        <h3 className="text-2xl font-display font-bold text-zen-sage-800 dark:text-gray-200 mb-4 text-center">
          {BENEFITS_SECTION.TITLE}
        </h3>
        
        <p className="text-lg text-zen-sage-600 dark:text-gray-400 text-center mb-8 max-w-2xl mx-auto">
          {BENEFITS_SECTION.SUBTITLE}
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {BENEFITS_SECTION.ITEMS.map((benefit, index) => (
            <motion.div
              key={benefit.TITLE}
              className="bg-white/80 dark:bg-gray-700/80 rounded-2xl p-6 shadow-md border border-white/20 dark:border-gray-600/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="flex items-start space-x-4">
                <div className="bg-zen-mint-50 dark:bg-zen-mint-900/30 p-3 rounded-xl">
                  {getIconForBenefit(benefit.TITLE)}
                </div>
                <div>
                  <h4 className="text-lg font-display font-semibold text-zen-sage-800 dark:text-gray-200 mb-2">
                    {benefit.TITLE}
                  </h4>
                  <p className="text-zen-sage-600 dark:text-gray-400">
                    {benefit.DESCRIPTION}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

export default BenefitsSection;