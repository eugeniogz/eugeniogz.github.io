const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let mouseX = 0;
let mouseY = 0;

let isTyping = false;
let textCursorX = 0;
let textCursorY = 0;
let lineStartX = 0;

ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

function draw(e) {
    if (!isDrawing) return;
    isTyping = false; // Stop typing when drawing
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);
canvas.addEventListener('mousemove', draw);

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    isTyping = false; // Reset typing sequence on mouse move
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (isTyping) {
            textCursorY += 25; // Line height
            textCursorX = lineStartX;
        }
    } else if (e.key.length === 1) { // Only printable characters
        if (!isTyping) {
            isTyping = true;
            lineStartX = mouseX;
            textCursorX = mouseX;
            textCursorY = mouseY;
        }
        ctx.fillStyle = '#000';
        ctx.font = '20px Roboto, sans-serif';
        ctx.fillText(e.key, textCursorX, textCursorY);
        textCursorX += ctx.measureText(e.key).width;
    }
});

window.addEventListener('resize', () => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.putImageData(imageData, 0, 0);
});
