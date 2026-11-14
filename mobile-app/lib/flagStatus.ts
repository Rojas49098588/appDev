// One color and one icon per flag status, used everywhere, so meaning never
// depends on color alone.

export type StatusKey = 'repair' | 'dirty' | 'good';

export type StatusLook = {
  colorKey: 'rust' | 'wash' | 'good';
  tintKey: 'rustTint' | 'washTint' | null;
  icon: 'wrench' | 'drop' | 'check';
  label: string;
  action: string | null;
};

const LOOKS: Record<StatusKey, StatusLook> = {
  repair: { colorKey: 'rust', tintKey: 'rustTint', icon: 'wrench', label: 'Needs repair', action: 'Flag for repair' },
  dirty: { colorKey: 'wash', tintKey: 'washTint', icon: 'drop', label: 'Dirty', action: 'Flag as dirty' },
  good: { colorKey: 'good', tintKey: null, icon: 'check', label: 'Good', action: null },
};

export function statusLook(status: StatusKey): StatusLook {
  return LOOKS[status];
}

// The flag sheet's submit button: the picked status's color and action, or
// neutral and disabled before anything is picked.
export function submitLook(status: 'repair' | 'dirty' | null): {
  colorKey: 'rust' | 'wash' | 'inkSoft';
  label: string;
  disabled: boolean;
} {
  if (!status) return { colorKey: 'inkSoft', label: 'Submit flag', disabled: true };
  const look = LOOKS[status];
  return { colorKey: look.colorKey as 'rust' | 'wash', label: look.action!, disabled: false };
}
