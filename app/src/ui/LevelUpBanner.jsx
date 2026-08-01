// Баннер нового уровня: оверлей + CSS-салют + карточка ранга. Вынесено из App.jsx (session 036).
// ⚠️ Детект самого level-up остаётся в App (prevLevelRef + mount-окно) — сюда приходит уже готовый факт.
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';

const CONFETTI_COLORS = [C.amber, C.cyan, C.green, C.purple, C.red, '#6FA8DC', '#E0C36B'];
const CONFETTI_COUNT = 36;

export function LevelUpBanner({ levelUp, levelMax = false, onClose }) {
  if (!levelUp) return null;
  return (
    <div style={S.levelUpOverlay} onClick={onClose}>
      <div className="lo-confetti">
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
          <span key={i} className="lo-confetti-piece" style={{
            left: `${(i * 2.8 + 3) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s`,
            transform: `rotate(${i * 40}deg)`, width: i % 3 === 0 ? 9 : 6, height: i % 3 === 0 ? 14 : 9,
          }} />
        ))}
      </div>
      <div className="anim-levelup" style={S.levelUpCard}>
        <div style={{ fontSize: 12, letterSpacing: '.18em', color: C.amber, fontWeight: 700 }}>НОВЫЙ УРОВЕНЬ</div>
        <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, margin: '6px 0', color: C.text, textShadow: `0 0 26px ${C.amber}` }}>{levelUp.level}</div>
        <div style={{ fontSize: 26 }}>{levelUp.rank.icon}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: levelUp.rank.color, marginTop: 2 }}>{levelUp.rank.name}</div>
        {levelMax && <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>Максимальный уровень достигнут 👑</div>}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>нажми, чтобы закрыть</div>
      </div>
    </div>
  );
}
