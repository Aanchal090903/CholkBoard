export function enableInfiniteCanvas(canvas, redrawAll) {

  let cameraX = 0;
  let cameraY = 0;
  let scale = 1;
  let enabled = false;

  function onWheel(e) {
    if (!enabled) return;

    e.preventDefault();

    // If ctrlKey is true → pinch zoom on trackpad
    if (e.ctrlKey) {
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;
    
      // Convert mouse to world space BEFORE zoom
      const worldX = cameraX + mouseX / scale;
      const worldY = cameraY + mouseY / scale;
    
      // Exponential zoom (smooth + natural)
      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
    
      scale *= zoomFactor;
    
      // Allow deeper zoom out + zoom in
      const MIN_ZOOM = 0.002;
      const MAX_ZOOM = 20;
      scale = Math.min(Math.max(MIN_ZOOM, scale), MAX_ZOOM);
    
      // Reposition camera so cursor stays anchored
      cameraX = worldX - mouseX / scale;
      cameraY = worldY - mouseY / scale;
    }
     else {
      // Two finger scroll = pan
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
