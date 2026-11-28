// Amis, clans et bannières (voir account.js et supabase/amis_clans_classements.sql).
//  - Amis : on demande un joueur en ami par son pseudo ; il accepte. Les favoris passent en haut.
//    Dès qu'un ami ouvre un monde en multijoueur, son monde apparaît : « Rejoindre », sans code
//    (le jeu le connaît grâce à la présence, voir account.ping).
//  - Clans : un nom, un tag (2 à 4 lettres, montré devant le pseudo en multijoueur), une couleur
//    et une bannière (fond, motif, symbole et leurs couleurs). Le chef invite et exclut ; un joueur
//    invité rejoint depuis l'écran Clan.

// Couleurs des clans et des bannières
export const CLAN_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35490', '#ecf0f1', '#7f8c8d', '#2c3e50', '#17181c'];
export const PATTERNS = ['Uni', 'Bande', 'Pal', 'Diagonale', 'Croix', 'Chevron', 'Bordure', 'Chef', 'Damier', 'Rayures'];
export const SYMBOLS = ['Aucun', 'Hexagone', 'Étoile', 'Cercle', 'Couronne', 'Épée', 'Éclair', 'Arbre', 'Pioche', 'Locomotive', 'Cœur', 'Flamme'];
const color = (i) => CLAN_COLORS[i] || CLAN_COLORS[0];

// Dessine la bannière b ({ bg, pat, pc, sym, sc }) dans le canevas c (une bannière à pointe en bas)
export function drawBanner(c, b = {}) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const x0 = W * 0.08, x1 = W * 0.92, y0 = H * 0.04, y1 = H * 0.8, tip = H * 0.97;
  const shape = () => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.lineTo(W / 2, tip); g.lineTo(x0, y1); g.closePath(); };
  g.save();
  shape();
  g.clip();
  g.fillStyle = color(b.bg | 0);
  g.fillRect(0, 0, W, H);
  g.fillStyle = color(b.pc ?? 8);
  const w = x1 - x0, h = tip - y0, cx = W / 2;
  switch (b.pat | 0) {
    case 1: g.fillRect(0, y0 + h * 0.38, W, h * 0.2); break;                                   // bande
    case 2: g.fillRect(cx - w * 0.14, 0, w * 0.28, H); break;                                   // pal
    case 3: g.beginPath(); g.moveTo(x0, y0 - 5); g.lineTo(x0 + w * 0.3, y0 - 5); g.lineTo(x1 + 5, tip); g.lineTo(x1 - w * 0.3, tip); g.closePath(); g.fill(); break; // diagonale
    case 4: g.fillRect(0, y0 + h * 0.36, W, h * 0.14); g.fillRect(cx - w * 0.09, 0, w * 0.18, H); break; // croix
    case 5: g.beginPath(); g.moveTo(x0, y0 + h * 0.62); g.lineTo(cx, y0 + h * 0.32); g.lineTo(x1, y0 + h * 0.62); g.lineTo(x1, y0 + h * 0.8); g.lineTo(cx, y0 + h * 0.5); g.lineTo(x0, y0 + h * 0.8); g.closePath(); g.fill(); break; // chevron
    case 6: g.lineWidth = w * 0.16; g.strokeStyle = g.fillStyle; shape(); g.stroke(); break;   // bordure
    case 7: g.fillRect(0, 0, W, y0 + h * 0.28); break;                                         // chef (haut)
    case 8: { const s = w / 4; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(x0 + j * s, y0 + i * s, s, s); break; } // damier
    case 9: for (let i = 0; i < 7; i += 2) g.fillRect(x0 + (w / 7) * i, 0, w / 7, H); break;  // rayures
  }
  g.restore();
  // symbole au milieu
  g.fillStyle = g.strokeStyle = color(b.sc ?? 2);
  const r = w * 0.24, sy = y0 + h * 0.42;
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x * r, sy + y * r) : g.moveTo(cx + x * r, sy + y * r))); g.closePath(); g.fill(); };
  switch (b.sym | 0) {
    case 1: poly(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3 + Math.PI / 6), Math.sin((i * Math.PI) / 3 + Math.PI / 6)])); break;
    case 2: poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? 0.45 : 1; return [Math.cos(a) * k, Math.sin(a) * k]; })); break;
    case 3: g.beginPath(); g.arc(cx, sy, r * 0.85, 0, Math.PI * 2); g.fill(); break;
    case 4: poly([[-1, 0.6], [-1, -0.5], [-0.5, 0], [0, -0.8], [0.5, 0], [1, -0.5], [1, 0.6]]); break;
    case 5: poly([[-0.12, -1], [0.12, -1], [0.12, 0.3], [0.5, 0.3], [0.5, 0.45], [0.12, 0.45], [0.12, 0.9], [-0.12, 0.9], [-0.12, 0.45], [-0.5, 0.45], [-0.5, 0.3], [-0.12, 0.3]]); break;
    case 6: poly([[0.2, -1], [-0.55, 0.15], [-0.05, 0.15], [-0.25, 1], [0.55, -0.2], [0.05, -0.2]]); break;
    case 7: poly([[0, -1], [0.7, 0.2], [0.25, 0.2], [0.25, 0.9], [-0.25, 0.9], [-0.25, 0.2], [-0.7, 0.2]]); break;
    case 8: poly([[-0.9, -0.55], [0, -0.95], [0.9, -0.55], [0.12, -0.55], [0.12, 0.95], [-0.12, 0.95], [-0.12, -0.55]]); break;
    case 9: poly([[-1, 0.5], [-1, -0.3], [-0.3, -0.3], [-0.3, -0.7], [0.1, -0.7], [0.1, -0.3], [0.7, -0.3], [1, 0.1], [1, 0.5]]); g.fillStyle = color(b.bg | 0); for (const x of [-0.6, 0, 0.6]) { g.beginPath(); g.arc(cx + x * r, sy + 0.55 * r, r * 0.22, 0, Math.PI * 2); g.fill(); } break;
    case 10: g.beginPath(); g.moveTo(cx, sy + r * 0.9); g.bezierCurveTo(cx - r * 1.4, sy - r * 0.1, cx - r * 0.6, sy - r * 1.1, cx, sy - r * 0.4); g.bezierCurveTo(cx + r * 0.6, sy - r * 1.1, cx + r * 1.4, sy - r * 0.1, cx, sy + r * 0.9); g.fill(); break;
    case 11: g.beginPath(); g.moveTo(cx, sy - r); g.bezierCurveTo(cx + r * 0.9, sy - r * 0.2, cx + r * 0.8, sy + r * 0.9, cx, sy + r * 0.9); g.bezierCurveTo(cx - r * 0.8, sy + r * 0.9, cx - r * 0.9, sy - r * 0.1, cx - r * 0.2, sy - r * 0.4); g.bezierCurveTo(cx - r * 0.1, sy - r * 0.1, cx + r * 0.1, sy - r * 0.5, cx, sy - r); g.fill(); break;
  }
  // contour
  g.lineWidth = Math.max(2, W * 0.03);
  g.strokeStyle = '#0d0e11';
  shape();
  g.stroke();
}
// Petite bannière (pour les listes)
export function bannerEl(b, w = 26) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = Math.round(w * 2.4);
  c.style.width = w + 'px';
  c.style.height = Math.round(w * 1.2) + 'px';
  c.className = 'banner-mini';
  drawBanner(c, b);
  return c;
}
// Tag de clan, coloré : « [HEX] »
export function tagEl(tag, col) {
  const s = document.createElement('b');
  s.className = 'clan-tag';
  s.textContent = '[' + tag + ']';
  s.style.color = color(col);
  return s;
}

