# G-Code Editor Web App

A minimalistic, locally-run web application designed to mathematically transform G-Code paths via an intuitive interface. It allows users to quickly scale and offset their G-code shapes, visualize the bounding paths dynamically relative to the origin, and export the modified `.gcode` file.

---

## Brief How-To Guide

1. **Upload**: Click the `UPLOAD G-CODE` button to select a `.gcode`, `.nc`, or `.txt` file containing your paths.
2. **Transform**:
   - Use the **UNIFORM SCALE** checkbox to apply a single scale multiplier across all axes, or uncheck it to scale X, Y, and Z independently.
   - Use the **OFFSET X/Y** fields to shift the model's position relative to the `(0,0)` origin.
3. **Apply**: Press the `Enter` key or click the `APPLY SETTINGS` button to update the mathematical transformation. The interactive canvas will render the exact path geometry, updating the axis lengths dynamically to reflect your changes.
4. **Export**: Once satisfied with the preview, click `EXPORT G-CODE` in the top right to download your transformed file (saved as `[original_name]_modified.gcode`).

---

## Technical Documentation

This section provides an overview of the internal mechanics, architecture, and mathematical transformations running under the hood.

### Architecture
The application runs entirely on the client-side utilizing vanilla HTML, CSS, and JavaScript. There is no backend logic or server dependency, which ensures maximum privacy and execution speed.
- `index.html`: Defines the layout, linking the UI input fields and the HTML5 `<canvas>` environment.
- `style.css`: Contains the CSS variables and styling that enforces the minimalist, monospaced (JetBrains Mono) visual hierarchy.
- `app.js`: Houses the logic for file ingestion (via the FileReader API), parsing algorithms, rendering logic, and file extraction (via the Blob API).

### The Parser Algorithm

When a file is uploaded and `APPLY SETTINGS` is triggered, the string is split into individual lines. The algorithm scans line by line avoiding comments (text trailing behind `;`).

For coordinates (`X`, `Y`, `Z`), a Regular Expression `([XYZ])\s*([-+]?\d*\.?\d+)` captures the dimensional tokens and their respective floating point values.

### Transformation Mathematics

The core logic handles Euclidean affine transformations. Given the scaling matrices $S_x, S_y, S_z$ and the translation vectors $T_x, T_y$, the new coordinates $(x', y', z')$ are mapped using:

$$ x' = x \cdot S_x + T_x $$
$$ y' = y \cdot S_y + T_y $$
$$ z' = z \cdot S_z $$

*Note: There is no Z offset capability currently applied in the engine; $T_z = 0$.*

**Code Implementation:**
```javascript
if (axis === 'X') {
    val = val * scaleX + offsetX;
} else if (axis === 'Y') {
    val = val * scaleY + offsetY;
} else if (axis === 'Z') {
    val = val * scaleZ;
}
```
All outputs are rounded strictly to 3 decimal places using `.toFixed(3)` to adhere to standard CNC / 3D printer floating-point expectations, avoiding sub-micron level instruction bloat.

### Canvas Rendering Engine

The 2D visualizer parses `G0` (Rapid) and `G1` (Extrude / Linear) movement commands to build a continuous path matrix. 
- Relative (`G91`) vs. Absolute (`G90`) state definitions are tracked so that coordinate aggregations resolve properly.
- The path's boundary is extracted (`minX, maxX, minY, maxY`). The origin point `(0,0)` is forcibly injected into these boundaries. By including the origin in the boundary limits, the canvas mathematical scale ensures both the origin axes and the geometry remain within the viewport regardless of extreme offset magnitudes.

**Dynamic Axis Lengths**
Based on the boundaries, the engine renders precise limits visually on the translucent axis lines, drawing max/min markers proportional to the scaled bounds. This provides immediate visual feedback of the exact spatial dimensions post-transformation.
