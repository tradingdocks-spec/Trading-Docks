import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChaosCommitItem, chaosCommitClaim } from '../src/lib/chaos-sort/trusted-commit.ts';
import type { CanonicalPrinting } from '../src/lib/card-intelligence/types.ts';
const printing: CanonicalPrinting = { printingId:'printing',canonicalCardId:'canonical',game:'magic',name:'Fixture',setCode:'tst',setName:'Test',collectorNumber:'1',language:'en',finishes:['nonfoil'],providerIds:{scryfall:'printing'},identityAuthority:'provider_confirmed',provenance:['scryfall'],rarity:null,imageUrl:null,prices:[] };
const provider = { id:'fixture-existing-provider-contract',printing:async(id:string)=>id==='printing'?printing:null, search:async()=>[] };
const item = { quantity:1,humanState:'confirmed',processingState:'ready',recognitionState:'high_confidence',scryfallId:'printing',gameId:'magic',cardName:'Fixture',setCode:'tst',collectorNumber:'1',condition:'NM',finish:'normal',language:'English' };
test('trusted provider identity and user-observed condition remain separate',async()=>{
 const result=await validateChaosCommitItem(item,provider);
 assert.equal(result.finish,'nonfoil'); assert.equal(result.language,'en');
 assert.equal((result.trustedValidation as Record<string,unknown>).condition,'USER_OBSERVED');
 assert.equal((await validateChaosCommitItem({...item,finish:null},provider)).finish,'nonfoil');
});
for (const [name,change] of Object.entries({ finish:{finish:'foil'},set:{setCode:'wrong'},collector:{collectorNumber:'2'},condition:{condition:null},invalidCondition:{condition:'Perfect'},language:{language:'invented'},printing:{scryfallId:'unknown'},canonical:{canonicalCardId:'other'},provider:{providerIds:{scryfall:'other'}},variant:{variant:'invented'},review:{recognitionState:'unknown',reviewed:true},game:{gameId:'pokemon'} })) {
 test(`client confirmed flag cannot override ${name}`,async()=>assert.rejects(validateChaosCommitItem({...item,...change,confirmed:true,reviewed:true},provider),/CHAOS_TRUSTED_REVIEW_REQUIRED/));
}
test('ambiguous finish and absent provider language remain review-required',async()=>{
 await assert.rejects(validateChaosCommitItem({...item,finish:null},{...provider,printing:async()=>({...printing,finishes:['foil','nonfoil']})}),/REVIEW_REQUIRED/);
 await assert.rejects(validateChaosCommitItem(item,{...provider,printing:async()=>({...printing,language:null})}),/REVIEW_REQUIRED/);
});
test('prototype names and unresolved explicit variants cannot masquerade as allowed observations',async()=>{
 for(const condition of ['constructor','__proto__']) await assert.rejects(validateChaosCommitItem({...item,condition},provider),/REVIEW_REQUIRED/);
 await assert.rejects(validateChaosCommitItem({...item,variant:'unknown'},provider),/REVIEW_REQUIRED/);
 await assert.rejects(validateChaosCommitItem({...item,providerIds:{invented:''}},provider),/REVIEW_REQUIRED/);
});
test('claim binds review revision and settings; removed history is excluded',()=>{
 const snapshot={album:{id:'batch',user_id:'owner',workspace_id:'w',destination_id:'loc',destination_label:'Box',intake_mode:'live',settings:{},settings_revision:0},captures:[{capture_id:'a',revision:1,sha256:'hash',status:'RECEIVED',item},{capture_id:'b',status:'REMOVED',item:null}]};
 const claim=chaosCommitClaim(snapshot);assert.equal(claim.captures.length,1);assert.equal(claim.captures[0].revision,1);assert.equal(claim.album.destination_id,'loc');
});
