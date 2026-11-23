import { control, experiments, findExperiment, links, reagents, unknown } from './chemistry.js';
import { trackTableMarker } from './marker-tracker.js';

const icons = {
  flask: '<path d="M9 3h6m-5 0v7L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 10V3M7.5 15h9"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4-9 5-9-5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13M8 7h7m-7 4h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9.4a2.9 2.9 0 0 1 5.7.6c0 2-2.8 2.4-2.8 4m0 2.7v.1"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3m9-9 4 2.5v5L12 17l-4-2.5v-5L12 7Zm-4 2.5 4 2.5 4-2.5M12 12v5"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  droplet: '<path d="M12 3C9 7.5 6 10 6 14a6 6 0 0 0 12 0c0-4-3-6.5-6-11Zm-3 11a3 3 0 0 0 3 3"/>',
  blend: '<path d="M5 5h14m-7 0v6m-6 2 2 7h8l2-7H6Zm3 3h6"/><path d="M9 8 7 6m8 2 2-2"/>',
  focus: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6m0 6v6h-6m-6 0H3v-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  rotate: '<path d="M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bubbles: '<circle cx="8" cy="15" r="4"/><circle cx="16.5" cy="7" r="3"/><circle cx="17" cy="17" r="1"/>',
  hexagon: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m12 7 4 2.5v5L12 17l-4-2.5v-5L12 7Z"/>',
  observation: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
};
const $ = (id) => document.getElementById(id);
function icon(name, className = '') {
  return `<span class="${className}" data-icon="${name}" aria-hidden="true">${svg(name)}</span>`;
}
function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? ''}</svg>`;
}

document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = svg(node.dataset.icon); });
const library = Object.entries(reagents);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 960px) and (max-height: 540px)');
const storageKey = 'chem-lab-journal-v1';
let selected = [null, null];
let result = null;
let mixing = false;
let mixTimer;
let viewport;
let xrSupport = navigator.xr ? undefined : false;
let xrPlaced = false;
let busyAR = false;
let stream;
let cameraRequest = 0;
let cameraPending = false;
let markerMode = false;
let markerTracking = 'waiting';
let stopTracking;
let resumeCameraAfterXR = false;
let vesselRequest = 0;
let currentPage;

const views = ['lab', 'experiments', 'journal'];
const list = $('reagents');
const stage = $('stage');
const feed = $('camera-feed');
const overlay = $('xr-overlay');
const mobileMenu = $('mobile-menu');
const mobileToggle = $('mobile-toggle');
const mobilePanes = [...document.querySelectorAll('[data-mobile-pane]')];
const mobileControls = [
  ['reagent-panel', 'mobile-bench'],
  ['mix-panel', 'mobile-bench'],
  ['stage-tools', 'mobile-scene'],
  ['stage-controls', 'mobile-scene'],
  ['catalog', 'mobile-experiments'],
  ['journal-list', 'mobile-journal'],
].map(([id, destination]) => {
  const element = $(id);
  const anchor = document.createComment(id);
  element.before(anchor);
  return { element, anchor, destination: $(destination) };
});

function setMobilePane(id) {
  if (id === 'mobile-journal') renderJournal();
  for (const button of mobilePanes) {
    const active = button.dataset.mobilePane === id;
    button.setAttribute('aria-expanded', String(active));
    $(button.dataset.mobilePane).hidden = !active;
  }
  mobileMenu.scrollTop = 0;
}

function setMobileMenu(open, restoreFocus = false) {
  mobileMenu.hidden = !open;
  $('mobile-scrim').hidden = !open;
  mobileToggle.setAttribute('aria-expanded', String(open));
  mobileToggle.querySelector('[data-icon]').innerHTML = svg(open ? 'close' : 'menu');
  mobileToggle.lastElementChild.textContent = open ? 'Закрыть' : 'Меню';
  if (!open) setMobilePane(null);
  if (restoreFocus) mobileToggle.focus({ preventScroll: true });
}

function updateMobileActions() {
  const inLab = currentPage === 'lab';
  $('mobile-lab').hidden = inLab;
  for (const button of mobilePanes) button.hidden = !inLab;
  $('mobile-camera').hidden = !inLab || !feed.hidden;
  $('mobile-camera').disabled = cameraPending;
  $('mobile-result').hidden = !inLab || !result;
  $('mobile-ar').hidden = !inLab || markerMode;
  $('open-ar').hidden = markerMode;
  $('reset-view').hidden = markerMode;
}

function placeMobileControls() {
  for (const { element, anchor, destination } of mobileControls) {
    if (mobileLayout.matches && currentPage === 'lab') {
      if (element.parentNode !== destination) destination.append(element);
    } else if (anchor.nextSibling !== element) {
      anchor.after(element);
    }
  }
}

function updateLayout() {
  placeMobileControls();
  setMobileMenu(false);
  setXRMenu(false);
  updateFullScreenButton();
  updateMobileActions();
}

mobileToggle.addEventListener('click', () => {
  const open = mobileMenu.hidden;
  setMobileMenu(open);
  if (open) mobileMenu.querySelector('.mobile-actions > :not([hidden])')?.focus({ preventScroll: true });
});
$('mobile-scrim').addEventListener('click', () => setMobileMenu(false, true));
for (const button of mobilePanes) {
  button.addEventListener('click', () => {
    setMobilePane($(button.dataset.mobilePane).hidden ? button.dataset.mobilePane : null);
  });
}
for (const link of mobileMenu.querySelectorAll('a')) {
  link.addEventListener('click', () => setMobileMenu(false, true));
}
$('mobile-result').addEventListener('click', () => {
  setMobileMenu(true);
  setMobilePane('mobile-bench');
  $('result').focus({ preventScroll: true });
  $('result').scrollIntoView({ block: 'nearest' });
});
mobileLayout.addEventListener('change', updateLayout);

function badge(reagent) {
  return `<span class="reagent-symbol" style="--tone:${reagent.tone}">${icon(reagent.icon)}</span>`;
}

for (const [id, reagent] of library) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reagent';
  button.dataset.reagent = id;
  button.innerHTML = `${badge(reagent)}<span class="reagent-copy"><span class="reagent-name">${reagent.name}</span><span class="reagent-formula">${reagent.formula}</span></span>${icon('plus', 'reagent-add')}`;
  button.addEventListener('click', () => {
    const index = selected.includes(id) ? selected.indexOf(id) : selected.indexOf(null);
    if (index >= 0) setReagent(index, selected[index] === id ? null : id);
  });
  list.append(button);
}

$('reagent-count').textContent = library.length;
const options = library.map(([key, r]) => `<option value="${key}">${r.name}</option>`).join('');
const xrSelects = selected.map((_, index) => {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Реагент ${index + 1}`);
  select.innerHTML = `<option value="">Реагент ${index + 1}</option>${options}`;
  select.addEventListener('change', () => setReagent(index, select.value || null));
  $('xr-slots').append(select);
  return select;
});

