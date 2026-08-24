import { useEffect, useMemo, useRef } from 'react';
import { buildThumbnail } from '../render/layers.js';

const W = 260;
const H = 96;

/** World thumbnail with the current viewport drawn on top. Click to jump. */
export function Minimap({ world, viewport, onJump }) {
  const canvasRef = useRef(null);
  const thumb = useMemo(() => buildThumbnail(world, W * 2, H * 2), [world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(thumb, 0, 0, W, H);

    if (!viewport) return;
    // The globe shows a cap, not a rectangle, so the minimap marks where the
    // viewer is standing and how much of the world they can see at once.
    const x = ((viewport.lon + 180) / 360) * W;
    const y = ((90 - viewport.lat) / 180) * H;
    const reach = Math.max(6, Math.acos(1 / viewport.distance) * (W / Math.PI));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    for (const dx of [-W, 0, W]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y, reach, Math.min(H / 2, reach), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }, [thumb, viewport]);

  const jump = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onJump((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H }}
        onPointerDown={jump}
        title="Click to jump"
      />
      <span className="minimap__label">World overview</span>
    </div>
  );
}
