import { useState } from 'react';
import { ChromePicker } from 'react-color';

export default function ColorPicker({ color, onChange }) {
  const [showPicker, setShowPicker] = useState(false);

  const presetColors = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E'
  ];

  const generateRandomColor = () => {
    const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];
    onChange(randomColor);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Preview box */}
        <div
          className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer hover:border-orange-500 transition"
          style={{ backgroundColor: color }}
          onClick={() => setShowPicker(!showPicker)}
          title="Clique para escolher uma cor"
        />

        {/* Hex input */}
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="#000000"
          pattern="^#[0-9A-F]{6}$"
          maxLength={7}
        />

        {/* Random button (icon only) */}
        <button
          type="button"
          onClick={generateRandomColor}
          className="w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center transition"
          title="Gerar cor aleatória"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* ChromePicker - positioned to the right, aligned to bottom of preview box */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute z-50 left-14 bottom-0">
            <ChromePicker
              color={color}
              onChange={(color) => onChange(color.hex.toUpperCase())}
              disableAlpha={true}
            />
          </div>
        </>
      )}
    </div>
  );
}
