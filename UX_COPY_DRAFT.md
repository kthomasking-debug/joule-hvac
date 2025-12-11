# System Performance Analyzer - UX Copy Draft

## 1. Top Verdict Banner

**Location:** Immediately above "Short Cycling Detection" heading  
**Purpose:** Give context before users dive into charts

### Severity Logic

Calculate severity based on:
- `totalShortCycles` from `shortCyclingData`
- `totalCycles` (estimated from total runtime periods)
- `shortCyclePercentage = (totalShortCycles / totalCycles) * 100`

### Copy by Severity Level

#### 🟢 Green (Healthy) - Few Short Cycles
**Condition:** `totalShortCycles < 10` OR `shortCyclePercentage < 5%`

```jsx
<div className="bg-green-900/30 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg">
  <p className="text-lg font-semibold text-green-300">
    ✅ Your system looks healthy.
    <span className="font-normal text-green-200 ml-2">
      {totalShortCycles > 0 
        ? `Found ${totalShortCycles} short cycle${totalShortCycles !== 1 ? 's' : ''}, but this is within normal range.`
        : 'No short cycling detected in your data.'}
    </span>
  </p>
</div>
```

#### 🟡 Yellow (Minor Issue) - Moderate Short Cycling
**Condition:** `totalShortCycles >= 10 && totalShortCycles < 30` OR `shortCyclePercentage >= 5% && shortCyclePercentage < 15%`

```jsx
<div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
  <p className="text-lg font-semibold text-yellow-300">
    ⚠️ Heads up:
    <span className="font-normal text-yellow-200 ml-2">
      Your system is short-cycling more than ideal. A small thermostat change can help reduce wear and save energy.
    </span>
  </p>
</div>
```

#### 🟠 Orange (Action Needed) - High Short Cycling
**Condition:** `totalShortCycles >= 30` OR `shortCyclePercentage >= 15%`

```jsx
<div className="bg-orange-900/30 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg">
  <p className="text-lg font-semibold text-orange-300">
    🔧 Action needed:
    <span className="font-normal text-orange-200 ml-2">
      Your system is short-cycling frequently. Adjusting your thermostat settings will reduce compressor wear and can save $15-30/year.
    </span>
  </p>
</div>
```

---

## 2. Billboard Key Number Section

**Location:** Replace the current blue recommendation card  
**Purpose:** Make the recommended change unmissable with before/after comparison

### Current State (to be replaced):
```jsx
// Lines 166-210 in AnalysisGraphs.jsx
<div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
  <h4 className="text-base font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
    <Settings size={18} className="text-blue-600" />
    Recommended Differential Settings
  </h4>
  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
    Based on your short cycling patterns, here are the exact recommended settings to reduce short cycles:
  </p>
  // ... current/rec display
</div>
```

### New Billboard Design:

```jsx
{(shortCyclingData.recommendedHeatDifferential !== null || shortCyclingData.recommendedCoolDifferential !== null) && (
  <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border-2 border-blue-400 dark:border-blue-600 shadow-lg">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-blue-600 rounded-lg">
        <Settings size={24} className="text-white" />
      </div>
      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100">
        🔧 Recommended Change
      </h4>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {shortCyclingData.recommendedHeatDifferential !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border-2 border-blue-300 dark:border-blue-600 shadow-md">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Heating Differential
          </p>
          
          {/* Before/After Comparison */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                  {currentHeatDifferential !== null 
                    ? `${currentHeatDifferential.toFixed(1)}°F`
                    : '?'}
                </p>
              </div>
            </div>
            
            <div className="mx-4 text-2xl text-blue-600 dark:text-blue-400 font-bold">
              →
            </div>
            
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended</p>
              <div className="bg-blue-600 rounded-lg p-3 shadow-lg">
                <p className="text-3xl font-bold text-white">
                  {shortCyclingData.recommendedHeatDifferential.toFixed(1)}°F
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            This small change reduces compressor wear and can save <strong className="text-blue-600 dark:text-blue-400">$15-30/year</strong>.
          </p>
        </div>
      )}
      
      {shortCyclingData.recommendedCoolDifferential !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border-2 border-blue-300 dark:border-blue-600 shadow-md">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Cooling Differential
          </p>
          
          {/* Before/After Comparison */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                  {currentCoolDifferential !== null 
                    ? `${currentCoolDifferential.toFixed(1)}°F`
                    : '?'}
                </p>
              </div>
            </div>
            
            <div className="mx-4 text-2xl text-blue-600 dark:text-blue-400 font-bold">
              →
            </div>
            
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended</p>
              <div className="bg-blue-600 rounded-lg p-3 shadow-lg">
                <p className="text-3xl font-bold text-white">
                  {shortCyclingData.recommendedCoolDifferential.toFixed(1)}°F
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            This small change reduces compressor wear and can save <strong className="text-blue-600 dark:text-blue-400">$15-30/year</strong>.
          </p>
        </div>
      )}
    </div>
    
    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-600">
      <p className="text-xs text-blue-800 dark:text-blue-200">
        <strong>How to change:</strong> Go to your ecobee thermostat → <strong>Main Menu → Settings → Installation Settings → Thresholds</strong>
      </p>
    </div>
  </div>
)}
```

