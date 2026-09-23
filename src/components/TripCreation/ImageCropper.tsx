import React, { useEffect, useMemo, useRef, useState } from 'react';

type ImageCropperProps = {
  file: File;
  aspectRatio?: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const ASPECT_RATIO = 3 / 2;

export const ImageCropper: React.FC<ImageCropperProps> = ({
  file,
  aspectRatio = ASPECT_RATIO,
  onCancel,
  onConfirm,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const viewportSize = useMemo(() => {
    const width = Math.max(0, viewportRef.current?.clientWidth ?? 0);
    return { width, height: width / aspectRatio };
  }, [aspectRatio, src]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const constrainPosition = (x: number, y: number, width: number, height: number) => {
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    if (!vw || !vh) return { x, y };
    return {
      x: Math.min(0, Math.max(vw - width, x)),
      y: Math.min(0, Math.max(vh - height, y)),
    };
  };

  const resetCrop = () => {
    const image = imageRef.current;
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    if (!image || !vw || !vh || !image.naturalWidth || !image.naturalHeight) return;
    const scale = Math.max(vw / image.naturalWidth, vh / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    setBaseScale(scale);
    setImageSize({ width, height });
    setZoom(1);
    setPosition({ x: (vw - width) / 2, y: (vh - height) / 2 });
  };

  useEffect(() => {
    if (!src) return;
    const frame = requestAnimationFrame(resetCrop);
    window.addEventListener('resize', resetCrop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resetCrop);
    };
  }, [src, viewportSize.width, viewportSize.height]);

  const applyZoom = (nextZoom: number) => {
    const clamped = Math.min(3, Math.max(1, nextZoom));
    const image = imageRef.current;
    if (!image || !viewportSize.width || !viewportSize.height) return;
    const oldWidth = imageSize.width || image.naturalWidth * baseScale;
    const oldHeight = imageSize.height || image.naturalHeight * baseScale;
    const newWidth = image.naturalWidth * baseScale * clamped;
    const newHeight = image.naturalHeight * baseScale * clamped;
    const cx = viewportSize.width / 2;
    const cy = viewportSize.height / 2;
    const imageCx = position.x + oldWidth / 2;
    const imageCy = position.y + oldHeight / 2;
    const nextX = cx - (cx - imageCx) * (newWidth / oldWidth) - newWidth / 2;
    const nextY = cy - (cy - imageCy) * (newHeight / oldHeight) - newHeight / 2;
    setZoom(clamped);
    setImageSize({ width: newWidth, height: newHeight });
    setPosition(constrainPosition(nextX, nextY, newWidth, newHeight));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setPosition(constrainPosition(nextX, nextY, imageSize.width, imageSize.height));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  const confirm = async () => {
    const image = imageRef.current;
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    if (!image || !vw || !vh || !image.naturalWidth || !image.naturalHeight) return;

    const displayedScale = imageSize.width / image.naturalWidth;
    const sx = Math.max(0, Math.min(image.naturalWidth, -position.x / displayedScale));
    const sy = Math.max(0, Math.min(image.naturalHeight, -position.y / displayedScale));
    const sw = Math.min(image.naturalWidth - sx, vw / displayedScale);
    const sh = Math.min(image.naturalHeight - sy, vh / displayedScale);

    const maxOutput = 1600;
    const outputWidth = Math.min(maxOutput, Math.max(900, Math.round(sw)));
    const outputHeight = Math.round(outputWidth / aspectRatio);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const drawHeight = sw / aspectRatio;
    ctx.drawImage(image, sx, sy, sw, Math.min(sh, drawHeight), 0, 0, outputWidth, outputHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    const name = file.name.replace(/\.[^/.]+$/, '') + '-cropped.jpg';
    onConfirm(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
  };

  if (!src) return null;

  return (
    <div className="vela-crop-modal" role="dialog" aria-modal="true" aria-label="Crop cover image">
      <div className="vela-crop-card">
        <div className="vela-crop-header">
          <div>
            <strong>Crop cover</strong>
            <span>Drag the image to choose what stays visible</span>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <div
          ref={viewportRef}
          className="vela-crop-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={resetCrop}
            style={{
              width: imageSize.width || 'auto',
              height: imageSize.height || 'auto',
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            }}
          />
          <div className="vela-crop-frame" aria-hidden="true" />
        </div>

        <div className="vela-crop-controls">
          <span>Zoom</span>
          <input
            aria-label="Zoom"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => applyZoom(Number(event.target.value))}
          />
          <button type="button" onClick={() => applyZoom(1)}>Reset</button>
        </div>

        <div className="vela-crop-footer">
          <span>3:2 cover</span>
          <div>
            <button type="button" className="vela-crop-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="vela-crop-primary" onClick={confirm}>Use this crop</button>
          </div>
        </div>
      </div>
    </div>
  );
};
