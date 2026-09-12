/** Browser-evaluated probes return evidence only; the spec owns all acceptance assertions. */
export function isPhotoHarnessReady(): boolean {
  const images = [...document.querySelectorAll<HTMLImageElement>('[data-testid="photo-grid-item-image"]')];
  return images.length === 2
    && images.every((image) => image.complete && image.naturalWidth > 0
      && getComputedStyle(image).opacity === '1')
    && document.fonts.status === 'loaded'
    && document.getAnimations().every((animation) => animation.playState !== 'running');
}

/** Self-contained so Playwright can serialize it for locator.evaluate without module closures. */
export function measurePhotoItem(item: HTMLElement) {
  const badge = item.querySelector<HTMLElement>('[data-testid="photo-grid-item-owner-badge"]');
  const image = item.querySelector<HTMLImageElement>('[data-testid="photo-grid-item-image"]');
  const label = badge?.querySelector('span');
  const icon = badge?.querySelector('svg');
  if (!badge || !image || !label || !icon) throw new Error('Photo item markup is incomplete');
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  if (!context) throw new Error('An sRGB 2D canvas is required for contrast measurement');
  const rgba = (color: string): number[] => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const style = getComputedStyle(badge);
  const labelStyle = getComputedStyle(label);
  const imageStyle = getComputedStyle(image);
  const palette = getComputedStyle(document.documentElement);
  const background = rgba(style.backgroundColor);
  const foreground = rgba(labelStyle.color);
  const palettePink = rgba(palette.getPropertyValue('--color-pink-600').trim());
  const paletteBlue = rgba(palette.getPropertyValue('--color-blue-500').trim());
  context.clearRect(0, 0, 1, 1);
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, 1, 1);
  const pixel = [...context.getImageData(0, 0, 1, 1).data];
  // Source-over the resolved background onto the actual loaded white photo pixel.
  context.fillStyle = style.backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const compositeBackground = [...context.getImageData(0, 0, 1, 1).data];
  context.fillStyle = labelStyle.color;
  context.fillRect(0, 0, 1, 1);
  const compositeForeground = [...context.getImageData(0, 0, 1, 1).data];
  const luminance = (channels: number[]) => {
    const linear = channels.slice(0, 3).map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const first = luminance(compositeBackground);
  const second = luminance(compositeForeground);
  const ancestorOpacities: number[] = [];
  for (let element: Element | null = label; element; element = element.parentElement) {
    ancestorOpacities.push(Number(getComputedStyle(element).opacity));
  }
  const itemRect = item.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  const iconRect = icon.getBoundingClientRect();
  const circle = icon.querySelector('circle');
  return {
    foreground, background, palettePink, paletteBlue, compositeBackground, compositeForeground,
    contrast: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
    ancestorOpacities,
    image: {
      complete: image.complete, naturalSize: [image.naturalWidth, image.naturalHeight],
      renderedSize: [imageRect.width, imageRect.height], pixel,
      opacity: Number(imageStyle.opacity), objectFit: imageStyle.objectFit,
      loading: image.loading, alt: image.alt, isPngDataUrl: image.currentSrc.startsWith('data:image/png;base64,'),
    },
    geometry: {
      itemSize: [itemRect.width, itemRect.height], width: badgeRect.width, height: badgeRect.height,
      offsets: { top: badgeRect.top - itemRect.top, right: itemRect.right - badgeRect.right },
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(parseFloat),
      gap: parseFloat(style.columnGap), iconSize: [iconRect.width, iconRect.height],
      fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight),
      fontWeight: style.fontWeight, radius: parseFloat(style.borderTopLeftRadius),
      display: style.display, alignItems: style.alignItems, labelWidth: label.getBoundingClientRect().width,
    },
    icon: {
      viewBox: icon.getAttribute('viewBox'), fill: icon.getAttribute('fill'),
      stroke: icon.getAttribute('stroke'), strokeWidth: icon.getAttribute('stroke-width'),
      path: icon.querySelector('path')?.getAttribute('d') ?? null,
      circle: ['cx', 'cy', 'r'].map((attribute) => circle?.getAttribute(attribute) ?? null),
    },
  };
}
