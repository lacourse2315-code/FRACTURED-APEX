export interface CommerceProvider { isAvailable(): boolean; }
export class DisabledCommerceProvider implements CommerceProvider { isAvailable(): boolean { return false; } }
