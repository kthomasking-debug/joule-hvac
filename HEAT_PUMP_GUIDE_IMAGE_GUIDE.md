# Heat Pump Guide - Image Addition Guide

## Current Image Location

The frozen heat pump image is currently loaded from an **external Unsplash URL** directly in the component:

```javascript
// Located in: src/pages/HeatPumpGuide.jsx, line ~194
src =
  "https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&h=600&fit=crop&q=80";
```

**Location in code:** `src/pages/HeatPumpGuide.jsx` → `Visual` component → `'frost'` visual type

---

## How to Add Images to the Heat Pump Guide

### Method 1: Using External URLs (Current Method)

**Pros:** Quick, no file management  
**Cons:** Depends on external service, slower loading

1. Find an image URL (e.g., from Unsplash, your CDN, etc.)
2. Add it directly in the `Visual` component:

```javascript
'frost': (
  <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
    <img
      src="https://your-image-url-here.jpg"
      alt="Descriptive alt text"
      className="w-full h-auto max-h-64 object-cover"
      loading="lazy"
    />
  </div>
),
```

---

### Method 2: Using Local Images (Recommended for Production)

**Pros:** Faster, reliable, no external dependencies  
**Cons:** Requires file management

#### Step 1: Download/Save the Image

1. Download your image file (e.g., `frozen-heat-pump.jpg`)
2. Place it in the `public/images/` directory:
   ```
   public/
     images/
       heat-pump-guide/
         frozen-heat-pump.jpg
         defrost-cycle.jpg
         aux-heat-unit.jpg
         (other images...)
   ```

#### Step 2: Reference the Image in the Component

In `src/pages/HeatPumpGuide.jsx`, update the `Visual` component:

```javascript
'frost': (
  <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
    <img
      src="/images/heat-pump-guide/frozen-heat-pump.jpg"
      alt="Frozen heat pump outdoor unit with frost and ice buildup"
      className="w-full h-auto max-h-64 object-cover"
      loading="lazy"
    />
    <div className="p-3 bg-white/5">
      <p className="text-xs text-blue-200 text-center">
        Light frost on the outdoor unit is normal in cold, humid conditions
      </p>
    </div>
  </div>
),
```

**Note:** Images in `public/` are served from the root, so `/images/...` works directly.

---

## Complete Example: Adding a New Visual Image

Let's say you want to add an image for the "defrost cycle" visual:

### Step 1: Add the Image File

```bash
# Place your image at:
public/images/heat-pump-guide/defrost-cycle.jpg
```

### Step 2: Update the Visual Component

Find the `Visual` component in `src/pages/HeatPumpGuide.jsx` (around line 92):

```javascript
const Visual = ({ type }) => {
  const visuals = {
    // ... existing visuals ...

    defrost: (
      <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
        <img
          src="/images/heat-pump-guide/defrost-cycle.jpg"
          alt="Heat pump defrost cycle showing steam and melting ice"
          className="w-full h-auto max-h-64 object-cover rounded-lg"
          loading="lazy"
        />
        <div className="p-3 bg-white/5">
          <p className="text-xs text-blue-200 text-center">
            The defrost cycle automatically melts frost buildup
          </p>
        </div>
      </div>
    ),

    // ... other visuals ...
  };

  return (
    visuals[type] || (
      <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
        Visual
      </div>
    )
  );
};
```

### Step 3: Verify the Image is Used

Check that the question in the `questions` object has the correct `visual` type:

```javascript
'behavior': [
  {
    q: "What's that steam coming from my outdoor unit?",
    a: "That's the defrost cycle! When frost builds up, your system briefly reverses to melt ice...",
    visual: "defrost"  // ← This matches the key in the visuals object
  }
]
```

---

## Image Styling Guidelines

### Standard Image Container

```javascript
<div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
  <img
    src="/images/heat-pump-guide/your-image.jpg"
    alt="Descriptive alt text"
    className="w-full h-auto max-h-64 object-cover"
    loading="lazy"
  />
  {/* Optional caption */}
  <div className="p-3 bg-white/5">
    <p className="text-xs text-blue-200 text-center">Your caption text here</p>
  </div>
</div>
```

