import { describe, it, expect } from 'vitest'
import { t, towerName, enemyName, targetName } from '../../src/i18n'

describe('i18n', () => {
  it('resolves a dotted key', () => {
    expect(t('panel.upgrade')).toBe('Улучшить')
    expect(t('menu.title')).toBe('TOWER DEFENSE')
  })

  it('interpolates {name} placeholders', () => {
    expect(t('hud.nextWave', { n: 5 })).toBe('Следующая волна через 5 с')
    expect(t('misc.mapIndicator', { i: 2, total: 10 })).toBe('Карта 2/10')
  })

  it('leaves placeholders without a matching param untouched', () => {
    expect(t('hud.waveHeader')).toBe('Волна {n}')
  })

  it('returns the key itself when it is missing', () => {
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('maps tower / enemy / target kinds to display names', () => {
    expect(towerName('tesla')).toBe('Башня Теслы')
    expect(enemyName('boss')).toBe('Босс')
    expect(targetName('strong')).toBe('Сильнейший')
    expect(targetName('unknown')).toBe('unknown') // unknown mode falls back to itself
  })
})
