document.addEventListener("DOMContentLoaded", chalkboard);

// ===== GLOBAL STATE (single source of truth) =====
let currentColor = "#ffffff";
let gridOn = false;
let strokes = [];
let currentStroke = null;
let redoStack = [];

// ===== INFINITE CANVAS =====
function enableInfiniteCanvas(canvas, redrawAll) {

  let cameraX = 0;
  let cameraY = 0;
  let scale = 1;
  let enabled = false;

  function onWheel(e) {
    if (!enabled) return;

    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom
      const zoomIntensity = 0.001;
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      const worldX = cameraX + mouseX / scale;
      const worldY = cameraY + mouseY / scale;

      scale -= e.deltaY * zoomIntensity;
      scale = Math.min(Math.max(0.2, scale), 5);

      cameraX = worldX - mouseX / scale;
      cameraY = worldY - mouseY / scale;

    } else {
      // Pan
      cameraX += e.deltaX / scale;
      cameraY += e.deltaY / scale;
    }

    redrawAll();
  }

  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    enable() { enabled = true; },
    disable() { enabled = false; },
    getCamera() { return { cameraX, cameraY, scale }; }
  };
}

function chalkboard() {

  document.getElementById("chalkboard")?.remove();
  document.querySelector(".chalk")?.remove();
  document.querySelector(".panel")?.remove();

  // ===== CANVAS =====
  const canvas = document.createElement("canvas");
  canvas.id = "chalkboard";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // ===== CAMERA =====
  let infinite;
  function redrawAllWrapper() {
    redrawAll();
  }
  infinite = enableInfiniteCanvas(canvas, redrawAllWrapper);
  infinite.enable();

  let infiniteEnabled = true;

window.toggleInfiniteCanvas = function () {
  infiniteEnabled = !infiniteEnabled;

  if (infiniteEnabled) {
    infinite.enable();
  } else {
    infinite.disable();
  }
};


  function screenToWorld(x, y) {
    const { cameraX, cameraY, scale } = infinite.getCamera();
    return {
      x: cameraX + x / scale,
      y: cameraY + y / scale
    };
  }

  // ===== CHALK CURSOR =====
  const chalk = document.createElement("div");
  chalk.className = "chalk";
  chalk.style.position = "fixed";
  chalk.style.width = "8px";
  chalk.style.height = "8px";
  chalk.style.borderRadius = "50%";
  chalk.style.background = "#fff";
  chalk.style.pointerEvents = "none";
  chalk.style.zIndex = 20;
  document.body.appendChild(chalk);

  const brushDiameter = 7;
  const eraserWidth = 50;
  const eraserHeight = 100;

  let mouseX = 0,
      mouseY = 0,
      mouseDown = false,
      erasing = false,
      xLast = 0,
      yLast = 0;

  // ===== RESIZE =====
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redrawAll();
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ===== GRID =====
  function drawGrid() {
    if (!gridOn) return;

    const size = 100;
    const { cameraX, cameraY, scale } = infinite.getCamera();

    const startX = Math.floor(cameraX / size) * size;
    const endX = cameraX + canvas.width / scale;
    const startY = Math.floor(cameraY / size) * size;
    const endY = cameraY + canvas.height / scale;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;

    for (let x = startX; x < endX; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y < endY; y += size) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ===== REDRAW =====
  function redrawAll() {
    const { cameraX, cameraY, scale } = infinite.getCamera();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, -cameraY * scale);

    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = brushDiameter;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    drawGrid();
  }

  // ===== DRAW =====
  function draw(x, y) {

    ctx.strokeStyle = `rgba(
      ${parseInt(currentColor.slice(1,3),16)},
      ${parseInt(currentColor.slice(3,5),16)},
      ${parseInt(currentColor.slice(5,7),16)},
      ${0.4 + Math.random() * 0.2}
    )`;

    ctx.lineWidth = brushDiameter;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(xLast, yLast);
    ctx.lineTo(x, y);
    ctx.stroke();

    xLast = x;
    yLast = y;

    if (currentStroke) currentStroke.points.push({ x, y });
  }

  // ===== ERASE =====
  function erase(x, y) {
    ctx.fillStyle = "#000";
    ctx.fillRect(
      x - eraserWidth / 2,
      y - eraserHeight / 2,
      eraserWidth,
      eraserHeight
    );
  }

  // ===== INPUT =====
  document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    chalk.style.left = mouseX - 4 + "px";
    chalk.style.top = mouseY - 4 + "px";

    if (!mouseDown) return;

    const world = screenToWorld(mouseX, mouseY);
    erasing ? erase(world.x, world.y) : draw(world.x, world.y);
  });

  document.addEventListener("mousedown", e => {
    mouseDown = true;

    const world = screenToWorld(mouseX, mouseY);
    xLast = world.x;
    yLast = world.y;

    if (e.button === 2) {
      erasing = true;
      erase(xLast, yLast);
      return;
    }

    currentStroke = {
      color: currentColor,
      points: [{ x: xLast, y: yLast }]
    };

    strokes.push(currentStroke);
    redoStack = [];

    draw(xLast + 1, yLast + 1);
  });

  document.addEventListener("mouseup", () => {
    mouseDown = false;
    erasing = false;
    currentStroke = null;
  });

  document.oncontextmenu = () => false;

  // ===== UNDO =====
  function undo() {
    if (!strokes.length) return;
    redoStack.push(strokes.pop());
    redrawAll();
  }

  function exportJSON() {
    const data = { version: 1, strokes };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chalkboard.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.strokes)) return;

        strokes = data.strokes;
        redoStack = [];
        redrawAll();
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      undo();
    }
  });

  // ===== PUBLIC API =====
  window.setColor = c => currentColor = (c === "white" ? "#ffffff" : c);
  window.toggleGrid = () => { gridOn = !gridOn; redrawAll(); };
  window.clearBoard = () => { strokes = []; redoStack = []; redrawAll(); };
  window.undo = undo;
  window.importJSON = file => importJSON(file);
  window.exportJSON = exportJSON;

}