**Note:** We'll need to calculate `currentHeatDifferential` and `currentCoolDifferential` from the CSV data. If not available, show "?" and add a note: "We couldn't detect your current setting from the CSV. Check your thermostat to see what it's set to."

---

## 3. Tightened Warning Copy

**Location:** Replace the orange warning card (lines 148-162 in AnalysisGraphs.jsx)

### Current Copy:
```jsx
<p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
  Found {totalShortCycles} short cycle{(totalShortCycles) !== 1 ? 's' : ''} (runtime < {SHORT_CYCLE_THRESHOLD}s)
</p>
```

### New Copy:
```jsx
<div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500 dark:border-orange-600">
  <p className="text-base font-semibold text-orange-900 dark:text-orange-200 mb-2">
    We're seeing a lot of short heating cycles.
  </p>
  <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed">
    That usually means <strong>more wear and slightly higher bills</strong> than necessary. 
    {shortCyclingData.heatShortCycles > 0 && shortCyclingData.coolShortCycles > 0 && (
      <> Found {shortCyclingData.heatShortCycles} heating and {shortCyclingData.coolShortCycles} cooling cycles under {SHORT_CYCLE_THRESHOLD} seconds.</>
    )}
    {shortCyclingData.heatShortCycles > 0 && shortCyclingData.coolShortCycles === 0 && (
      <> Found {shortCyclingData.heatShortCycles} heating cycle{shortCyclingData.heatShortCycles !== 1 ? 's' : ''} under {SHORT_CYCLE_THRESHOLD} seconds.</>
    )}
    {shortCyclingData.heatShortCycles === 0 && shortCyclingData.coolShortCycles > 0 && (
      <> Found {shortCyclingData.coolShortCycles} cooling cycle{shortCyclingData.coolShortCycles !== 1 ? 's' : ''} under {SHORT_CYCLE_THRESHOLD} seconds.</>
    )}
  </p>
</div>
```

---

## 4. Accordion Labels for Technical Sections

**Location:** Wrap technical charts in collapsible `<details>` elements

### Sections to Accordion:

#### A. Runtime per Day Analysis
```jsx
<details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
  <summary className="cursor-pointer p-4 list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Runtime per Day Analysis
        </h3>
      </div>
      <ChevronDown size={20} className="text-gray-400" />
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7">
      For power users: Daily heating/cooling runtime trends
    </p>
  </summary>
  <div className="p-6 pt-0">
    {/* Existing runtime chart code */}
  </div>
</details>
```

#### B. Low Outdoor Temperature Analysis
```jsx
<details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
  <summary className="cursor-pointer p-4 list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <TrendingUp size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Low Outdoor Temperature Analysis
        </h3>
      </div>
      <ChevronDown size={20} className="text-gray-400" />
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7">
      For power users: System performance at cold temperatures
    </p>
  </summary>
  <div className="p-6 pt-0">
    {/* Existing low temp chart code */}
  </div>
</details>
```

#### C. Multi-Run Analysis (if exists)
```jsx
<details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
  <summary className="cursor-pointer p-4 list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Multi-Run Analysis
        </h3>
      </div>
      <ChevronDown size={20} className="text-gray-400" />
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7">
      For technicians: Detailed cycle-by-cycle breakdown
    </p>
  </summary>
  <div className="p-6 pt-0">
    {/* Existing multi-run chart code */}
  </div>
</details>
```

**Keep Visible (No Accordion):**
- ✅ Top Verdict Banner
- ✅ Orange Warning Card
- ✅ Blue Recommendation Billboard
- ✅ Comfort Balance Chart (the colored "X% of hours at 68–72°F" section)

