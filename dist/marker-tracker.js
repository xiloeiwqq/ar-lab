import { estimateMarkerPose } from './marker-pose.js';

const scanInterval = 85;
const lostAfter = 350;
const scanResolution = 540;

export function trackTableMarker(video, onPose, onError) {
  const worker = new Worker(new URL('./marker-worker.js', import.meta.url));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let frame;
  let lastScan = -Infinity;
  let lastVideoTime = -1;
  let lastSeen = -Infinity;
  let scanning = false;
  let trackedId;

  function stop() {
    cancelAnimationFrame(frame);
    worker.terminate();
  }

  worker.onmessage = ({ data }) => {
    scanning = false;
    if (!data || (trackedId !== undefined && trackedId !== data.id)) return;
    const pose = estimateMarkerPose(data.location, canvas.width, canvas.height);
    if (!pose) return;
    trackedId = data.id;
    lastSeen = performance.now();
    onPose(pose);
  };
  worker.onerror = () => {
    stop();
    onError();
  };

  function scan(now) {
    frame = requestAnimationFrame(scan);
    if (Number.isFinite(lastSeen) && now - lastSeen > lostAfter) {
      lastSeen = -Infinity;
      onPose(null);
    }
    if (scanning || now - lastScan < scanInterval || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    const scale = Math.min(1, scanResolution / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    try {
      context.drawImage(video, 0, 0, width, height);
      const { data } = context.getImageData(0, 0, width, height);
      worker.postMessage({ pixels: data, width, height }, [data.buffer]);
      lastScan = now;
      lastVideoTime = video.currentTime;
      scanning = true;
    } catch {
      stop();
      onError();
    }
  }

  frame = requestAnimationFrame(scan);
  return stop;
}
