let currentOriginalGCode = "";
let currentTransformedGCode = "";
let currentFileName = "output.gcode";

const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const applyBtn = document.getElementById('applyBtn');
const exportBtn = document.getElementById('exportBtn');
const lineCountDisplay = document.getElementById('lineCount');
const boundsDisplay = document.getElementById('boundsDisplay');
const uniformScaleCheckbox = document.getElementById('uniformScaleCheckbox');
const scaleRow = document.getElementById('scaleRow');
const scaleXRow = document.getElementById('scaleXRow');
const scaleYRow = document.getElementById('scaleYRow');
const scaleZRow = document.getElementById('scaleZRow');

const scaleInput = document.getElementById('scaleInput');
const scaleXInput = document.getElementById('scaleXInput');
const scaleYInput = document.getElementById('scaleYInput');
const scaleZInput = document.getElementById('scaleZInput');
const offsetXInput = document.getElementById('offsetXInput');
const offsetYInput = document.getElementById('offsetYInput');

uniformScaleCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        scaleRow.classList.remove('hidden');
        scaleXRow.classList.add('hidden');
        scaleYRow.classList.add('hidden');
        scaleZRow.classList.add('hidden');
    } else {
        scaleRow.classList.add('hidden');
        scaleXRow.classList.remove('hidden');
        scaleYRow.classList.remove('hidden');
        scaleZRow.classList.remove('hidden');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !applyBtn.disabled) {
        processGCode();
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentFileName = file.name;
    fileNameDisplay.textContent = currentFileName;

    const reader = new FileReader();
    reader.onload = (event) => {
        currentOriginalGCode = event.target.result;
        processGCode();
        applyBtn.disabled = false;
    };
    reader.readAsText(file);
});

applyBtn.addEventListener('click', () => {
    processGCode();
});

