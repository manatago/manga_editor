const fs = require('fs');
let content = fs.readFileSync('/Users/satoshi/mangas/src/renderer/src/components/Canvas.tsx', 'utf8');

const lines = content.split('\n');

// Find start and end exactly based on line numbers and content
let startIndex = -1;
for (let i = 540; i < 560; i++) {
    if (lines[i].includes('<Shape')) {
        startIndex = i;
        break;
    }
}

let endIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].includes('</Group>')) {
        endIndex = i;
        break;
    }
}

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find start or end markers");
    process.exit(1);
}

const newShapeCode = `            {/* Stroke Layer (Behind) */}
            {bubbles.map((bubble, idx) => (
                <Shape
                    key={\`stroke-\${bubble.id || idx}\`}
                    x={bubble.x}
                    y={bubble.y}
                    stroke={borderColor}
                    strokeWidth={(borderWidth !== undefined ? borderWidth : 2) * 2} // Double width to cover inner half
                    lineJoin="round"
                    lineCap="round"
                    opacity={opacity}
                    sceneFunc={(context, shape) => {
                        if (bubble.type === 'rect') drawRectPath(context, bubble, bubble.width, bubble.height)
                        else if (bubble.type === 'jagged') drawJaggedPath(context, bubble, bubble.width, bubble.height)
                        else drawRoundedPath(context, bubble, bubble.width, bubble.height)
                        context.strokeShape(shape)
                    }}
                />
            ))}

            {/* Fill Layer (In Front) */}
            {bubbles.map((bubble, idx) => (
                <Shape
                    key={\`fill-\${bubble.id || idx}\`}
                    x={bubble.x}
                    y={bubble.y}
                    fill={backgroundColor}
                    opacity={opacity}
                    sceneFunc={(context, shape) => {
                        if (bubble.type === 'rect') drawRectPath(context, bubble, bubble.width, bubble.height)
                        else if (bubble.type === 'jagged') drawJaggedPath(context, bubble, bubble.width, bubble.height)
                        else drawRoundedPath(context, bubble, bubble.width, bubble.height)
                        context.fillShape(shape)
                    }}
                />
            ))}`;

lines.splice(startIndex, endIndex - startIndex, newShapeCode);

fs.writeFileSync('/Users/satoshi/mangas/src/renderer/src/components/Canvas.tsx', lines.join('\n'));
console.log("Successfully replaced MergedBubbleGroup!");
