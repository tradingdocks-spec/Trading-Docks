// Read-only synthetic domain diagnostics. A successful process means evidence
// collection completed, NOT that known software blockers passed certification.
import assert from 'node:assert/strict';
import { rankCandidate } from '../src/lib/card-intelligence/ranking.ts';
import { normalizeCard } from '../src/lib/market-engine/helpers.ts';
import { resolveBuylistMatch } from '../src/lib/buylist.ts';
import { normalizeRows, parseCsv } from '../src/lib/csv-converter.ts';
import { createContinuousScannerSession, createRecognitionPipelineReport, addRecognitionToSession } from '../mobile/services/continuous-offer-scanner.ts';
import { defaultFinishForPrinting } from '../mobile/services/exact-printing-recognition.ts';
import { collectorEditCommand } from '../mobile/services/collector-inventory-command.ts';

const results = [];
const quote = normalizeCard({ id:'fixture', game:'magic', name:'Fixture', subtitle:'', setName:'Set', setCode:'TST', collectorNumber:'1', image:'', marketPrice:2, inventoryOwned:99, index:7, source:'fixture provider', dataQuality:'live' });
assert.equal(quote.marketPrice,2);
for (const key of ['demand','volumeScore','opportunityScore','inventoryOwned','potentialRevenue','change24h','change7d']) assert.equal(quote[key],null);
assert.deepEqual(quote.sparkline,[]);
results.push({ gate:'G17 market feed normalization', status:'RESOLVED', observation:'Real quote retained; seven unsupported metrics null; no fabricated trend' });

const offer={ id:'offer',store_name:'Fixture',scryfall_id:'printing',card_name:'Fixture',set_code:'tst',collector_number:'1',finish:'nonfoil',condition:'NM',language:'English',cash_price:1,credit_price:null,quantity_wanted:1,source_url:null,verified_at:null };
const stock={ id:'stock',name:'Fixture',quantity:1,scryfallId:'printing',set:'tst',collectorNumber:'1',finish:'normal',condition:'NM',language:'en' };
for(const field of ['finish','condition','language']) {
  assert.equal(resolveBuylistMatch(offer,{...stock,[field]:undefined}).canFinalize,false);
}
results.push({ gate:'G18 repaired buylist boundary',status:'RESOLVED',observation:'Unknown physical fields cannot finalize' });

const canonical={ game:'magic',printingId:'printing',canonicalCardId:'card',name:'Fixture',setName:'Set',setCode:'tst',collectorNumber:'1',language:'en',finishes:['nonfoil'],rarity:'common',imageUrl:null,providerIds:{scryfall:'printing',tcgplayer:123},provenance:['fixture'],identityAuthority:'provider_confirmed',prices:[] };
const ranked=rankCandidate({cardName:'Fixture',setCode:'tst',collectorNumber:'1',language:'en',finish:'nonfoil',providerIds:{scryfall:'printing',tcgplayer:999}},canonical);
results.push({gate:'G18 shared provider disagreement',status:ranked.requiresConfirmation && ranked.conflictingSignals.includes('providerId')?'RESOLVED':'BLOCKER',observation:{tier:ranked.confidenceTier,review:ranked.requiresConfirmation,providerSignal:ranked.diagnostics.providerId.status}});

const candidate={ id:'printing',name:'Fixture',gameId:'magic',setCode:'TST',setName:'Set',collectorNumber:'1',finishes:['normal','foil'],language:'en',confidence:.95,recognitionMode:'assisted_capture' };
const recognition=createRecognitionPipelineReport({detectedGame:'magic',candidates:[candidate],confidence:{overall:95,threshold:82,requiresConfirmation:false,conflicts:[],signals:[]},recognitionMethod:'metadata_assisted'});
const session=createContinuousScannerSession({id:'synthetic-session',userId:'synthetic-owner',name:'Audit only',mode:'collection_add'});
const line=addRecognitionToSession(session,{stableScanId:'one',candidate,recognition,marketPrice:2}).lines[0];
results.push({gate:'G18 scanner omitted condition',status:line.condition==='unknown'?'RESOLVED':'BLOCKER',observation:{condition:line.condition,review:line.reviewStatus}});
const finish=defaultFinishForPrinting(candidate);
results.push({gate:'G18 ambiguous finish default',status:finish.finish==='unknown'?'RESOLVED':'BLOCKER',observation:finish});

const row=normalizeRows(parseCsv('Name,Quantity\nFixture,1'),'generic')[0];
results.push({gate:'G18 legacy CSV helper (not current converter entry point)',status:!row.language?'RESOLVED':'NON-BLOCKING LIMITATION',observation:{language:row.language},note:'Current CsvConversionEngine now preserves absent language and blocks unresolved save. Legacy helper is not the active converter.'});
const first=collectorEditCommand({type:'quantity',userId:'owner',inventoryItemId:'item',quantity:2},'first-intent','workspace','fixture-time');
const second=collectorEditCommand({type:'quantity',userId:'owner',inventoryItemId:'item',quantity:3},'second-intent','workspace','fixture-time');
assert.notEqual(first.args.p_idempotency_key,second.args.p_idempotency_key);
results.push({gate:'G19 generic setters',status:'RESOLVED',observation:'Distinct immutable commands; durable replay uses original operation identity. Other mutation paths require separate matrix review.'});
console.log(JSON.stringify({kind:'CLOSURE_DIAGNOSTICS_NOT_A_RELEASE_PASS',results,verdict:results.some(r=>r.status==='BLOCKER')?'PHASE 1 INCOMPLETE':'SOFTWARE_FINDINGS_CLEAR_WITHIN_THIS_LIMITED_HARNESS'},null,2));
