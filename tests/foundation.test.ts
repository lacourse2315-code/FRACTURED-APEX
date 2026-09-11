import { describe,expect,it } from 'vitest';
import { FixedStepSimulation } from '../src/core/simulation';
import { developmentContent, validateContent } from '../src/content/content';
import { DevelopmentPlatformProvider } from '../src/platform/platform';
import { createInitialState } from '../src/core/state';
import { SaveRepository, type StorageLike } from '../src/persistence/persistence';
class MemoryStorage implements StorageLike { m=new Map<string,string>(); getItem(k:string){return this.m.get(k)??null} setItem(k:string,v:string){this.m.set(k,v)} removeItem(k:string){this.m.delete(k)} }
describe('simulation',()=>{it('applies deterministic speed multiplier',()=>{const s=new FixedStepSimulation(10);let n=0;s.setSpeed(2);expect(s.advance(25,()=>n++)).toBe(5);expect(n).toBe(5)})});
describe('content',()=>{it('accepts development content',()=>expect(validateContent(developmentContent)).toEqual([]));it('rejects invalid references',()=>expect(validateContent({worlds:[],enemies:[{id:'e',name:'E',worldId:'missing',power:1}]})).toContain('Invalid world reference: e'))});
describe('platform',()=>{it('falls back safely without SDK',()=>expect(new DevelopmentPlatformProvider().capabilities().purchases).toBe(false))});
describe('persistence',()=>{it('persists and recovers previous valid save after corruption',()=>{const mem=new MemoryStorage();const repo=new SaveRepository(mem);const a=createInitialState();a.currencies.shards=7;repo.save(a);const b=structuredClone(a);b.currencies.shards=9;repo.save(b);mem.setItem('fa.save.current','{broken');expect(repo.load().currencies.shards).toBe(7)});it('creates a fresh versioned save when none exists',()=>{const s=new SaveRepository(new MemoryStorage()).load();expect(s.schemaVersion).toBe(1)})});
