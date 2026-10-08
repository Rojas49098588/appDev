import type { Account, Combo, Flag, Game } from './models.ts';

// Runtime shape checks for data read back from the on-device cache.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

export function isAccount(v: unknown): v is Account {
  if (!isObject(v)) return false;
  const { shoeSize, height, uniformSizes } = v;
  return (
    isString(v.id) && isString(v.email) && isString(v.firstName) && isString(v.lastName) &&
    isString(v.instrument) && (v.role === 'Member' || v.role === 'Staff') && isString(v.phone) &&
    isString(v.weight) &&
    isObject(shoeSize) && (shoeSize.gender === "Men's" || shoeSize.gender === "Women's") && isString(shoeSize.size) &&
    isObject(height) && isString(height.feet) && isString(height.inches) &&
    isObject(uniformSizes) && isString(uniformSizes.coats) && isString(uniformSizes.vests) &&
    isString(uniformSizes.bibbers) && isString(uniformSizes.pants) &&
    isStringOrNull(v.archivedAt)
  );
}

export const isAccountList = (v: unknown): v is Account[] => Array.isArray(v) && v.every(isAccount);

function isFlag(v: unknown): v is Flag {
  return (
    isObject(v) && isString(v.id) && isString(v.memberId) && isString(v.piece) && isString(v.color) &&
    isString(v.size) && (v.status === 'dirty' || v.status === 'repair') && isString(v.comment)
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

function isGame(v: unknown): v is Game {
  return (
    isObject(v) && isString(v.id) && isString(v.opponent) && isString(v.date) &&
    isStringOrNull(v.preGameComboId) && isStringOrNull(v.halftimeComboId) &&
    isString(v.afterGameInstructions) && isString(v.instructionsPostedBy) && isString(v.instructionsUpdatedAt)
  );
}

export const isGameOrNull = (v: unknown): v is Game | null => v === null || isGame(v);
