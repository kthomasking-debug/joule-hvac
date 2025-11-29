/**
 * uiClasses.js — centralized input styling utilities
 *
 * Purpose:
 * - Provide a small set of well-tested Tailwind utility class strings for
 *   form inputs that maintain consistent spacing, borders, and dark mode
 *   styles across the app.
 *
 * Guidance for use:
 * - `inputClasses` is designed for compact numeric inputs and small text fields
 *   that are used in-place (e.g., small number inputs, short selects). It sets
 *   a narrower width so it doesn't stretch the container.
 * - `fullInputClasses` should be used for full-width inputs or when you want
 *   an input that fills the container (e.g., city input, larger text entry,
 *   search boxes, label inputs).
 * - `selectClasses` is tuned for dropdown selects; consistent padding and
 *   full width make selects align within forms and grid layouts.
 *
 * Accessibility & best practices:
 * - Continue to set `aria-*` attributes (e.g., `aria-label`) where appropriate.
 * - When a field is read-only, set `readOnly` and a suitable visual indicator.
 * - For inputs used in larger UIs (e.g., large hero forms or large numeric
 *   displays), keep the existing specialized styling rather than using these
 *   defaults.
 */
export const inputClasses =
  "w-20 p-2 border-2 rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm";
export const fullInputClasses =
  "w-full p-3 border-2 rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm";
export const selectClasses =
  "p-2 border-2 rounded-lg w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm";

// Enhanced card styles with modern design
export const cardClasses =
  "bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700";
export const cardHoverClasses =
  "bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-200 dark:border-gray-700";

// Gradient card backgrounds
export const gradientCardBlue =
  "bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 dark:from-blue-950 dark:via-blue-900 dark:to-indigo-950 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-300 dark:border-blue-700";
export const gradientCardGreen =
  "bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 dark:from-green-950 dark:via-green-900 dark:to-emerald-950 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-green-300 dark:border-green-700";
export const gradientCardPurple =
  "bg-gradient-to-br from-purple-50 via-purple-100 to-pink-100 dark:from-purple-950 dark:via-purple-900 dark:to-pink-950 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-300 dark:border-purple-700";

// Typography classes
export const headingLarge =
  "text-3xl md:text-4xl font-extrabold tracking-tight";
export const headingMedium = "text-2xl md:text-3xl font-bold tracking-tight";
export const headingSmall = "text-xl md:text-2xl font-bold tracking-tight";
export const metricNumber = "text-5xl md:text-6xl font-black tracking-tight";
export const sectionHeader = "text-sm font-bold uppercase tracking-widest";
