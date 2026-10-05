// One function per scene in script.md. Each function draws one frame of its
// scene, and s.t is the time in seconds since the scene started. Give elements
// an `at` time (seconds, a spoken word or "#marker") and the look animates
// them in. The full scene API is in AGENTS.md in the explainroo folder.

export default {
  hook(s) {
    s.title('{{title}}', { y: s.safe.y + s.safe.h * 0.38 });
    s.icon('mouse-pointer-click', { y: s.safe.y + s.safe.h * 0.7, size: 130, at: '#click', color: 'accent' });
  },

  steps(s) {
    // s.safe is the part of the frame that is free for content. Wide videos
    // show the steps side by side, tall ones stack them.
    const tall = s.H > s.W;
    s.text('三個步驟', { font: 'display', size: 76, y: s.safe.y + 50, at: 0 });
    const spots = tall
      ? s.col(3, { y: s.safe.y + s.safe.h * 0.6, height: s.safe.h * 0.66 }).map((y) => ({ x: s.cx, y }))
      : s.row(3, { width: Math.min(1180, s.safe.w - 260) }).map((x) => ({ x, y: s.cy }));
    s.box('找到伺服器', { id: 'find', ...spots[0], icon: 'search', color: 'blue', at: '#one' });
    s.box('要網頁', { id: 'ask', ...spots[1], icon: 'send', color: 'green', at: '#two' });
    s.box('畫出來', { id: 'draw', ...spots[2], icon: 'paintbrush', color: 'purple', at: '#three' });
    s.arrow('find', 'ask', { at: s.cue('接著') - 0.4 });
    s.arrow('ask', 'draw', { at: s.cue('最後') - 0.4 });
  },

  outro(s) {
    s.number(3, { suffix: ' 個步驟', y: s.safe.y + s.safe.h * 0.42, at: 0.2 });
    s.subtitle('比眨眼還快', { at: '#fast', y: s.safe.y + s.safe.h * 0.62 });
  },
};
