# Automated Visual Testing Setup

## ✅ Setup Complete!

Automated visual testing for the Joyride tour has been set up using Playwright.

## What Was Installed

1. **Playwright** - Browser automation and screenshot testing framework
2. **Chromium browser** - For running tests
3. **Test configuration** - `playwright.config.js`
4. **Visual test suite** - `tests/visual/joyride-tour.spec.js`

## Test Scripts

Add these to your `package.json` (already added):

```json
{
  "scripts": {
    "test:visual": "playwright test",
    "test:visual:ui": "playwright test --ui",
    "test:visual:debug": "playwright test --debug",
    "test:visual:screenshots": "playwright test --project=chromium"
  }
}
```

## Running Tests

### Basic Test Run
```bash
npm run test:visual
```

This will:
- Start the dev server automatically
- Run all visual tests
- Capture screenshots of each Joyride step
- Generate an HTML report

### Interactive UI Mode
```bash
npm run test:visual:ui
```

Opens Playwright's UI mode where you can:
- See tests running in real-time
- Debug step-by-step
- View screenshots as they're captured

### Debug Mode
```bash
npm run test:visual:debug
```

Opens Playwright Inspector for step-by-step debugging.

## What Gets Tested

The test suite includes:

1. **Light Mode Tour** - Captures all steps in light theme
2. **Dark Mode Tour** - Captures all steps in dark theme  
3. **Mobile Viewport** - Tests responsive design on mobile
4. **Element Highlighting** - Verifies spotlight/overlay works
5. **Tab Switching** - Ensures automatic tab switching works
6. **Tooltip Visibility** - Verifies tooltips appear correctly

## Screenshot Output

Screenshots are saved to:
```
test-results/screenshots/
  - joyride-step-1-light.png
  - joyride-step-2-light.png
  - ...
  - joyride-step-1-dark.png
  - joyride-step-2-dark.png
  - ...
  - joyride-step-1-mobile.png
  - ...
```

## Viewing Results

After running tests, view the HTML report:
```bash
npx playwright show-report
```

This opens an interactive HTML report showing:
- Test results
- Screenshots
- Test timeline
- Error details

## Test Configuration

The tests are configured to:
- Run on desktop (1280x720), mobile (375x667), and tablet viewports
- Test both light and dark themes
- Automatically start the dev server
- Wait for elements to be visible
- Handle skipped steps gracefully

## Continuous Integration

To run in CI, add to your CI config:

```yaml
# Example GitHub Actions
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run visual tests
  run: npm run test:visual
```

## Troubleshooting

### Tests fail to start
- Ensure port 5173 is available
- Check that dev server can start: `npm run dev`

### Screenshots not captured
- Verify `test-results/screenshots/` directory exists
- Check that tour button (`#tour-button`) is visible

### Elements not found
- The `beforeStep` callback should handle missing elements
- Check browser console for warnings
- Increase timeout values if needed

### Tooltip selectors not working
- React-joyride uses dynamic class names
- The test tries multiple selector strategies
- Check Playwright's trace viewer: `npx playwright show-trace trace.zip`

## Next Steps

1. **Run the tests**: `npm run test:visual`
2. **Review screenshots**: Check `test-results/screenshots/`
3. **View HTML report**: `npx playwright show-report`
4. **Add to CI**: Integrate into your CI/CD pipeline
5. **Baseline screenshots**: Commit initial screenshots as baseline
6. **Visual regression**: Use tools like Percy or Chromatic for comparison

## Visual Regression Testing

For automated visual regression testing, consider:

1. **Playwright's built-in comparison**:
   ```javascript
   await expect(page).toHaveScreenshot('step-1.png');
   ```

2. **Percy** - Visual testing platform
3. **Chromatic** - Storybook visual testing
4. **BackstopJS** - Visual regression tool

## Files Created

- `playwright.config.js` - Playwright configuration
- `tests/visual/joyride-tour.spec.js` - Visual test suite
- `tests/visual/README.md` - Test documentation
- `test-results/screenshots/` - Screenshot output directory

## Integration with Existing Tests

These visual tests complement your existing Vitest unit tests:
- **Vitest** - Unit and integration tests
- **Playwright** - Visual and E2E tests

Both can run in parallel or separately.