function setReagent(index, id) {
  if (id && selected[1 - index] === id) return;
  selected[index] = id;
  resetMixture();
}
function resetMixture() {
  clearTimeout(mixTimer);
  mixing = false;
  result = null;
  viewport?.setMixture(selected);
  renderBench();
}
function renderBench() {
  const complete = selected.every(Boolean);
  for (const button of list.children) {
    const pressed = selected.includes(button.dataset.reagent);
    button.setAttribute('aria-pressed', pressed);
    button.setAttribute('aria-disabled', complete && !pressed);
    button.querySelector('.reagent-add').innerHTML = svg(pressed ? 'check' : 'plus');
  }
  $('slots').replaceChildren(...selected.map((id, index) => {
    const node = document.createElement(id ? 'button' : 'div');
    node.className = id ? 'slot' : 'slot empty';
    if (id) {
      const reagent = reagents[id];
      node.type = 'button';
      node.innerHTML = `${badge(reagent)}${reagent.name}${icon('close')}`;
      node.setAttribute('aria-label', `Убрать ${reagent.name}`);
      node.addEventListener('click', () => {
        setReagent(index, null);
        list.querySelector(`[data-reagent="${id}"]`)?.focus();
      });
    } else {
      node.innerHTML = `Реагент ${index + 1}${icon('plus')}`;
    }
    return node;
  }));
  xrSelects.forEach((select, index) => {
    select.value = selected[index] ?? '';
    for (const option of select.options) option.disabled = Boolean(option.value) && option.value === selected[1 - index];
  });
  for (const [id, allowed] of [['mix', complete && (!markerMode || hasTablePose())], ['xr-mix', complete && xrPlaced]]) {
    $(id).disabled = !allowed || mixing;
    $(id).innerHTML = `${icon('flask')}${mixing ? 'Смешивание…' : result ? 'Повторить опыт' : 'Смешать реагенты'}`;
  }
  $('result').innerHTML = `<div class="result-label">${icon('observation')}Наблюдения</div>${result ? resultMarkup(result) : `<p class="result-description">${mixing ? 'Наблюдайте за изменениями в колбе.' : 'Здесь появятся результат и описание реакции.'}</p>`}`;
  $('xr-result').textContent = result ? [result.type || result.title, result.equation || result.description].join(' · ') : '';
  updateMobileActions();
}
function resultMarkup(item) {
  return `<h3>${item.type || item.title}</h3>${item.equation ? `<p class="equation">${item.equation}</p>` : ''}<p class="result-description">${item.description}</p>${item.source ? `<a class="result-source" href="${item.source}" target="_blank" rel="noopener noreferrer">Источник опыта</a>` : ''}`;
}
function mix() {
  if (mixing || !selected.every(Boolean) || (markerMode && !hasTablePose())) return;
  const reaction = findExperiment(selected);
  result = null;
  mixing = true;
  if (mobileLayout.matches && overlay.hidden) setMobileMenu(false, true);
  renderBench();
  viewport?.setMixture(selected);
  viewport?.startReaction(reaction);
  mixTimer = setTimeout(() => {
    mixing = false;
    result = reaction ?? unknown;
    if (reaction) record(reaction);
    renderBench();
  }, reducedMotion.matches ? 0 : 950);
}
$('mix').addEventListener('click', mix);
$('xr-mix').addEventListener('click', mix);
renderBench();

