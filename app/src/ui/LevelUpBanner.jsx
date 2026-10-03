// Окно нового уровня (О3). Вынесено из App.jsx (session 036). Редизайн «Тихий» — session 043:
// единственное «громкое» окно в приложении — крупная цифра уровня и ранг, без конфетти.
// ⚠️ Детект самого level-up остаётся в App (prevLevelRef + mount-окно) — сюда приходит уже готовый факт.
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';

export function LevelUpBanner({ levelUp, levelMax = false, onClose }) {
  if (!levelUp) return null;
  return (
    <div className="anim-fade" style={S.levelUpOverlay} onClick={onClose} role="dialog" aria-label={`Новый уровень ${levelUp.level}`}>
      <div className="anim-levelup" style={{ ...S.levelUpCard, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 13, color: C.dim }}>новый уровень</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: '-.03em', color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{levelUp.level}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 22 }}>{levelUp.rank.icon}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: levelUp.rank.color }}>{levelUp.rank.name}</span>
        </div>
        {levelMax && <div style={{ fontSize: 12.5, color: C.dim }}>Это максимальный уровень</div>}
        <button style={{ ...S.btnPrimary, marginTop: 14, minWidth: 160 }} onClick={onClose}>Продолжить</button>
      </div>
    </div>
  );
}