### Image Size Recommendations

- **Width:** Let it be responsive (`w-full`)
- **Max Height:** `max-h-64` (256px) works well for most visuals
- **Aspect Ratio:** Use `object-cover` to maintain aspect ratio
- **File Size:** Optimize images to < 200KB for faster loading

### Responsive Considerations

For different screen sizes, you can adjust:

```javascript
className = "w-full h-auto max-h-48 md:max-h-64 lg:max-h-80 object-cover";
```

---

## Current Visual Types

Here are the visual types currently defined in the component:

| Visual Type        | Location             | Current Status                               |
| ------------------ | -------------------- | -------------------------------------------- |
| `temp-compare`     | intro section        | ✅ Custom visualization (bars)               |
| `runtime`          | intro section        | ✅ Custom visualization (bars)               |
| `cost-compare`     | aux-heat section     | ✅ Custom visualization (bars)               |
| `defrost`          | behavior section     | ⚠️ Icon-based (could add image)              |
| `setback-strategy` | efficiency section   | ✅ Custom visualization (icons)              |
| `frost`            | cold-weather section | ✅ **Image from Unsplash**                   |
| `cold-performance` | cold-weather section | ✅ Custom visualization (temperature ranges) |

---

## Best Practices

1. **Alt Text:** Always include descriptive alt text for accessibility
2. **Lazy Loading:** Use `loading="lazy"` for images below the fold
3. **File Naming:** Use descriptive, kebab-case names (e.g., `frozen-heat-pump.jpg`)
4. **Optimization:** Compress images before adding (use tools like TinyPNG)
5. **Consistency:** Keep image styling consistent across all visuals
6. **Fallbacks:** The component has a fallback for missing visuals

---

## Directory Structure

```
public/
  images/
    heat-pump-guide/          ← Create this folder for Heat Pump Guide images
      frozen-heat-pump.jpg
      defrost-cycle.jpg
      aux-heat-unit.jpg
      (other images...)
    welcome/                  ← Existing folder (example)
      (other images...)
```

---

## Quick Reference: Where to Edit

**File:** `src/pages/HeatPumpGuide.jsx`

**Component:** `Visual` (starts around line 92)

**Visual Types Object:** `visuals` (around line 93)

**Questions Object:** `questions` (around line 12) - links visual types to questions

---

## Example: Converting Current Unsplash Image to Local

1. **Download the image:**

   ```bash
   # Navigate to the image URL and save it
   # Or use curl:
   curl -o public/images/heat-pump-guide/frozen-heat-pump.jpg \
     "https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&h=600&fit=crop&q=80"
   ```

2. **Update the component:**

   ```javascript
   // Change from:
   src =
     "https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&h=600&fit=crop&q=80";

   // To:
   src = "/images/heat-pump-guide/frozen-heat-pump.jpg";
   ```

3. **Test:** Run the app and verify the image loads correctly

---

## Troubleshooting

### Image Not Showing?

1. **Check the path:** Images in `public/` should start with `/` (e.g., `/images/...`)
2. **Verify file exists:** Check that the file is actually in `public/images/heat-pump-guide/`
3. **Clear cache:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. **Check console:** Look for 404 errors in browser DevTools

### Image Too Large/Small?

- Adjust `max-h-64` to `max-h-48` (smaller) or `max-h-80` (larger)
- Use `object-contain` instead of `object-cover` to show full image

### Performance Issues?

- Optimize images before adding (compress, resize)
- Use WebP format for better compression
- Consider using `srcset` for responsive images

---

## Summary

**Current Image Location:**

- **Type:** External URL (Unsplash)
- **Code Location:** `src/pages/HeatPumpGuide.jsx`, line ~194
- **Visual Type:** `'frost'` in the `Visual` component

**To Add New Images:**

1. Place images in `public/images/heat-pump-guide/`
2. Reference them as `/images/heat-pump-guide/filename.jpg`
3. Add them to the `visuals` object in the `Visual` component
4. Link them to questions via the `visual` property in the `questions` object
