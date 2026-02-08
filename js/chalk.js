document.addEventListener("DOMContentLoaded", chalkboard);

// ===== GLOBAL STATE (single source of truth) =====
let currentColor = "#ffffff";
let gridOn = false;
let strokes = [];
let currentStroke = null;
let redoStack = [];

function chalkboard() {
  // Clean slate
  document.getElementById("chalkboard")?.remove();
  document.querySelector(".chalk")?.remove();
  document.querySelector(".panel")?.remove();

  // ===== CANVAS =====
  const canvas = document.createElement("canvas");
  canvas.id = "chalkboard";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

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

  // ===== CONSTANTS =====
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
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    const size = 100;

    for (let x = 0; x < canvas.width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ===== REDRAW ENGINE =====
  function redrawAll() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    const dist = Math.hypot(x - xLast, y - yLast);
    const steps = dist / 2;
    const dx = (x - xLast) / steps;
    const dy = (y - yLast) / steps;

    ctx.fillStyle = "#000";
    for (let i = 0; i < steps; i++) {
      ctx.fillRect(
        xLast + dx * i + (Math.random() - 0.5) * brushDiameter,
        yLast + dy * i + (Math.random() - 0.5) * brushDiameter,
        Math.random() * 2 + 1,
        Math.random() * 2
      );
    }

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

    if (mouseDown) erasing ? erase(mouseX, mouseY) : draw(mouseX, mouseY);
  });

  document.addEventListener("mousedown", e => {
    mouseDown = true;
    xLast = mouseX;
    yLast = mouseY;

    if (e.button === 2) {
      erasing = true;
      erase(mouseX, mouseY);
      return;
    }

    currentStroke = {
      color: currentColor,
      points: [{ x: mouseX, y: mouseY }]
    };

    strokes.push(currentStroke);
    redoStack = []; // invalidate redo
    draw(mouseX + 1, mouseY + 1);
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
    const data = {
      version: 1,
      strokes
    };
  
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
  
  

  // Ctrl + Z / Cmd + Z
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
