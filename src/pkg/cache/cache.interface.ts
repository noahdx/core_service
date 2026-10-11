export interface ICacheProvider {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<any>;
  del(key: string): Promise<void>;
}
