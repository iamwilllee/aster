import config from '@/config/appearance.json'
import { parseAppearance } from './appearance-policy.mjs'
export const appearance = parseAppearance(config)
