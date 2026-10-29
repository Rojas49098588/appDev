import type { Account, Combo, Flag, Game, InventoryPiece, PieceType, PoloColorOption } from './models.ts';

// Runtime shape checks for data read back from the on-device cache.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

export function isAccount(v: unknown): v is Account {
  if (!isObject(v)) return false;
  const { shoeSize, height, numbers } = v;
  return (
    isString(v.id) && isString(v.email) && isString(v.firstName) && isString(v.lastName) &&
    isString(v.instrument) && (v.role === 'Member' || v.role === 'Staff') && isString(v.phone) &&
    isString(v.weight) &&
    isObject(shoeSize) && (shoeSize.gender === "Men's" || shoeSize.gender === "Women's") && isString(shoeSize.size) &&
    isObject(height) && isString(height.feet) && isString(height.inches) &&
    isObject(numbers) && Object.values(numbers).every(isString) && v.uniformSizes === undefined &&
    isStringOrNull(v.archivedAt)
  );
}

export const isAccountList = (v: unknown): v is Account[] => Array.isArray(v) && v.every(isAccount);

function isFlag(v: unknown): v is Flag {
  return (
    isObject(v) && isString(v.id) && isStringOrNull(v.memberId) && isString(v.piece) && isString(v.color) &&
    isString(v.size) && (v.status === 'dirty' || v.status === 'repair') && isString(v.comment) &&
    isString(v.createdAt) && isString(v.memberName) && isStringOrNull(v.photoPath) && isOptionalString(v.photoUrl) &&
    isString(v.staffNote) && (v.source === 'member' || v.source === 'import') &&
    isStringOrNull(v.clearedAt) && isStringOrNull(v.clearedByName)
  );
}

export const isFlagList = (v: unknown): v is Flag[] => Array.isArray(v) && v.every(isFlag);

function isCombo(v: unknown): v is Combo {
  return (
    isObject(v) && isString(v.id) && isString(v.label) && isString(v.sub) &&
    (v.components === undefined || (Array.isArray(v.components) && v.components.every(isString))) &&
    isOptionalString(v.imagePath) && isOptionalString(v.image)
  );
}

export const isComboList = (v: unknown): v is Combo[] => Array.isArray(v) && v.every(isCombo);

const isPoloColor = (v: unknown): boolean => isObject(v) && isString(v.name) && isString(v.swatch);

function isGame(v: unknown): v is Game {
  return (
    isObject(v) && isString(v.id) &&
    (v.sport === 'football' || v.sport === 'basketball' || v.sport === 'volleyball') &&
    (v.division === null || v.division === 'mens' || v.division === 'womens') &&
    (v.status === 'draft' || v.status === 'ready') &&
    isString(v.opponent) && isStringOrNull(v.gameDate) && isStringOrNull(v.kickoffTime) &&
    isStringOrNull(v.callTime) && typeof v.noCallTime === 'boolean' &&
    Array.isArray(v.polo) && v.polo.every(isPoloColor) && isString(v.poloNote) &&
    (v.groupNumber === null || typeof v.groupNumber === 'number') &&
    isStringOrNull(v.preGameComboId) && isStringOrNull(v.halftimeComboId) &&
    isString(v.afterGameInstructions) && isString(v.instructionsPostedBy) && isString(v.instructionsUpdatedAt)
  );
}

export const isGameList = (v: unknown): v is Game[] => Array.isArray(v) && v.every(isGame);

function isPoloColorOption(v: unknown): v is PoloColorOption {
  return isObject(v) && isString(v.id) && isString(v.name) && isString(v.swatch) && typeof v.sortOrder === 'number';
}

export const isPoloColorList = (v: unknown): v is PoloColorOption[] => Array.isArray(v) && v.every(isPoloColorOption);

function isPieceType(v: unknown): v is PieceType {
  return (
    isObject(v) && isString(v.id) && isString(v.name) && (v.kind === 'numbered' || v.kind === 'counted') &&
    Array.isArray(v.colors) && v.colors.every(isString) &&
    isObject(v.stock) && Object.values(v.stock).every((n) => typeof n === 'number') &&
    typeof v.sortOrder === 'number' && typeof v.retired === 'boolean'
  );
}

export const isPieceTypeList = (v: unknown): v is PieceType[] => Array.isArray(v) && v.every(isPieceType);

function isPiece(v: unknown): v is InventoryPiece {
  return (
    isObject(v) && isString(v.id) && isString(v.pieceTypeId) && isString(v.pieceType) && isString(v.color) &&
    isString(v.number) && typeof v.outForRepair === 'boolean'
  );
}

export const isPieceList = (v: unknown): v is InventoryPiece[] => Array.isArray(v) && v.every(isPiece);
