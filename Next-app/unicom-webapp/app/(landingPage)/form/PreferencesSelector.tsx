"use client";

import React, { useState, useEffect } from "react";

type Preference = {
  id: string;
  label: string;
  icon: string;
  isCustom?: boolean;
};

interface PreferencesProps {
  onChange: (selectedPreferences: string[]) => void;
  initialPreferences?: string[];
}

const PreferencesSelector: React.FC<PreferencesProps> = ({ onChange, initialPreferences = [] }) => {
  // Predefined preferences with icons
  const defaultPreferences: Preference[] = [
    { id: "NON_SMOKER", label: "Non-smoker", icon: "😊" },
    { id: "PET_FRIENDLY", label: "Pet-friendly", icon: "🐱" },
    { id: "COOKING", label: "Cooking enthusiast", icon: "🍳" },
    { id: "QUIET", label: "Quiet", icon: "🤫" },
    { id: "CLEAN", label: "Clean", icon: "✨" },
    { id: "SOCIAL", label: "Social", icon: "🎉" },
  ];

  // State for all preferences (predefined + custom)
  const [preferences, setPreferences] = useState<Preference[]>(defaultPreferences);
  
  // State for selected preferences
  const [selected, setSelected] = useState<string[]>(initialPreferences);
  
  // State for new custom preference
  const [newPreference, setNewPreference] = useState("");
  
  // State to control custom preference input visibility
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Update parent component when selections change
  useEffect(() => {
    onChange(selected);
  }, [selected, onChange]);

  // Toggle preference selection
  const togglePreference = (preferenceId: string) => {
    setSelected(prev => 
      prev.includes(preferenceId)
        ? prev.filter(id => id !== preferenceId)
        : [...prev, preferenceId]
    );
  };

  // Add custom preference
  const addCustomPreference = () => {
    if (newPreference.trim() === "") return;
    
    const customId = `CUSTOM_${Date.now()}`;
    const newPref: Preference = {
      id: customId,
      label: newPreference,
      icon: "➕",
      isCustom: true
    };
    
    setPreferences(prev => [...prev, newPref]);
    setSelected(prev => [...prev, customId]);
    setNewPreference("");
    setShowCustomInput(false);
  };

  // Handle key press in custom preference input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addCustomPreference();
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Preferences
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {preferences.map((pref) => (
          <button
            key={pref.id}
            type="button"
            onClick={() => togglePreference(pref.id)}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              selected.includes(pref.id)
                ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                : "bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100"
            }`}
          >
            <span className="mr-2">{pref.icon}</span>
            <span>{pref.label}</span>
            {pref.isCustom && selected.includes(pref.id) && (
              <span 
                className="ml-2 text-gray-500 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  // Remove from selected
                  setSelected(prev => prev.filter(id => id !== pref.id));
                  // Remove from preferences list
                  setPreferences(prev => prev.filter(p => p.id !== pref.id));
                }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
        
        {!showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="flex items-center px-4 py-2 rounded-md bg-gray-50 text-gray-700 border border-dashed border-gray-300 hover:bg-gray-100"
          >
            <span className="mr-2">➕</span>
            <span>Add custom</span>
          </button>
        )}
      </div>
      
      {showCustomInput && (
        <div className="flex mt-2">
          <input
            type="text"
            value={newPreference}
            onChange={(e) => setNewPreference(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter custom preference"
            className="flex-grow border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            type="button"
            onClick={addCustomPreference}
            className="bg-indigo-600 text-white px-4 py-2 rounded-r-md hover:bg-indigo-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setNewPreference("");
            }}
            className="ml-2 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
      
      <input
        type="hidden"
        id="generalPreferences"
        name="generalPreferences"
        value={selected.join(",")}
      />
    </div>
  );
};

export default PreferencesSelector;