function renderCards(id, items) {
  $(id).replaceChildren(...items.map((item) => {
    const card = document.createElement('button');
    card.className = 'experiment-card';
    card.type = 'button';
    card.innerHTML = `<span class="experiment-icon" style="--tone:${item.tone}">${icon(item.icon)}</span><div><h3>${item.title}</h3><p>${item.type}</p></div>${icon('play', 'card-open')}`;
    card.addEventListener('click', () => {
      selected = [...item.pair];
      resetMixture();
      if (location.hash !== '#lab') location.hash = 'lab';
      showPage();
      if (mobileLayout.matches) {
        setMobileMenu(true);
        setMobilePane('mobile-bench');
      }
      $('mix').focus({ preventScroll: true });
      $('mix').scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    });
    return card;
  }));
}
renderCards('quick-experiments', experiments.slice(0, 3));
renderCards('catalog', experiments);

const allExperiments = new Map([...experiments, control].map((item) => [item.id, item]));
let history = [];
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (Array.isArray(stored)) history = stored.filter((item) => allExperiments.has(item?.id) && Number.isFinite(item?.time) && Math.abs(item.time) <= 8.64e15);
} catch { /* The journal still works for the current visit. */ }
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'short', timeStyle: 'short' });
function record(item) {
  history.unshift({ id: item.id, time: Date.now() });
  history = history.slice(0, 50);
  try { localStorage.setItem(storageKey, JSON.stringify(history)); } catch { /* Keep the in-memory entry. */ }
  if (currentPage === 'journal' || (mobileLayout.matches && !$('mobile-journal').hidden)) renderJournal();
}
function renderJournal() {
  $('journal-list').replaceChildren(...history.map(({ id, time }) => {
    const item = allExperiments.get(id);
    const date = new Date(time);
    const entry = document.createElement('article');
    entry.className = 'journal-item';
    entry.innerHTML = `<h3>${item.title}</h3><time datetime="${date.toISOString()}">${dateFormat.format(date)}</time><p>${item.type}${item.equation ? ' · ' + item.equation : ''}</p>`;
    return entry;
  }));
  if (!history.length) $('journal-list').innerHTML = '<div class="journal-empty"><h2>Журнал пока пуст</h2><p>Проведите опыт в лаборатории, чтобы записать результат.</p></div>';
}
function showPage() {
  const hash = location.hash.slice(1);
  const page = views.includes(hash) ? hash : 'lab';
  if (currentPage === page) return;
  if (currentPage === 'lab') closeCamera();
  currentPage = page;
  for (const view of views) $(view).hidden = view !== page;
  placeMobileControls();
  setMobileMenu(false);
  updateMobileActions();
  document.querySelectorAll('[data-nav]').forEach((nav) => {
    if (nav.dataset.nav === page) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  });
  if (page === 'journal') renderJournal();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showPage);
showPage();

