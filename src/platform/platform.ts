export interface PlatformCapabilities {
  name: string; environment: 'development' | 'standalone' | 'crazygames';
  ads: boolean; purchases: boolean; account: boolean; cloudSave: boolean; mobileAppRestrictions: boolean;
}
export interface PlatformProvider { capabilities(): PlatformCapabilities; }
export class DevelopmentPlatformProvider implements PlatformProvider {
  capabilities(): PlatformCapabilities { return { name:'Development', environment:'development', ads:false, purchases:false, account:false, cloudSave:false, mobileAppRestrictions:false }; }
}
