// routes/live_mem.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// ---- ÉTAT EN MÉMOIRE (pas de DB)
const liveState = new Map(); // key: courseId -> { active, roomName, domain, password, startedAt }

// ---- CONFIG
const SALT = process.env.ITSA_ROOM_SALT || 'itsa-v1-secret';
const DEFAULT_DOMAIN = process.env.JITSI_DOMAIN || 'meet.jit.si';
const DEFAULT_PASSWORD = process.env.DEFAULT_ROOM_PASSWORD || 'ITSA-2025';

function buildRoomName({ courseId, courseSlug }) {
  const base = `ITSA-${(courseSlug || 'course')}-${courseId}`;
  const sig  = crypto.createHash('sha1').update(base + SALT).digest('hex').slice(0, 8);
  return `${base}-${sig}`.replace(/[^a-zA-Z0-9-]/g, '');
}

// ❗ adapte à ton auth
function requireTeacherOrAdmin(req, _res, next) {
  const role = req.user?.role;
  if (!role || !['teacher', 'admin'].includes(role)) return next(Object.assign(new Error('Forbidden'), { status: 403 }));
  next();
}

// --- API statut (poll sur course.ejs)
router.get('/api/courses/:courseId/meeting/status', (req, res) => {
  const { courseId } = req.params;
  const courseSlug = (req.query.courseSlug || '').toString();
  const key = String(courseId);

  let state = liveState.get(key);
  if (!state) {
    state = {
      active: false,
      roomName: buildRoomName({ courseId, courseSlug }),
      domain: DEFAULT_DOMAIN,
      password: DEFAULT_PASSWORD,
      startedAt: null
    };
    liveState.set(key, state);
  }
  res.json({ ...state, url: `https://${state.domain}/${state.roomName}` });
});

// --- Démarrer (prof/admin) depuis course.ejs
router.post('/api/courses/:courseId/meeting/start', requireTeacherOrAdmin, (req, res) => {
  const { courseId } = req.params;
  const courseSlug   = (req.body.courseSlug || '').toString();
  const key = String(courseId);
  const prev = liveState.get(key) || {};

  const state = {
    active: true,
    roomName: prev.roomName || buildRoomName({ courseId, courseSlug }),
    domain: process.env.JITSI_DOMAIN || DEFAULT_DOMAIN,
    password: prev.password || DEFAULT_PASSWORD,
    startedAt: new Date()
  };
  liveState.set(key, state);
  res.json({ ok: true, ...state, url: `https://${state.domain}/${state.roomName}` });
});

// --- Terminer (prof/admin)
router.post('/api/courses/:courseId/meeting/end', requireTeacherOrAdmin, (req, res) => {
  const { courseId } = req.params;
  const key = String(courseId);
  const prev = liveState.get(key);
  if (prev) liveState.set(key, { ...prev, active: false });
  res.json({ ok: true });
});

// --- Vue LIVE dédiée (iframe ici, pas sur course.ejs)
router.get('/courses/:courseId/live', (req, res) => {
  const { courseId } = req.params;
  const courseSlug   = (req.query.courseSlug || '').toString();
  const courseName   = (req.query.courseName || '').toString();

  const key = String(courseId);
  let state = liveState.get(key);
  if (!state) {
    state = {
      active: false,
      roomName: buildRoomName({ courseId, courseSlug }),
      domain: DEFAULT_DOMAIN,
      password: DEFAULT_PASSWORD,
      startedAt: null
    };
    liveState.set(key, state);
  }

  const isTeacher = !!(req.user && (req.user.role === 'teacher' || req.user.role === 'admin'));
  if (!state.active && !isTeacher) {
    // si pas actif et élève => retour au cours
    return res.redirect(`/courses/${encodeURIComponent(courseId)}?live=inactive`);
  }

  res.render('live', {
    courseId,
    courseName,
    courseSlug,
    isTeacher,
    domain: state.domain,
    roomName: state.roomName,
    roomPassword: state.password || null,
    user: req.user || null,
    theme: req.theme || { primaryColor: '#3751FF', secondaryColor: '#232b4d', fontFamily: 'Inter' }
  });
});

module.exports = router;
