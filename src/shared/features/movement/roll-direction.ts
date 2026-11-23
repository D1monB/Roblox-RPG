// Validates the roll direction a client sends. Pure numbers (not Vector3), so it runs under Lune.

export interface FlatDirection {
	x: number;
	z: number;
}

// The client sends a unit vector. Allow small float error, refuse anything clearly not unit length:
// a long vector must never become a longer roll, a zero vector has no direction.
const MIN_LENGTH = 0.9;
const MAX_LENGTH = 1.1;

function isFiniteNumber(value: number): boolean {
	// NaN fails every comparison, so this also rejects NaN.
	return value > -math.huge && value < math.huge;
}

/**
 * Returns the horizontal unit direction, or undefined if the input is not a sane unit vector.
 * The vertical part is ignored: a roll always moves along the ground.
 */
export function normalizeRollDirection(x: number, y: number, z: number): FlatDirection | undefined {
	if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
		return undefined;
	}
	const fullLength = math.sqrt(x * x + y * y + z * z);
	if (fullLength < MIN_LENGTH || fullLength > MAX_LENGTH) {
		return undefined;
	}
	const flatLength = math.sqrt(x * x + z * z);
	// Mostly vertical: no usable ground direction.
	if (flatLength < 0.5) {
		return undefined;
	}
	return { x: x / flatLength, z: z / flatLength };
}