// ---------- Écrans Amis et Clan ----------
// ctx : { account, show, toast, ask, COLORS (couleurs des pseudos), joinFriend(ami), back() }
export function initSocial(ctx) {
  const { account, toast, ask, COLORS } = ctx;
  const $ = (id) => document.getElementById(id);
  const pseudoEl = (p, col) => { const s = document.createElement('span'); s.className = 'n'; s.textContent = p; s.style.color = COLORS[col]?.[1] || '#fff'; return s; };
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = 'acc-small ' + cls; b.addEventListener('click', fn); return b; };
  const status = (id, text, ok = false) => { const el = $(id); el.textContent = text || ''; el.classList.toggle('ok', ok); };
  const needLogin = (id) => {
    if (account.loggedIn) return false;
    status(id, account.enabled ? 'Connecte-toi (écran Compte) pour avoir des amis et un clan.' : 'Les comptes en ligne ne sont pas configurés.');
    return true;
  };

  // ----- Amis -----
  let frTimer = 0;
  async function renderFriends() {
    const list = $('fr-list'), reqs = $('fr-requests');
    if (needLogin('fr-status')) { list.textContent = ''; reqs.textContent = ''; return; }
    try {
      const [friends, requests] = await Promise.all([account.friends(), account.friendRequests()]);
      reqs.textContent = '';
      for (const r of requests || []) {
        const row = document.createElement('div');
        row.className = 'social-row';
        row.append(pseudoEl(r.pseudo, r.color));
        const info = document.createElement('span');
        info.className = 'st';
        info.textContent = r.incoming ? 'veut devenir ton ami' : 'demande envoyée';
        row.append(info);
        if (r.incoming) {
          row.append(btn('Accepter', () => act(account.friendAnswer(r.pseudo, true), `${r.pseudo} est maintenant ton ami`)));
          row.append(btn('Refuser', () => act(account.friendAnswer(r.pseudo, false))));
        } else row.append(btn('Annuler', () => act(account.friendRemove(r.pseudo))));
        reqs.appendChild(row);
      }
      list.textContent = '';
      if (!friends?.length) list.innerHTML = '<p class="hint">Pas encore d\'amis : ajoute un joueur avec son pseudo.</p>';
      for (const f of friends || []) {
        const row = document.createElement('div');
        row.className = 'social-row' + (f.host_code ? ' hosting' : f.online ? ' online' : '');
        const star = btn(f.favorite ? '★' : '☆', () => act(account.friendFavorite(f.pseudo, !f.favorite)), 'star' + (f.favorite ? ' on' : ''));
        star.title = f.favorite ? 'Retirer des favoris' : 'Mettre en favori';
        const dot = document.createElement('i');
        dot.className = 'dot' + (f.online ? ' on' : '');
        row.append(star, dot);
        if (f.clan_tag) row.append(tagEl(f.clan_tag, f.clan_color));
        row.append(pseudoEl(f.pseudo, f.color));
        const st = document.createElement('span');
        st.className = 'st';
        st.textContent = f.host_code ? `joue dans « ${f.world || 'son monde'} »${f.locked ? ' (mot de passe)' : ''}` : f.online ? 'en ligne' : lastSeen(f.seen_at);
        row.append(st);
        if (f.host_code) row.append(btn('Rejoindre', () => ctx.joinFriend(f), 'go'));
        row.append(btn('✕', async () => { if (await ask(`Retirer ${f.pseudo} de tes amis ?`, 'Retirer')) act(account.friendRemove(f.pseudo)); }, 'del'));
        list.appendChild(row);
      }
      status('fr-status', '');
    } catch (e) { status('fr-status', e.message); }
  }
  const lastSeen = (at) => {
    if (!at) return 'hors ligne';
    const m = Math.round((Date.now() - new Date(at)) / 60000);
    return m < 60 ? `vu il y a ${Math.max(1, m)} min` : m < 1440 ? `vu il y a ${Math.round(m / 60)} h` : `vu il y a ${Math.round(m / 1440)} j`;
  };
  async function act(p, okText = '') {
    try { await p; if (okText) toast(okText); } catch (e) { toast(e.message); }
    renderFriends();
    if (ctx.screen() === 'clan') renderClan();
  }
  $('fr-add-ok').addEventListener('click', async () => {
    const p = $('fr-add').value.trim();
    if (!p || needLogin('fr-status')) return;
    try {
      const r = await account.friendAdd(p);
      $('fr-add').value = '';
      status('fr-status', r === 'accepted' ? `${p} est maintenant ton ami !` : `Demande envoyée à ${p} : il doit l'accepter dans son écran Amis.`, true);
    } catch (e) { status('fr-status', e.message); }
    renderFriends();
  });
  $('fr-add').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fr-add-ok').click(); });
  $('fr-back').addEventListener('click', () => ctx.back('friends'));

  // ----- Clan -----
  const edit = { color: 0, banner: { bg: 10, pat: 1, pc: 2, sym: 1, sc: 8 } };
  let mine = null;
  function chips(el, cur, onPick) {
    el.textContent = '';
    CLAN_COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === cur ? ' on' : '');
      b.style.background = c;
      b.addEventListener('click', () => onPick(i));
      el.appendChild(b);
    });
  }
  function select(el, names, cur, onPick) {
    if (!el.options.length) for (const [i, n] of names.entries()) el.add(new Option(n, i));
    el.value = cur;
    el.onchange = () => onPick(+el.value);
  }
  function renderEditor() {
    const B = edit.banner, again = () => renderEditor();
    chips($('cl-color'), edit.color, (i) => { edit.color = i; again(); });
    chips($('cl-bg'), B.bg, (i) => { B.bg = i; again(); });
    chips($('cl-pc'), B.pc, (i) => { B.pc = i; again(); });
    chips($('cl-sc'), B.sc, (i) => { B.sc = i; again(); });
    select($('cl-pat'), PATTERNS, B.pat, (i) => { B.pat = i; again(); });
    select($('cl-sym'), SYMBOLS, B.sym, (i) => { B.sym = i; again(); });
    drawBanner($('cl-preview'), B);
    const tag = ($('cl-tag').value || mine?.tag || 'TAG').toUpperCase();
    $('cl-tag-preview').textContent = '[' + tag + ']';
    $('cl-tag-preview').style.color = color(edit.color);
  }
  async function renderClan() {
    const none = $('cl-none'), mineEl = $('cl-mine');
    if (needLogin('cl-status')) { none.hidden = mineEl.hidden = true; $('cl-editor').hidden = true; for (const id of ['cl-create', 'cl-save', 'cl-leave']) $(id).hidden = true; return; }
    try {
      mine = await account.myClan();
      const chef = mine?.role === 'chef';
      none.hidden = !!mine;
      mineEl.hidden = !mine;
      $('cl-editor').hidden = !!mine && !chef;
      $('cl-create').hidden = !!mine;
      $('cl-save').hidden = !chef;
      $('cl-leave').hidden = !mine;
      $('cl-invite-row').hidden = !chef;
      if (mine) {
        edit.color = mine.color | 0;
        Object.assign(edit.banner, mine.banner || {});
        drawBanner($('cl-banner-big'), mine.banner || {});
        const t = $('cl-title');
        t.textContent = '';
        t.append(tagEl(mine.tag, mine.color), ' ' + mine.name);
        $('cl-role').textContent = `${mine.members.length} membre${mine.members.length > 1 ? 's' : ''} — tu es ${chef ? 'le chef' : 'membre'}`;
        const ml = $('cl-members');
        ml.textContent = '';
        for (const m of mine.members) {
          const row = document.createElement('div');
          row.className = 'social-row' + (m.online ? ' online' : '');
          const dot = document.createElement('i');
          dot.className = 'dot' + (m.online ? ' on' : '');
          const st = document.createElement('span');
          st.className = 'st';
          st.textContent = m.role === 'chef' ? 'chef' : 'membre';
          row.append(dot, pseudoEl(m.pseudo, m.color), st);
          if (chef && m.role !== 'chef') row.append(btn('Exclure', async () => { if (await ask(`Exclure ${m.pseudo} du clan ?`, 'Exclure')) clanAct(account.clanKick(m.pseudo)); }, 'del'));
          ml.appendChild(row);
        }
      } else {
        const inv = await account.clanInvites();
        const il = $('cl-invites');
        il.textContent = '';
        if (inv?.length) {
          const h = document.createElement('h4');
          h.className = 'acc-title';
          h.textContent = 'Invitations';
          il.appendChild(h);
        }
        for (const c of inv || []) {
          const row = document.createElement('div');
          row.className = 'social-row';
          const st = document.createElement('span');
          st.className = 'st';
          st.textContent = `${c.members} membre${c.members > 1 ? 's' : ''}`;
          const n = document.createElement('span');
          n.className = 'n';
          n.textContent = c.name;
          row.append(bannerEl(c.banner), tagEl(c.tag, c.color), n, st, btn('Rejoindre', () => clanAct(account.clanJoin(c.id), `Bienvenue dans ${c.name} !`), 'go'), btn('Refuser', () => clanAct(account.clanDecline(c.id))));
          il.appendChild(row);
        }
      }
      renderEditor();
      status('cl-status', '');
    } catch (e) { status('cl-status', e.message); }
  }
  async function clanAct(p, okText = '') {
    try { await p; if (okText) toast(okText); } catch (e) { toast(e.message); }
    await account.clanTag().catch(() => {});
    renderClan();
  }
  $('cl-tag').addEventListener('input', () => { $('cl-tag').value = $('cl-tag').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); renderEditor(); });
  $('cl-create').addEventListener('click', () => {
    const name = $('cl-name').value.trim(), tag = $('cl-tag').value.trim();
    if (name.length < 3) { status('cl-status', 'Nom du clan : 3 à 24 caractères'); return; }
    if (!/^[A-Z0-9]{2,4}$/.test(tag)) { status('cl-status', 'Tag : 2 à 4 lettres ou chiffres'); return; }
    clanAct(account.clanCreate(name, tag, edit.color, edit.banner), `Clan « ${name} » créé !`);
  });
  $('cl-save').addEventListener('click', () => clanAct(account.clanUpdate(edit.color, edit.banner), 'Clan enregistré'));
  $('cl-leave').addEventListener('click', async () => {
    if (!(await ask(mine?.role === 'chef' && mine.members.length > 1 ? 'Quitter le clan ? Le plus ancien membre deviendra chef.' : mine?.members.length === 1 ? 'Quitter le clan ? Tu es le dernier membre : le clan sera supprimé.' : 'Quitter le clan ?', 'Quitter'))) return;
    clanAct(account.clanLeave(), 'Tu as quitté le clan');
  });
  $('cl-invite-ok').addEventListener('click', () => {
    const p = $('cl-invite').value.trim();
    if (!p) return;
    clanAct(account.clanInvite(p), `Invitation envoyée à ${p}`);
    $('cl-invite').value = '';
  });
  $('cl-invite').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('cl-invite-ok').click(); });
  $('cl-back').addEventListener('click', () => ctx.back('clan'));

  return {
    openFriends() { clearInterval(frTimer); renderFriends(); frTimer = setInterval(() => { if (ctx.screen() === 'friends') renderFriends(); else clearInterval(frTimer); }, 8000); },
    openClan() { renderClan(); },
  };
}