exportBtn.addEventListener('click', () => {
    if (!currentTransformedGCode) return;
    
    const blob = new Blob([currentTransformedGCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    // Append a suffix to the original file name
    let dotIdx = currentFileName.lastIndexOf('.');
    if (dotIdx === -1) dotIdx = currentFileName.length;
    let newName = currentFileName.substring(0, dotIdx) + '_modified' + currentFileName.substring(dotIdx);
    
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

function processGCode() {
    if (!currentOriginalGCode) return;

    let sx = 1.0, sy = 1.0, sz = 1.0;
    if (uniformScaleCheckbox.checked) {
        sx = sy = sz = parseFloat(scaleInput.value);
    } else {
        sx = parseFloat(scaleXInput.value);
        sy = parseFloat(scaleYInput.value);
        sz = parseFloat(scaleZInput.value);
    }

    const offsetX = parseFloat(offsetXInput.value);
    const offsetY = parseFloat(offsetYInput.value);

    // Transform
    currentTransformedGCode = transformGCodeText(currentOriginalGCode, sx, sy, sz, offsetX, offsetY);
    
    // Enable export
    exportBtn.disabled = false;
    
    // Update line count
    const lines = currentTransformedGCode.split(/\r?\n/);
    lineCountDisplay.textContent = lines.length;

    // Render Preview
    const moves = extractPaths(currentTransformedGCode);
    drawPreview(moves);
}

function transformGCodeText(originalText, scaleX, scaleY, scaleZ, offsetX, offsetY) {
    const lines = originalText.split(/\r?\n/);
    const transformedLines = [];
    
    for (let line of lines) {
        let content = line;
        let comment = "";
        let commentIndex = line.indexOf(";");
        
        if (commentIndex !== -1) {
            content = line.substring(0, commentIndex);
            comment = line.substring(commentIndex);
        }
        
        if (content.trim() === "") {
            transformedLines.push(line);
            continue;
        }

        // Replace X, Y, Z values
        let newContent = content.replace(/([XYZ])\s*([-+]?\d*\.?\d+)/gi, (match, axis, valStr) => {
            let val = parseFloat(valStr);
            axis = axis.toUpperCase();
            
            if (axis === 'X') {
                val = val * scaleX + offsetX;
            } else if (axis === 'Y') {
                val = val * scaleY + offsetY;
            } else if (axis === 'Z') {
                val = val * scaleZ; // Removed Z offset
            }
            
            // Format to 3 decimal places
            return `${axis}${val.toFixed(3)}`;
        });
        
        transformedLines.push(newContent + comment);
    }
    
    return transformedLines.join("\n");
}

function extractPaths(gcodeText) {
    const lines = gcodeText.split(/\r?\n/);
    let moves = [];
    
    let currentX = 0;
    let currentY = 0;
    let absoluteMode = true; // Assume absolute by default
    
    for (let line of lines) {
        let content = line.split(';')[0].trim().toUpperCase();
        if (!content) continue;
        
        if (content.includes('G90')) {
            absoluteMode = true;
        } else if (content.includes('G91')) {
            absoluteMode = false;
        }

        let isG0 = /\bG0\b/.test(content);
        let isG1 = /\bG1\b/.test(content);
        
        if (isG0 || isG1) {
            let xMatch = /X\s*([-+]?\d*\.?\d+)/.exec(content);
            let yMatch = /Y\s*([-+]?\d*\.?\d+)/.exec(content);
            
            let dx = xMatch ? parseFloat(xMatch[1]) : 0;
            let dy = yMatch ? parseFloat(yMatch[1]) : 0;
            
            let targetX = xMatch ? (absoluteMode ? dx : currentX + dx) : currentX;
            let targetY = yMatch ? (absoluteMode ? dy : currentY + dy) : currentY;
            
            if (targetX !== currentX || targetY !== currentY) {
                moves.push({
                    type: isG0 ? 'rapid' : 'extrude',
                    x1: currentX,
                    y1: currentY,
                    x2: targetX,
                    y2: targetY
                });
                currentX = targetX;
                currentY = targetY;
            }
        }
    }
    
    return moves;
}

function drawPreview(moves) {
    const canvas = document.getElementById('gcodeCanvas');
    const ctx = canvas.getContext('2d');
    
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (moves.length === 0) {
        boundsDisplay.innerHTML = "N/A";
        return;
    }

    let minX = 0, maxX = 0;
    let minY = 0, maxY = 0;
    
    for (let move of moves) {
        minX = Math.min(minX, move.x1, move.x2);
        maxX = Math.max(maxX, move.x1, move.x2);
        minY = Math.min(minY, move.y1, move.y2);
        maxY = Math.max(maxY, move.y1, move.y2);
    }
    
    let rangeX = maxX - minX;
    let rangeY = maxY - minY;
    
    if (rangeX === 0) rangeX = 1;
    if (rangeY === 0) rangeY = 1;
    
    const margin = 30;
    const scaleX = (canvas.width - margin * 2) / rangeX;
    const scaleY = (canvas.height - margin * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);
    
    const cx = (canvas.width - rangeX * scale) / 2;
    const cy = (canvas.height - rangeY * scale) / 2;
    
    boundsDisplay.innerHTML = `X: ${minX.toFixed(2)} to ${maxX.toFixed(2)}<br>Y: ${minY.toFixed(2)} to ${maxY.toFixed(2)}`;
    
    // Draw Origin axes
    const originX = cx + (0 - minX) * scale;
    const originY = canvas.height - (cy + (0 - minY) * scale);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Faint white line for axes
    
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    ctx.stroke();

    // Draw Origin Point
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(originX, originY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText("(0,0)", originX + 8, originY - 8);

    // Draw dynamic lengths on the axes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // A bit transparent
    ctx.font = "10px 'JetBrains Mono', monospace";
    
    // For X axis
    if (originY >= 0 && originY <= canvas.height) {
        // Draw Max X
        let pxMaxX = cx + (maxX - minX) * scale;
        ctx.fillRect(pxMaxX, originY - 4, 1, 8);
        ctx.fillText(`X:${maxX.toFixed(1)}`, pxMaxX + 4, originY - 10);
        
        // Draw Min X
        if (minX < 0) {
            let pxMinX = cx + (minX - minX) * scale; // which is cx
            ctx.fillRect(pxMinX, originY - 4, 1, 8);
            ctx.fillText(`X:${minX.toFixed(1)}`, pxMinX + 4, originY - 10);
        }
    }
    
    // For Y axis
    if (originX >= 0 && originX <= canvas.width) {
        // Draw Max Y
        let pyMaxY = canvas.height - (cy + (maxY - minY) * scale);
        ctx.fillRect(originX - 4, pyMaxY, 8, 1);
        ctx.fillText(`Y:${maxY.toFixed(1)}`, originX + 10, pyMaxY + 4);
        
        // Draw Min Y
        if (minY < 0) {
            let pyMinY = canvas.height - (cy + (minY - minY) * scale); // canvas.height - cy
            ctx.fillRect(originX - 4, pyMinY, 8, 1);
            ctx.fillText(`Y:${minY.toFixed(1)}`, originX + 10, pyMinY + 4);
        }
    }
    
    ctx.lineWidth = 1.5;
    
    for (let move of moves) {
        ctx.beginPath();
        
        let px1 = cx + (move.x1 - minX) * scale;
        let py1 = canvas.height - (cy + (move.y1 - minY) * scale);
        let px2 = cx + (move.x2 - minX) * scale;
        let py2 = canvas.height - (cy + (move.y2 - minY) * scale);
        
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        
        if (move.type === 'rapid') {
            ctx.strokeStyle = '#333333';
        } else {
            ctx.strokeStyle = '#ff6600';
        }
        ctx.stroke();
    }
}

// Handle window resize to redraw canvas
window.addEventListener('resize', () => {
    if (currentTransformedGCode) {
        const moves = extractPaths(currentTransformedGCode);
        drawPreview(moves);
    }
});