document.querySelectorAll('[data-open-help]').forEach((button) => button.addEventListener('click', () => {
  if (mobileMenu.contains(button)) setMobileMenu(false, true);
  $('help').showModal();
}));
$('sources').innerHTML = [
  ['American Chemical Society · газ и осадок', links.gasAndSolid],
  ['American Chemical Society · лимонная кислота', links.citric],
  ['Американское химическое общество · капустный индикатор', links.indicator],
  ['University of Colorado Boulder · карбонат кальция', links.carbonate],
  ['Innerscene · колба Эрленмейера, CC0', links.erlenmeyer],
  ['Innerscene · круглодонная колба, CC0', links.round],
].map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`).join('');

function stageMessage(message) {
  $('stage-status').textContent = message;
  $('stage-live').textContent = message;
}
function hasTablePose() {
  return markerTracking === 'code' || markerTracking === 'surface';
}
function sceneStatus() {
  if (feed.hidden) return '3D-сцена';
  if (markerMode) {
    const messages = {
      waiting: 'Положите QR-код на стол и наведите камеру',
      code: 'Покажите камере детали стола рядом с QR-кодом',
      surface: 'Колба закреплена · её можно перетащить',
      lost: 'Верните в кадр участок стола',
    };
    return messages[markerTracking];
  }
  return 'Камера';
}
async function changeVessel() {
  const request = ++vesselRequest;
  const id = $('vessel').value;
  if (!viewport) return;
  try {
    if (id !== 'simulation') stageMessage('Загрузка модели…');
    await viewport.selectVessel(id, () => request === vesselRequest);
    if (request === vesselRequest) stageMessage(sceneStatus());
  } catch (error) {
    if (request !== vesselRequest) return;
    $('vessel').value = 'simulation';
    await viewport.selectVessel('simulation', () => true);
    stageMessage('Не удалось загрузить модель');
    console.error(error);
  }
}
$('vessel').addEventListener('change', changeVessel);
$('reset-view').addEventListener('click', () => {
  viewport?.resetView();
  if (mobileLayout.matches) setMobileMenu(false, true);
});
$('fullscreen').addEventListener('click', async () => {
  const target = mobileLayout.matches ? document.documentElement : stage;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else if (stage.classList.contains('expanded')) {
    stage.classList.remove('expanded');
    updateFullScreenButton();
  } else {
    try {
      if (!target.requestFullscreen) throw new Error('Fullscreen API unavailable');
      await target.requestFullscreen();
    } catch {
      if (!mobileLayout.matches) {
        stage.classList.add('expanded');
        updateFullScreenButton();
      }
    }
  }
  if (mobileLayout.matches) setMobileMenu(false, true);
});
function updateFullScreenButton() {
  const label = document.fullscreenElement || stage.classList.contains('expanded') ? 'Свернуть сцену' : 'Развернуть сцену';
  $('fullscreen').title = label;
  $('fullscreen').setAttribute('aria-label', label);
  $('fullscreen').hidden = mobileLayout.matches && !document.fullscreenEnabled;
}
document.addEventListener('fullscreenchange', updateFullScreenButton);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || $('help').open) return;
  if (!mobileMenu.hidden) {
    setMobileMenu(false, true);
    return;
  }
  if (stage.classList.contains('expanded')) {
    stage.classList.remove('expanded');
    updateFullScreenButton();
  }
});

function stopMarkerMode() {
  stopTracking?.();
  stopTracking = undefined;
  if (!markerMode) return;
  markerMode = false;
  markerTracking = 'waiting';
  stage.classList.remove('marker-mode');
  viewport?.setMarkerVideo(null);
  renderBench();
}

function activateMarkerTracking() {
  if (!markerMode || feed.hidden || stopTracking) return;
  const failed = () => {
    stopMarkerMode();
    stageMessage('Не удалось запустить отслеживание QR-кода');
  };
  try {
    stopTracking = trackTableMarker(feed, (pose, tracking) => {
      viewport.setMarkerPose(pose);
      const next = tracking ?? (markerTracking === 'surface' ? 'lost' : 'waiting');
      if (markerTracking === next) return;
      markerTracking = next;
      stageMessage(sceneStatus());
      renderBench();
    }, failed);
    viewport.setMarkerVideo(feed);
    stage.classList.add('marker-mode');
    stageMessage(sceneStatus());
  } catch {
    failed();
  }
}

async function startMarkerAR() {
  if (currentPage !== 'lab') return;
  markerMode = true;
  renderBench();
  if (feed.hidden) await showCamera();
  else activateMarkerTracking();
}

function closeCamera() {
  cameraRequest++;
  cameraPending = false;
  for (const track of stream?.getTracks() ?? []) track.stop();
  stream = null;
  feed.srcObject = null;
  feed.hidden = true;
  stopMarkerMode();
  stage.classList.remove('camera-mode');
  $('close-camera').hidden = true;
  stageMessage('3D-сцена');
  updateMobileActions();
}
async function showCamera() {
  if (cameraPending || stream || currentPage !== 'lab') return;
  if (!navigator.mediaDevices?.getUserMedia) {
    stopMarkerMode();
    stageMessage('Камера доступна на HTTPS или localhost');
    return;
  }
  const request = ++cameraRequest;
  cameraPending = true;
  updateMobileActions();
  stageMessage('Включение камеры…');
  try {
    const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (request !== cameraRequest) {
      camera.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = camera;
    feed.srcObject = stream;
    await feed.play();
    if (stream !== camera) return;
    feed.hidden = false;
    stage.classList.add('camera-mode');
    $('close-camera').hidden = false;
    stageMessage(sceneStatus());
    activateMarkerTracking();
    if (document.activeElement === $('mobile-camera')) mobileToggle.focus({ preventScroll: true });
    if (!mobileLayout.matches) stage.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    if (request !== cameraRequest) return;
    closeCamera();
    stageMessage(error.name === 'NotAllowedError' ? 'Нет доступа к камере' : 'Камера недоступна');
  } finally {
    if (request === cameraRequest) {
      cameraPending = false;
      updateMobileActions();
    }
  }
}
$('mobile-camera').addEventListener('click', () => void showCamera());
$('close-camera').addEventListener('click', () => {
  closeCamera();
  if (mobileLayout.matches) setMobileMenu(false, true);
});
window.addEventListener('pagehide', closeCamera);
function setXRMenu(open) {
  $('xr-actions').hidden = mobileLayout.matches && !open;
  $('xr-toggle').setAttribute('aria-expanded', String(open));
  $('xr-toggle').querySelector('[data-icon]').innerHTML = svg(open ? 'close' : 'menu');
  $('xr-toggle').lastElementChild.textContent = open ? 'Закрыть' : 'Меню';
}
$('xr-toggle').addEventListener('click', () => setXRMenu($('xr-actions').hidden));
$('xr-place').addEventListener('click', () => viewport?.requestPlacement());
$('xr-move').addEventListener('click', () => viewport?.moveVessel());
function onXRState(state) {
  xrPlaced = state === 'placed';
  const instructions = {
    scanning: 'Наведите камеру на стол и медленно подвигайте телефоном.',
    ready: 'Поверхность найдена. Поставьте колбу в зелёное кольцо.',
    placed: 'Колба на поверхности. Выберите реагенты и запустите опыт.',
  };
  $('xr-instruction').textContent = instructions[state] ?? '';
  $('xr-place').hidden = state !== 'ready';
  $('xr-move').hidden = !xrPlaced;
  if (state === 'scanning') setXRMenu(false);
  if (state === 'ended') {
    overlay.hidden = true;
    setXRMenu(false);
    if (mobileLayout.matches) mobileToggle.focus({ preventScroll: true });
    if (resumeCameraAfterXR) {
      resumeCameraAfterXR = false;
      void showCamera();
    }
  }
  renderBench();
}
async function openAR() {
  if (busyAR || !overlay.hidden || !viewport || markerMode) return;
  if (mobileLayout.matches) setMobileMenu(false, true);
  busyAR = true;
  try {
    if (xrSupport !== false) {
      const restoreCamera = Boolean(stream) || cameraPending;
      if (restoreCamera) closeCamera();
      overlay.hidden = false;
      onXRState('scanning');
      try {
        await viewport.startXR(overlay, onXRState);
        resumeCameraAfterXR = restoreCamera && !overlay.hidden;
      } catch (error) {
        onXRState('ended');
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          if (restoreCamera) await showCamera();
          stageMessage('Запуск AR не разрешён');
        } else {
          await startMarkerAR();
        }
      }
    } else {
      await startMarkerAR();
    }
  } finally {
    busyAR = false;
  }
}
$('open-ar').addEventListener('click', openAR);
$('mobile-ar').addEventListener('click', openAR);

$('xr-close').addEventListener('click', () => viewport?.endXR());
overlay.addEventListener('beforexrselect', (event) => {
  if (event.target.closest('button, select, .xr-bottom')) event.preventDefault();
});

updateLayout();
if (mobileLayout.matches && currentPage === 'lab') void showCamera();

try {
  const { createViewport } = await import('./viewport.js');
  viewport = createViewport($('canvas-wrap'), stage, reducedMotion);
  viewport.setMixture(selected);
  for (const id of ['open-ar', 'mobile-ar']) $(id).disabled = false;
  if ($('vessel').value !== 'simulation') void changeVessel();
  navigator.xr?.isSessionSupported('immersive-ar').then((supported) => {
    xrSupport = supported;
    if (!feed.hidden) stageMessage(sceneStatus());
  }).catch(() => {});
} catch (error) {
  console.error(error);
  if (feed.hidden && !cameraPending) stageMessage('WebGL недоступен');
  $('stage-error').hidden = false;
  for (const id of ['vessel', 'open-ar', 'mobile-ar', 'reset-view', 'fullscreen']) $(id).disabled = true;
}
