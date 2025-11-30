// routes/live_mem.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// ---- ÉTAT EN MÉMOIRE (pas de DB)
const liveState = new Map(); // key: courseId -> { active, roomName, domain, password, startedAt }

// ---- CONFIG
/* const SALT = process.env.ITSA_ROOM_SALT || 'itsa-v1-secret';
const DEFAULT_DOMAIN = process.env.JITSI_DOMAIN || 'meet.jit.si';
const DEFAULT_PASSWORD = process.env.DEFAULT_ROOM_PASSWORD || 'ITSA-2025';

function buildRoomName({ courseId, courseSlug }) {
  const base = `ITSA-${(courseSlug || 'course')}-${courseId}`;
  const sig  = crypto.createHash('sha1').update(base + SALT).digest('hex').slice(0, 8);
  return `${base}-${sig}`.replace(/[^a-zA-Z0-9-]/g, '');
} */


// ---- CONFIG
const SALT = process.env.ITSA_ROOM_SALT || 'itsa-v1-secret';

// ⚠️ JaaS : tenant + domaine
const JITSI_TENANT = process.env.JITSI_TENANT 
  || 'vpaas-magic-cookie-431094973c904d04b9310cd0cf6e5b20';

const DEFAULT_DOMAIN = process.env.JITSI_DOMAIN || '8x8.vc';
const DEFAULT_PASSWORD = process.env.DEFAULT_ROOM_PASSWORD || 'ITSA-2025';

// Pour JaaS, le roomName doit être "tenant/slug"
function buildRoomName({ courseId, courseSlug }) {
  const slugBase = `ITSA-${(courseSlug || 'course')}-${courseId}`;
  const sig      = crypto.createHash('sha1')
                    .update(slugBase + SALT)
                    .digest('hex')
                    .slice(0, 8);

  const cleanSlug = `${slugBase}-${sig}`.replace(/[^a-zA-Z0-9-]/g, '');

  // ⚠️ On garde bien le slash pour le tenant
  return `${JITSI_TENANT}/${cleanSlug}`;
}




// ❗ adapte à ton auth
function requireTeacherOrAdmin(req, _res, next) {
  const role = req.user?.role;
  if (!role || role !== 'teacher' || role !== 'admin') return next(Object.assign(new Error('Forbidden'), { status: 403 }));
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
router.post('/api/courses/:courseId/meeting/start', (req, res) => {
  console.log("ca va check les params live");
  const { courseId } = req.params;
  const courseSlug   = (req.body.courseSlug || 'imagine').toString();
  const key = String(courseId);
  const prev = liveState.get(key) || {};
  console.log("okay live l53");

  const state = {
    active: true,
    roomName: prev.roomName || buildRoomName({ courseId, courseSlug }),
    domain: process.env.JITSI_DOMAIN || DEFAULT_DOMAIN,
    password: prev.password || DEFAULT_PASSWORD,
    startedAt: new Date()
  };
  liveState.set(key, state);
  res.json({ ok: true, ...state, url: `https://${state.domain}/${state.roomName}`, user:req.session.user });
});

// --- Terminer (prof/admin)
router.post('/api/courses/:courseId/meeting/end', (req, res) => {
  const { courseId } = req.params;
  const key = String(courseId);
  const prev = liveState.get(key);
  if (prev) liveState.set(key, { ...prev, active: false });
  res.json({ ok: true });
});

// --- Vue LIVE dédiée (iframe ici, pas sur course.ejs)
router.get('/courses/:courseId/live', (req, res) => {
  console.log("ca a trer");
  const { courseId } = req.params;
  const courseSlug   = (req.query.courseSlug || '').toString();
  const courseName   = (req.query.courseName || '').toString();

  console.log("ca a trer2");
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

  const isTeacher = req.user && (req.user.role === 'teacher' || req.user.role === 'admin');
  console.log(isTeacher)
  if (!state.active && !isTeacher) {
    // si pas actif et élève => retour au cours
    return res.redirect(`/courses/${encodeURIComponent(courseId)}?live=inactive`);
  }else{
    console.log("haaan merci")
  }

  res.render('live', {
    courseId,
    courseName,
    courseSlug,
    isTeacher,
    domain: state.domain,
    roomName: state.roomName,
    roomPassword: state.password || null,
    user: req.session.user || null,
    //theme: req.theme || { primaryColor: '#3751FF', secondaryColor: '#232b4d', fontFamily: 'Inter' }
  });
});

module.exports = router;
