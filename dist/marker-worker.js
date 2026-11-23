importScripts('./vendor/jsQR.js');

self.onmessage = ({ data: { pixels, width, height } }) => {
  const code = self.jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
  self.postMessage(code ? { id: code.data, location: code.location } : null);
};
