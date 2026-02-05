# Adding a New Page to Joule HVAC App

This guide explains how to add a new page to the Joule HVAC application and create a link to it in the Tools page.

## Overview

Adding a new page involves several steps:
1. Create the page component
2. Add routing configuration
3. Add the tool to the Tools page
4. Test the implementation

## Step 1: Create the Page Component

Create a new React component file in the `src/pages/` directory. The component should be a default export.

**Example:** `src/pages/MyNewTool.jsx`

```jsx
import React from "react";

export default function MyNewTool() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My New Tool</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Description of what this tool does.
      </p>
      {/* Your component content here */}
    </div>
  );
}
```

**Important Notes:**
- Use Tailwind CSS classes for styling (consistent with the app's design system)
- If your component uses complex UI elements, you may need to implement basic UI components inline (Card, Button, etc.) since the app doesn't use shadcn/ui
- Follow the existing patterns in other page components

## Step 2: Add Routing Configuration

### 2.1 Add Lazy Import

In `src/navConfig.js`, add a lazy import for your component near the top with the other page imports:

```javascript
const MyNewTool = lazy(() => import("./pages/MyNewTool"));
```

### 2.2 Add Route Definition

In the `routes` array in `src/navConfig.js`, add your route configuration:

```javascript
{
  path: "/tools/my-new-tool",
  name: "My New Tool",
  label: "My New Tool",
  icon: SettingsIcon, // Use an appropriate icon from lucide-react
  Component: MyNewTool,
  showInNav: false,
  inMobileNav: false,
  inPrimaryNav: false,
  description: "Brief description of what the tool does.",
},
```

**Route Configuration Options:**
- `path`: URL path (should start with `/tools/` for tools)
- `name`: Internal name for the route
- `label`: Display name
- `icon`: Icon component from lucide-react (must be imported)
- `Component`: The lazy-loaded component
- `showInNav`: Whether to show in main navigation (usually `false` for tools)
- `inMobileNav`: Whether to show in mobile navigation
- `inPrimaryNav`: Whether to show in primary navigation
- `description`: Tooltip/description text

## Step 3: Add Tool to Tools Page

### 3.1 Import Icon (if needed)

In `src/pages/Tools.jsx`, ensure the icon you want to use is imported from lucide-react. The Settings icon is already imported as `SettingsIcon`.

### 3.2 Add Tool to Section

Find the appropriate section in the `sections` array and add your tool:

```javascript
{
  path: "/tools/my-new-tool",
  name: "My New Tool",
  label: "My New Tool",
  icon: SettingsIcon,
  description: "Detailed description of what the tool does and how to use it.",
  color: "purple", // Choose from: blue, green, purple, orange
},
```

**Color Options:**
- `blue`: General tools
- `green`: Analysis/calculation tools
- `purple`: Advanced/specialized tools
- `orange`: Troubleshooting/support tools

## Step 4: Test the Implementation

### 4.1 Build the Application

Run the build to check for any errors:

```bash
npm run build
```

### 4.2 Start the Server

Start the server to test the new page:

```bash
node server.js
```

Then open `http://localhost:5173`

### 4.3 Verify Functionality

1. Navigate to `/tools` to see your new tool in the list
2. Click on your tool to navigate to the new page
3. Verify the page loads correctly and functions as expected

For details on running the app, see [SERVER_SETUP.md](SERVER_SETUP.md).

## Common Issues and Solutions

### Icon Import Errors

**Error:** `ReferenceError: Settings is not defined`

**Solution:** Use the correct imported name. Icons are imported like:
```javascript
import { Settings as SettingsIcon } from "lucide-react";
```

Then use `SettingsIcon` in your configuration, not `Settings`.

### Build Errors

**Error:** Component not found or import issues

**Solution:**
- Ensure the file path in the lazy import is correct
- Check that the component has a default export
- Verify all dependencies are properly imported

### Routing Issues

**Error:** Page doesn't load or shows 404

**Solution:**
- Check that the path in navConfig.js matches exactly
- Ensure the route is added to the routes array
- Verify the component is properly exported

## Example: Adding Ecobee Settings Sandbox

Following the steps above, here's what was done to add the Ecobee Settings Sandbox:

1. **Created** `src/pages/EcobeeSettingsSandbox.jsx` with the component
2. **Added import** in `src/navConfig.js`: `const EcobeeSettingsSandbox = lazy(() => import("./pages/EcobeeSettingsSandbox"));`
3. **Added route** in `src/navConfig.js` with path `/tools/ecobee-settings-sandbox`
4. **Added tool** in `src/pages/Tools.jsx` with purple color theme
5. **Fixed icon references** to use `SettingsIcon` instead of `Settings`

## Best Practices

- **Naming:** Use descriptive, consistent naming for files, components, and routes
- **Icons:** Choose appropriate icons from lucide-react that match the tool's purpose
- **Colors:** Use color coding to group similar tools (blue for general, green for analysis, etc.)
- **Descriptions:** Write clear, helpful descriptions for both the route config and tools page
- **Testing:** Always test both the build and runtime behavior
- **Code Style:** Follow the existing code patterns and styling conventions

## File Structure Summary

After adding a new tool, your files should look like:

```
src/
├── pages/
│   ├── Tools.jsx (modified)
│   └── MyNewTool.jsx (new)
└── navConfig.js (modified)
```