---

## 5. Sticky Summary Sidebar (Optional Enhancement)

**Location:** Right side of the page, sticky as user scrolls  
**Purpose:** Quick reference that stays visible

### Design:

```jsx
{/* Sticky Summary - Only show if short cycling detected */}
{shortCyclingData && shortCyclingData.totalShortCycles > 0 && (
  <div className="hidden lg:block fixed right-4 top-24 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border-2 border-blue-200 dark:border-blue-700 p-5 z-10 max-h-[calc(100vh-8rem)] overflow-y-auto">
    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
      <Home size={20} className="text-blue-600" />
      Quick Summary
    </h3>
    
    {/* System Verdict Badge */}
    <div className={`mb-4 p-3 rounded-lg border-l-4 ${
      totalShortCycles < 10 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
        : totalShortCycles < 30
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
        : 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
    }`}>
      <p className={`text-sm font-semibold ${
        totalShortCycles < 10 
          ? 'text-green-800 dark:text-green-200'
          : totalShortCycles < 30
          ? 'text-yellow-800 dark:text-yellow-200'
          : 'text-orange-800 dark:text-orange-200'
      }`}>
        {totalShortCycles < 10 
          ? '✅ System looks healthy'
          : totalShortCycles < 30
          ? '⚠️ Minor issue detected'
          : '🔧 Action needed'}
      </p>
    </div>
    
    {/* Recommended Changes */}
    {(shortCyclingData.recommendedHeatDifferential !== null || shortCyclingData.recommendedCoolDifferential !== null) && (
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          🔧 Recommended Changes
        </h4>
        <div className="space-y-2">
          {shortCyclingData.recommendedHeatDifferential !== null && (
            <div className="text-sm">
              <p className="text-gray-600 dark:text-gray-400">Heating Differential:</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {shortCyclingData.recommendedHeatDifferential.toFixed(1)}°F
              </p>
            </div>
          )}
          {shortCyclingData.recommendedCoolDifferential !== null && (
            <div className="text-sm">
              <p className="text-gray-600 dark:text-gray-400">Cooling Differential:</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {shortCyclingData.recommendedCoolDifferential.toFixed(1)}°F
              </p>
            </div>
          )}
        </div>
      </div>
    )}
    
    {/* Plain English Link */}
    <button
      onClick={() => {
        // Scroll to or expand "Understanding These Numbers" section
        const element = document.getElementById('understanding-section');
        element?.scrollIntoView({ behavior: 'smooth' });
        // If it's a details element, open it
        if (element?.tagName === 'DETAILS') {
          element.open = true;
        }
      }}
      className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
    >
      💡 Explain in plain English
    </button>
  </div>
)}
```

---

## Implementation Notes

### Data Requirements:

1. **Current Differential Detection:**
   - Try to infer from CSV: Look for consistent differential patterns in `heatDifferentialData`
   - If not available, show "?" and add helper text
   - Could add a manual input: "What's your current differential setting?"

2. **Total Cycles Calculation:**
   - Count all runtime periods (not just short ones)
   - `totalCycles = parsedCsvRows.filter(row => (heatRuntime + coolRuntime + compressorRuntime) > 0).length`
   - `shortCyclePercentage = (totalShortCycles / totalCycles) * 100`

3. **Severity Thresholds:**
   - Green: < 10 cycles OR < 5%
   - Yellow: 10-29 cycles OR 5-14.9%
   - Orange: ≥ 30 cycles OR ≥ 15%

### Copy Tone Guidelines:

- ✅ Use "we" language: "We're seeing..." (collaborative, not accusatory)
- ✅ Focus on outcomes: "more wear and higher bills" (not technical jargon)
- ✅ Be specific with numbers: "$15-30/year" (not "some money")
- ✅ Use plain language: "short heating cycles" (not "sub-optimal runtime periods")
- ✅ Acknowledge uncertainty: "usually means" (not "always means")
- ✅ Action-oriented: "A small thermostat change can help" (not "consider adjusting")

---

## Next Steps

1. ✅ Review and approve this copy
2. Implement in order:
   - Top Verdict Banner (highest impact)
   - Billboard Key Number (high impact)
   - Tightened Warning Copy (quick win)
   - Accordion Technical Sections (cleanup)
   - Sticky Sidebar (nice-to-have)






