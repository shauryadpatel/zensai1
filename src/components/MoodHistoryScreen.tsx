import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import { usePremium } from '../hooks/usePremium';
import Logo from './Logo';
import UpsellModal from './UpsellModal';
import { MoodLevel } from '../types';
import { moods } from '../data/moods';

// Import memoized components
import MoodStatsOverview from './history/MoodStatsOverview';
import HistoryFilters from './history/HistoryFilters';
import JournalEntryCard from './history/JournalEntryCard';
import HistoryPagination from './history/HistoryPagination';
import DateGroupHeader from './history/DateGroupHeader';
import EmptyState from './history/EmptyState';
import PremiumHistoryLimit from './history/PremiumHistoryLimit';
import AdvancedAnalytics from './history/AdvancedAnalytics';

interface MoodHistoryScreenProps {
  onBack: () => void;
}

interface JournalEntry {
  id: string;
  content: string;
  mood: string;
  created_at: string;
  updated_at: string;
  photo_url?: string | null;
  photo_filename?: string | null;
  title?: string | null;
}

interface GroupedEntries {
  [date: string]: JournalEntry[];
}

export default function MoodHistoryScreen({ onBack }: MoodHistoryScreenProps) {
  const { user } = useAuth();
  const { isPremium, isUpsellModalOpen, upsellContent, showUpsellModal, hideUpsellModal } = usePremium();
  const { entries, isLoading, error, deleteEntry, updateEntry } = useJournal();
  
  // Helper functions
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const yesterdayOnly = yesterday.toDateString();
    
    if (dateOnly === todayOnly) return 'Today';
    if (dateOnly === yesterdayOnly) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const formatTime = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }, []);

  const getDateKey = useCallback((dateString: string) => {
    return new Date(dateString).toDateString();
  }, []);

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMood, setFilterMood] = useState<MoodLevel | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const ENTRIES_PER_PAGE = 10;
  
  // Memoized filtered and sorted entries
  const filteredEntries = useMemo(() => {
    let filtered = entries;
    
    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.content.toLowerCase().includes(searchLower) ||
        (entry.title && entry.title.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by mood
    if (filterMood !== 'all') {
      filtered = filtered.filter(entry => entry.mood === filterMood);
    }
    
    return filtered;
  }, [entries, searchTerm, filterMood]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [filteredEntries, sortOrder]);

  const groupedEntries = useMemo(() => {
    return sortedEntries.reduce((groups: GroupedEntries, entry) => {
      const dateKey = getDateKey(entry.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
      return groups;
    }, {});
  }, [sortedEntries, getDateKey]);

  const groupedDates = useMemo(() => {
    return Object.keys(groupedEntries).sort((a, b) => {
      const dateA = new Date(a).getTime();
      const dateB = new Date(b).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [groupedEntries, sortOrder]);

  const totalPages = Math.ceil(groupedDates.length / ENTRIES_PER_PAGE);
  
  const paginatedDates = useMemo(() => {
    const startIndex = (currentPage - 1) * ENTRIES_PER_PAGE;
    const endIndex = startIndex + ENTRIES_PER_PAGE;
    return groupedDates.slice(startIndex, endIndex);
  }, [groupedDates, currentPage, ENTRIES_PER_PAGE]);

  // Mood statistics
  const moodStats = useMemo(() => {
    const stats = entries.reduce((acc, entry) => {
      // Use the mood string as the key
      const moodString = entry.mood;
      acc[moodString] = (acc[moodString] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return moods.map(mood => ({
      ...mood,
      // Map the mood level to the corresponding string key in stats
      count: stats[getMoodString(mood.level)] || 0,
      percentage: entries.length > 0 ? ((stats[getMoodString(mood.level)] || 0) / entries.length) * 100 : 0
    }));
  }, [entries]);
  
  // Helper function to convert mood level to string
  function getMoodString(level: MoodLevel): string {
    const moodMap: Record<MoodLevel, string> = {
      1: 'struggling',
      2: 'low',
      3: 'neutral',
      4: 'good',
      5: 'amazing'
    };
    return moodMap[level];
  }

  // Event handlers
  const handleEditEntry = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    setExpandedEntry(entry.id);
  }, []);

  const handleSaveEdit = useCallback(async (entryId: string, updates: Partial<JournalEntry>) => {
    try {
      await updateEntry(entryId, updates);
      setEditingEntry(null);
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  }, [updateEntry]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      try {
        await deleteEntry(entryId);
        if (expandedEntry === entryId) {
          setExpandedEntry(null);
        }
        if (editingEntry?.id === entryId) {
          setEditingEntry(null);
        }
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  }, [deleteEntry, expandedEntry, editingEntry]);

  const toggleEntryExpansion = useCallback((entryId: string) => {
    setExpandedEntry(expandedEntry === entryId ? null : entryId);
  }, [expandedEntry]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterMood('all');
    setSortOrder('newest');
    setCurrentPage(1);
  }, []);

  const handleShowUpsellModal = useCallback(() => {
    showUpsellModal('Advanced Analytics', 'Get detailed insights into your mood patterns and journaling habits with premium analytics.');
  }, [showUpsellModal]);

  // Check if we need to show the history limit message
  const showHistoryLimitMessage = !isPremium && entries.length > 0 && 
    (entries.length >= 30 || 
     (new Date().getTime() - new Date(entries[entries.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24) >= 30);

  // Loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zen-mint-50 via-zen-cream-50 to-zen-lavender-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zen-mint-500 mx-auto mb-4"></div>
          <p className="text-zen-sage-600 dark:text-gray-400">Loading your journal history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zen-mint-50 via-zen-cream-50 to-zen-lavender-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Failed to load journal history</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-zen-mint-500 text-white rounded-lg hover:bg-zen-mint-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zen-mint-50 via-zen-cream-50 to-zen-lavender-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-32 h-32 bg-zen-mint-200 dark:bg-zen-mint-800 rounded-full opacity-20"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-40 right-20 w-24 h-24 bg-zen-lavender-200 dark:bg-zen-lavender-800 rounded-full opacity-20"
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-32 left-1/4 w-40 h-40 bg-zen-peach-200 dark:bg-zen-peach-800 rounded-full opacity-15"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 p-4 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-b border-white/20 dark:border-gray-600/20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-zen-sage-600 dark:text-gray-400 hover:text-zen-sage-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all duration-300"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            
            <div className="flex items-center space-x-3">
              <Logo size="sm" className="mr-1" />
              <h1 className="font-display font-bold text-zen-sage-800 dark:text-gray-200 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-zen-mint-500" aria-hidden="true" />
                Journal Dashboard
              </h1>
              <p className="text-xs text-zen-sage-600 dark:text-gray-400">
                {filteredEntries.length} of {entries.length} entries
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Mood Statistics Overview */}
        <MoodStatsOverview moodStats={moodStats} />

        {/* Search and Filters */}
        <HistoryFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterMood={filterMood}
          onFilterMoodChange={setFilterMood}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onClearFilters={clearFilters}
        />

        {/* Advanced Analytics Section (Premium Feature) */}
        <AdvancedAnalytics 
          isPremium={isPremium} 
          onUpgrade={handleShowUpsellModal} 
        />

        {/* Premium History Limit Message */}
        <PremiumHistoryLimit 
          showHistoryLimitMessage={showHistoryLimitMessage} 
          onUpgrade={handleShowUpsellModal} 
        />

        {/* Entries Timeline */}
        <div className="space-y-8">
          {paginatedDates.length === 0 ? (
            <EmptyState 
              searchTerm={searchTerm} 
              filterMood={filterMood === 'all' ? 'all' : moods.find(m => m.level === filterMood)?.label || 'all'} 
              onClearFilters={clearFilters} 
            />
          ) : (
            paginatedDates.map((dateKey, dateIndex) => {
              const dayEntries = groupedEntries[dateKey];
              
              return (
                <motion.div
                  key={dateKey}
                  className="relative"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dateIndex * 0.1 }}
                >
                  {/* Date Header */}
                  <DateGroupHeader 
                    date={dateKey} 
                    entries={dayEntries} 
                    index={dateIndex} 
                  />

                  {/* Entries for this date */}
                  <div className="space-y-4 ml-8">
                    {dayEntries.map((entry, entryIndex) => (
                      <JournalEntryCard
                        key={entry.id}
                        entry={entry}
                        isExpanded={expandedEntry === entry.id}
                        isEditing={editingEntry?.id === entry.id}
                        onToggleExpand={toggleEntryExpansion}
                        onEdit={handleEditEntry}
                        onDelete={handleDeleteEntry}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingEntry(null)}
                        index={entryIndex}
                        delay={dateIndex * 0.1 + entryIndex * 0.05}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <HistoryPagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={isUpsellModalOpen}
        onClose={hideUpsellModal}
        featureName={upsellContent?.featureName || 'Premium Feature'}
        featureDescription={upsellContent?.featureDescription || 'Upgrade to unlock premium features'}
      />
    </div>
  );
}