# Equipment Settings Data Guide

## Overview

This guide explains where and how to add source data for the Equipment Settings Guide page.

## Data Locations

### 1. Primary Data File: `src/utils/equipmentSettingsData.js`

**This is the main file where you should add new equipment types, wiring scenarios, and configurations.**

The file contains:
- `EQUIPMENT_SETTINGS_DATA` - Main data structure
- Helper functions for querying the data

### 2. Knowledge Base: `src/utils/rag/hvacKnowledgeBase.js`

**Add general HVAC knowledge and technical information here.**

This file contains:
- ACCA Manual J/S/D information
- ASHRAE standards
- General HVAC engineering knowledge
- Equipment specifications

### 3. Markdown Documentation: `public/knowledge/` and `public/docs/`

**Add detailed guides, manuals, and reference materials here.**

- `public/knowledge/` - RAG knowledge base markdown files
- `public/docs/` - User-facing documentation

## Adding New Equipment Types

### Step 1: Add to `equipmentSettingsData.js`

```javascript
export const EQUIPMENT_SETTINGS_DATA = {
  // ... existing equipment types ...
  
  // Add your new equipment type
  yourEquipmentType: {
    name: "Your Equipment Name",
    description: "Description of the equipment",
    wiringScenarios: {
      scenarioName: {
        name: "Scenario Name",
        description: "What this scenario covers",
        commonModels: ["Model 1", "Model 2"],
        solutions: {
          solutionName: {
            name: "Solution Name",
            description: "How this solution works",
            compatibleModels: ["Ecobee3 Lite", "Ecobee Enhanced"],
            components: ["Component 1", "Component 2"],
            wiring: {
              ecobee: {
                R: "Description",
                C: "Description",
                // ... other terminals
              },
            },
            settings: {
              equipmentType: "Your Equipment Type",
              heatType: "Conventional",
              // ... other settings
            },
            warnings: ["Warning 1", "Warning 2"],
          },
        },
      },
    },
    settings: {
      installation: {
        equipmentType: "Your Equipment Type",
        // ... settings
      },
      thresholds: {
        // ... threshold settings
      },
    },
  },
};
```

### Step 2: Update the Page Component

In `src/pages/EquipmentSettingsGuide.jsx`, update the `handleGenerate` function to detect your new equipment type:

```javascript
// Detect your equipment type
if (q.includes("your equipment keyword")) {
  const scenario = getWiringScenario("yourEquipmentType", "scenarioName");
  // Generate diagram based on scenario
}
```

## Adding New Wiring Scenarios

### For Existing Equipment Types

1. Add to `wiringScenarios` object in `equipmentSettingsData.js`:

```javascript
wiringScenarios: {
  existingScenario: { /* ... */ },
  newScenario: {
    name: "New Scenario Name",
    description: "Description",
    // ... rest of scenario data
  },
}
```

2. Update detection logic in `EquipmentSettingsGuide.jsx` if needed.

## Adding Model-Specific Information

### Ecobee Models

Add to `ecobeeModels` object in `equipmentSettingsData.js`:

```javascript
ecobeeModels: {
  "Your Ecobee Model": {
    hasSeparateRcRh: true/false,
    hasPEK: true/false,
    hasHumidifier: true/false,
    hasDehumidifier: true/false,
    notes: "Special notes about this model",
  },
}
```

### Equipment Models

Add to the appropriate equipment type's `commonModels` array:

```javascript
commonModels: [
  "Existing Model 1",
  "Your New Model", // Add here
],
```

## Adding Component Recommendations

### Components

Add to `components` object in `equipmentSettingsData.js`:

```javascript
components: {
  yourComponent: {
    name: "Component Name",
    recommendations: [
      "Brand/Model 1",
      "Brand/Model 2",
    ],
    specifications: {
      voltage: "24VAC",
      // ... other specs
    },
  },
}
```

## Adding Markdown Documentation

### For Detailed Guides

1. Create a markdown file in `public/knowledge/` or `public/docs/`:

```markdown
# Your Equipment Guide

## Overview
...

## Installation
...

## Settings
...
```

2. Reference it in the knowledge base or link from the page.

## Data Structure Reference

### Equipment Type Structure

```typescript
{
  name: string;
  description: string;
  wiringScenarios: {
    [scenarioName: string]: {
      name: string;
      description: string;
      commonModels: string[];
      solutions: {
        [solutionName: string]: {
          name: string;
          description: string;
          compatibleModels: string[];
          incompatibleModels?: string[];
          components: string[];
          wiring: {
            ecobee: { [terminal: string]: string };
            [otherComponent: string]: { [terminal: string]: string };
          };
          settings: {
            equipmentType: string;
            heatType: string;
            cooling: string;
            [otherSetting: string]: string;
          };
          warnings: string[];
        };
      };
      criticalWarnings?: string[];
    };
  };
  settings: {
    installation: { [key: string]: string };
    thresholds: { [key: string]: string };
    comfort?: { [key: string]: string };
  };
}
```

## Examples

### Example 1: Adding a New Boiler Model

```javascript
// In equipmentSettingsData.js, boiler section:
commonModels: [
  "Zeus Superior 24",
  "Your New Boiler Model", // Add here
],
```

### Example 2: Adding a New Equipment Type (e.g., Geothermal)

```javascript
// Add new section to EQUIPMENT_SETTINGS_DATA:
geothermal: {
  name: "Geothermal Heat Pump",
  description: "Ground-source heat pump systems",
  wiringScenarios: {
    // ... scenarios
  },
  settings: {
    // ... settings
  },
},
```

### Example 3: Adding a New Solution

```javascript
// In an existing wiring scenario:
solutions: {
  existingSolution: { /* ... */ },
  newSolution: {
    name: "New Solution Name",
    // ... solution data
  },
}
```

## Best Practices

1. **Keep data structured**: Use the existing structure for consistency
2. **Add warnings**: Include safety warnings for dangerous scenarios
3. **Document sources**: Add source information where applicable
4. **Test detection**: Update query detection logic when adding new types
5. **Keep it simple**: Start with common scenarios, expand as needed

## Testing

After adding new data:

1. Test the Equipment Settings Guide page with relevant queries
2. Verify diagrams generate correctly
3. Check that warnings display properly
4. Ensure model compatibility information is accurate

## Questions?

- Check existing equipment types for examples
- Review the knowledge base structure in `hvacKnowledgeBase.js`
- Look at markdown files in `public/knowledge/` for reference


