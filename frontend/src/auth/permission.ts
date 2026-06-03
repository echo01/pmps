export function can(permission: string, permissions: string[] = []) {
  return permissions.includes(permission) || permissions.includes('ADMIN');
}

export function canAny(required: string[], permissions: string[] = []) {
  return required.some((permission) => can(permission, permissions));
}
