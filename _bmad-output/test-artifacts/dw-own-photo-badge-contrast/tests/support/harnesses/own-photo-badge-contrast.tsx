import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PhotoGridItem } from '../../../src/components/PhotoGallery/PhotoGridItem';
import '../../../src/index.css';
import { createWhitePhotoFixture } from '../factories/own-photo-badge';

const photos = [createWhitePhotoFixture(true), createWhitePhotoFixture(false)];

export function OwnPhotoBadgeHarness() {
  const [calls, setCalls] = useState<string[]>([]);
  return (
    <main aria-label="Photo badge harness" style={{ padding: 64 }}>
      <div style={{ display: 'flex', gap: 32 }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ width: 240, flexShrink: 0 }}>
            <PhotoGridItem photo={photo} onPhotoClick={(id) => setCalls((previous) => [...previous, id])} />
          </div>
        ))}
      </div>
      <output aria-label="Selected photo IDs">{JSON.stringify(calls)}</output>
    </main>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('The photo badge harness root is missing');
createRoot(container).render(<OwnPhotoBadgeHarness />);
