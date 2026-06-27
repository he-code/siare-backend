export const roles = ['administrador', 'asistente_actas', 'consulta'] as const;
export type Role = (typeof roles)[number];

export const leaderPositions = ['rector', 'director'] as const;
export type LeaderPosition = (typeof leaderPositions)[number];

export const actStatuses = ['borrador', 'emitida', 'anulada'] as const;
export type ActStatus = (typeof actStatuses)[number];

export const movementTypes = ['entrada', 'salida', 'ajuste', 'anulacion'] as const;
export type MovementType = (typeof movementTypes)[number];
