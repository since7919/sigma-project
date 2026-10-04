const cos45 = Math.cos(Math.PI / 4);
const sin45 = Math.sin(Math.PI / 4);

function rotate(x, y, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    return {
        x: Math.round(50 + (x - 50) * cosA - (y - 50) * sinA),
        y: Math.round(50 + (x - 50) * sinA + (y - 50) * cosA)
    };
}

const pts = {
    // S equivalents (y=103)
    'SW': {x: 39, y: 103, a: 45},
    'SW2': {x: 61, y: 103, a: 45},
    'SE': {x: 39, y: 103, a: -45},
    'SE2': {x: 61, y: 103, a: -45},
    // N equivalents (y=-1)
    'NE': {x: 39, y: -1, a: 45},
    'NE2': {x: 61, y: -1, a: 45},
    'NW': {x: 39, y: -1, a: -45},
    'NW2': {x: 61, y: -1, a: -45}
};

for (const [k, v] of Object.entries(pts)) {
    const r = rotate(v.x, v.y, v.a);
    console.log(`${k}: x=${r.x}, y=${r.y}`);
}
