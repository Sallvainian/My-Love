import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Heart, Calendar, Bell, Sparkles } from 'lucide-react';
import type { Settings } from '../../types';

const steps = ['Welcome', 'Details', 'Notifications', 'Ready'];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [partnerName, setPartnerName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const { setSettings, setOnboarded } = useAppStore();

  const handleComplete = async () => {
    if (notificationsEnabled && 'Notification' in window) {
      await Notification.requestPermission();
    }

    const settings: Settings = {
      themeName: 'sunset',
      notificationTime,
      relationship: {
        startDate,
        partnerName,
        anniversaries: [
          {
            id: 1,
            date: startDate,
            label: 'First Day Together',
            description: 'The day our story began',
          },
        ],
      },
      customization: {
        accentColor: '#FF6B9D',
        fontFamily: 'Playfair Display',
      },
      notifications: {
        enabled: notificationsEnabled,
        time: notificationTime,
      },
    };

    setSettings(settings);
    setOnboarded(true);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return partnerName.trim() !== '' && startDate !== '';
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="card">
          {/* Progress indicator */}
          <div className="flex gap-2 mb-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                    : 'bg-pink-100'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <div className="mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-7xl mb-4"
                  >
                    💕
                  </motion.div>
                  <h1 className="text-3xl font-serif font-bold text-gradient mb-3">
                    Welcome to My Love
                  </h1>
                  <p className="text-gray-600">
                    A daily reminder of how special you are
                  </p>
                </div>
                <div className="space-y-4 text-left">
                  <div className="flex items-start gap-3">
                    <Heart className="w-6 h-6 text-pink-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-gray-800">Daily Love Notes</p>
                      <p className="text-sm text-gray-600">
                        Get a new heartfelt message every day
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-6 h-6 text-pink-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-gray-800">Beautiful Memories</p>
                      <p className="text-sm text-gray-600">
                        Store photos and special moments together
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-6 h-6 text-pink-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-gray-800">Count Special Days</p>
                      <p className="text-sm text-gray-600">
                        Track anniversaries and celebrations
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-2xl font-serif font-bold text-gray-800 mb-6">
                  Let's Personalize
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name (or a sweet nickname)
                    </label>
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      className="input"
                      placeholder="e.g., My Love"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      When did our story begin?
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input"
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-2xl font-serif font-bold text-gray-800 mb-6">
                  Daily Reminders
                </h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-6 h-6 text-pink-500" />
                      <div>
                        <p className="font-medium text-gray-800">
                          Enable Notifications
                        </p>
                        <p className="text-sm text-gray-600">
                          Get reminded to check your daily message
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        notificationsEnabled ? 'bg-pink-500' : 'bg-gray-300'
                      }`}
                    >
                      <motion.div
                        animate={{ x: notificationsEnabled ? 24 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow"
                      />
                    </button>
                  </div>

                  {notificationsEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What time should I remind you?
                      </label>
                      <input
                        type="time"
                        value={notificationTime}
                        onChange={(e) => setNotificationTime(e.target.value)}
                        className="input"
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-7xl mb-6"
                >
                  ✨
                </motion.div>
                <h2 className="text-2xl font-serif font-bold text-gray-800 mb-3">
                  All Set, {partnerName}!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your daily love notes are ready. Let's start this beautiful
                  journey together! 💕
                </p>
                <div className="bg-pink-50 rounded-2xl p-4 text-left">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Pro tip:</strong> Add this app to your home screen for
                    quick access. Just tap the share button in your browser and
                    select "Add to Home Screen"!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {currentStep > 0 && (
              <button onClick={handleBack} className="btn-secondary flex-1">
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`btn-primary flex-1 ${
                !canProceed() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {currentStep === steps.length - 1 ? "Let's Go!" : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Onboarding;
