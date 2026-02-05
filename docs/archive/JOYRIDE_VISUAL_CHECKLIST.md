# Joyride Tour Visual Checklist

Use this checklist to verify the Joyride tour looks perfect when testing manually.

## Configuration Settings ✅

- [x] `scrollOffset: 100` - Ensures targets aren't stuck under navbar
- [x] `disableScrolling: false` - Allows Joyride to scroll automatically
- [x] `beforeStep` callback - Checks element visibility and triggers UI actions
- [x] `disableFlip: false` - Allows tooltip to flip to stay on screen
- [x] `disableShift: false` - Allows tooltip to shift to stay on screen

## Visual Elements to Check

### Tooltip Appearance
- [ ] Tooltip has proper rounded corners (12px border-radius)
- [ ] Tooltip background color matches theme (white in light mode, dark gray in dark mode)
- [ ] Text is readable with proper contrast
- [ ] Title is bold and slightly larger (18px)
- [ ] Content text has good line height (1.6) for readability
- [ ] Tooltip has shadow for depth (drop-shadow)
- [ ] Tooltip max width is 400px (prevents overly wide tooltips)

### Buttons
- [ ] "Next" button is blue (#3b82f6) with white text
- [ ] "Next" button has proper padding and rounded corners
- [ ] "Back" button is blue text on transparent background
- [ ] "Skip" button is gray and clearly visible
- [ ] All buttons have proper hover states
- [ ] Button spacing is appropriate

### Spotlight/Highlight
- [ ] Highlighted element has blue border (3px solid #60a5fa)
- [ ] Highlighted element has rounded corners (16px border-radius)
- [ ] Overlay is dark (80% opacity black) around highlighted element
- [ ] Spotlight has glowing effect (box-shadow with blue glow)
- [ ] Highlighted element is clearly visible and not obscured

### Positioning
- [ ] Tooltip doesn't go off-screen
- [ ] Tooltip flips/shifts automatically when needed
- [ ] Tooltip arrow points correctly to target element
- [ ] Target elements are scrolled into view properly
- [ ] Scroll offset accounts for navbar (100px)
- [ ] Elements are centered or positioned appropriately in viewport

### Behavior
- [ ] Tour automatically switches to "forecast" tab when needed
- [ ] Tour expands collapsible sections when needed
- [ ] Tour skips steps gracefully if elements can't be found
- [ ] Smooth scrolling to target elements
- [ ] No elements are highlighted that are off-screen or unmounted
- [ ] Progress indicator shows correctly
- [ ] Step counter is accurate

### Theme Support
- [ ] Light mode: Tooltip is white with dark text
- [ ] Dark mode: Tooltip is dark gray with light text
- [ ] All colors adapt properly to theme
- [ ] Contrast is good in both themes

### Responsive Design
- [ ] Tooltip looks good on mobile devices
- [ ] Tooltip looks good on tablet devices
- [ ] Tooltip looks good on desktop
- [ ] Buttons are appropriately sized for touch on mobile
- [ ] Text is readable at all screen sizes

## Steps to Test

1. **Start the tour** - Click "Show Feature Tour" button
2. **Check each step** - Verify each step highlights the correct element
3. **Test tab switching** - Ensure tour switches to forecast tab when needed
4. **Test section expansion** - Ensure collapsible sections expand
5. **Test scrolling** - Verify smooth scrolling to off-screen elements
6. **Test theme switching** - Switch between light/dark mode during tour
7. **Test responsive** - Resize browser window and test on mobile
8. **Test edge cases** - Try with different screen sizes and orientations

## Common Issues to Watch For

- ❌ Tooltip going off-screen
- ❌ Highlighted element not visible
- ❌ Text too small or hard to read
- ❌ Buttons overlapping or too close together
- ❌ Spotlight not highlighting correct element
- ❌ Scrolling not working smoothly
- ❌ Elements highlighted that are unmounted
- ❌ Tab switching not working
- ❌ Section expansion not working

## Console Warnings to Check

Open browser console and watch for:
- `Joyride: Target element not found or not visible...` - Should only appear if element truly can't be made visible
- Any other Joyride-related errors

## Notes

- The `beforeStep` callback will automatically handle tab switching and section expansion
- Elements are checked for both existence and visibility before highlighting
- Steps are skipped gracefully if elements can't be made visible
- Scroll offset of 100px ensures elements aren't hidden under fixed headers






