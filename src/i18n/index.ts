import type { TowerKind } from '../towers/TowerTypes'
import type { EnemyKind } from '../enemies/EnemyTypes'

// Central i18n module. Every user-facing string lives here so the UI code never
// hardcodes text. Strings support {name}-style placeholders filled by t()/format().
// Only Russian ('ru') is populated today; add a locale by cloning the `ru` object.

export type Locale = 'ru'
export type Params = Record<string, string | number>

const STRINGS = {
  ru: {
    // tower display names (shown in build menu and tower panel)
    tower: {
      cannon: 'Пушка',
      slow: 'Ледяная башня',
      sniper: 'Снайперская башня',
      mortar: 'Мортира',
      tesla: 'Башня Теслы',
    } satisfies Record<TowerKind, string>,

    // enemy display names (wave preview)
    enemy: {
      normal: 'Обычные',
      fast: 'Быстрые',
      tank: 'Тяжёлые',
      rogue: 'Разбойники',
      brute: 'Громилы',
      healer: 'Целители',
      boss: 'Босс',
    } satisfies Record<EnemyKind, string>,

    // tower targeting modes
    target: {
      first: 'Первый',
      last: 'Последний',
      strong: 'Сильнейший',
      weak: 'Слабейший',
    } as Record<string, string>,

    // top-left stats card + pause/wave previews
    hud: {
      pause: '⏸ ПАУЗА',
      wave: '🌊 Волна',
      respawn: 'Возрождение...',
      waveHeader: 'Волна {n}',
      nextWave: 'Следующая волна через {n} с',
      startNow: 'Enter — начать сейчас',
      pressEnter: 'Нажмите Enter для начала',
      victory: 'ПОБЕДА',
      defeat: 'ПОРАЖЕНИЕ',
    },

    // selected-tower panel
    panel: {
      upgrade: 'Улучшить',
      sell: 'Продать',
      target: 'Цель:',
      slow: 'Замедление:',
      ignoreArmor: 'Игнор брони:',
      damage: 'Урон:',
      range: 'Дальность:',
      fireRate: 'Скорость атаки:',
      max: 'МАКС.',
      level: 'ур.{n}',
    },

    // settings panel
    settings: {
      title: '⚙ Настройки',
      gearTitle: 'Настройки',
      master: 'Общая громкость',
      music: 'Музыка',
      sfx: 'Звуковые эффекты',
      mute: 'Без звука',
      graphics: 'Графика',
      low: 'Низкое',
      med: 'Среднее',
      high: 'Высокое',
    },

    // title / end screens
    menu: {
      loading: 'Загрузка...',
      title: 'TOWER DEFENSE',
      subtitle: 'Защити крепость и переживи все волны врагов',
      play: 'Играть',
      playAgain: 'Играть снова',
    },

    // transient toasts
    msg: {
      noGold: 'Недостаточно золота',
      earlyBonus: '+{bonus} золота за досрочный вызов волны',
      cellOccupied: 'Место занято',
      mapTest: 'Карта {i} (тест)',
    },

    // control legend (top-right) + build banner
    legend: {
      build: 'Выберите башню и нажмите на клетку для строительства',
      tower: 'Нажмите на башню, чтобы улучшить или продать её',
      hero: 'Без выбранной башни: ЛКМ — атака героя, WASD — движение',
      speed: 'Пробел — пауза · 1×/2×/3× — скорость · Enter — вызвать волну',
      camera: 'Tab — камера · Q/E — поворот · M — звук',
    },

    misc: {
      mapIndicator: 'Карта {i}/{total}',
      buildBanner: 'СТРОИТЕЛЬСТВО: {tower} ({cost} золота) · ЛКМ — построить · ПКМ/Esc — отмена · Shift — серия построек',
    },
  },
}

let locale: Locale = 'ru'
export function setLocale(l: Locale) { locale = l }
export function getLocale(): Locale { return locale }

function interpolate(s: string, params?: Params): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`))
}

// dotted-path lookup into the active locale, e.g. t('panel.upgrade')
export function t(key: string, params?: Params): string {
  const parts = key.split('.')
  let node: unknown = STRINGS[locale]
  for (const p of parts) {
    if (node && typeof node === 'object' && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p]
    } else {
      return key // missing key: surface it instead of crashing
    }
  }
  return typeof node === 'string' ? interpolate(node, params) : key
}

// typed helpers for the kind-keyed name maps
export const towerName = (k: TowerKind): string => STRINGS[locale].tower[k]
export const enemyName = (k: EnemyKind): string => STRINGS[locale].enemy[k]
export const targetName = (mode: string): string => STRINGS[locale].target[mode] ?? mode
