const AVATAR_EMOJIS = [
  '\u{1F431}', '\u{1F436}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}',
  '\u{1F98A}', '\u{1F981}', '\u{1F985}', '\u{1F427}', '\u{1F422}',
  '\u{1F419}', '\u{1F98B}', '\u{1F984}', '\u{1F409}', '\u{1F435}',
  '\u{1F43A}', '\u{1F430}', '\u{1F438}', '\u{1F989}', '\u{1F433}'
];

const AVATAR_COLORS = [
  '#e94560', '#ff6b6b', '#ff9800', '#ffcc00',
  '#33cc33', '#00bcd4', '#0099ff', '#9c27b0',
  '#e91e63', '#4caf50', '#ff5722', '#3f51b5',
  '#009688', '#8bc34a', '#ff4081', '#7c4dff',
  '#00e5ff', '#ffc107', '#76ff03', '#f50057'
];

function assignAvatar(existingPlayers) {
  const usedEmojis = new Set();
  const usedColors = new Set();

  for (const p of Object.values(existingPlayers)) {
    if (p.avatar) {
      usedEmojis.add(p.avatar.emoji);
      usedColors.add(p.avatar.color);
    }
  }

  let emoji = AVATAR_EMOJIS.find(e => !usedEmojis.has(e));
  if (!emoji) {
    emoji = AVATAR_EMOJIS[Object.keys(existingPlayers).length % AVATAR_EMOJIS.length];
  }

  let color = AVATAR_COLORS.find(c => !usedColors.has(c));
  if (!color) {
    color = AVATAR_COLORS[Object.keys(existingPlayers).length % AVATAR_COLORS.length];
  }

  return { emoji, color };
}

module.exports = { assignAvatar };
