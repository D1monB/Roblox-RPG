// Fall damage. Pure. Mild by design (docs/movement.md): it punishes careless drops, it never kills.
import { FALL } from "./tuning";

/**
 * Damage for a fall of `height` studs. Capped at FALL.maxDamagePercent of max health, and never
 * more than leaves the player at 1 HP. Bad input (NaN, negative, infinite) deals 0.
 */
export function fallDamage(height: number, maxHealth: number, currentHealth: number): number {
	if (!(height > FALL.safeHeight && height < math.huge)) {
		return 0;
	}
	if (!(maxHealth > 0 && maxHealth < math.huge) || !(currentHealth > 1 && currentHealth < math.huge)) {
		return 0;
	}
	const raw = (height - FALL.safeHeight) * FALL.damagePercentPerStud * maxHealth;
	const capped = math.min(raw, maxHealth * FALL.maxDamagePercent);
	return math.min(capped, currentHealth - 1);
}
