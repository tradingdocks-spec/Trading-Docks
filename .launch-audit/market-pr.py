import json, subprocess, urllib.request, sys
cred = subprocess.run(['git','credential','fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, check=True)
values = dict(line.split('=',1) for line in cred.stdout.splitlines() if '=' in line)
def api(path, method='GET', data=None):
    request = urllib.request.Request('https://api.github.com/repos/tradingdocks-spec/Trading-Docks'+path, method=method, data=json.dumps(data).encode() if data is not None else None, headers={'Authorization':'Bearer '+values['password'], 'Accept':'application/vnd.github+json', 'Content-Type':'application/json','User-Agent':'TradingDocks-Codex'})
    with urllib.request.urlopen(request) as response: return json.load(response)
if sys.argv[1] == 'create':
    prs=api('/pulls?head=tradingdocks-spec:codex/market-multigame-artwork&state=open')
    if prs: p=prs[0]
    else:
        body='''## Summary
- Replace non-Magic homepage artwork fallbacks with 17 verified exact printings across all five games.
- Sprint: homepage Market Intelligence artwork polish (no numbered sprint assigned).

## User Impact
- Real featured cards and thumbnails for Pokemon EN, Pokemon JP, Lorcana and One Piece; Magic remains on Scryfall.
- Responsive table and stable image-error recovery. Existing navigation remains available.

## Technical Changes
- Added normalized artwork providers/resolver, verified manifest, refresh script, reusable image component, provider documentation and unit/browser tests.
- Updated MarketSection and four exact Next/Image hosts.
- Classified the existing employee invitation API and refreshed stale hero-copy assertions to repair existing suite failures.
- No database, endpoint behavior or dependency changes.

## Validation
- TypeScript: passed.
- ESLint: passed, 0 errors and 491 existing warnings.
- Next production build: passed.
- Unit tests: 663 passed.
- Browser tests: 6 passed, covering 100 game/mode/viewport combinations and error recovery.
- Expo Web / Expo Native: not applicable; mobile is unchanged.

## Screens Affected
- Public homepage Market Intelligence section.

## Risks
- External images may become unavailable; verified-data guards and a stable safety state handle failures.
- One Piece publisher SAMPLE watermarks remain intact.

## Documentation
- docs/MARKET_ARTWORK_PROVIDERS.md records provider research, files, refresh procedure and visual QA.

## Checklist
- [x] Builds successfully
- [x] No TypeScript errors
- [x] No lint errors
- [x] No secrets committed
- [x] Existing functionality preserved
- [x] Responsive on mobile and web
- [x] Authentication tested if affected (not affected; existing route classification only)
- [x] Documentation updated
'''
        p=api('/pulls','POST',{'title':'fix: verify homepage artwork across all card games','head':'codex/market-multigame-artwork','base':'main','body':body})
    print(json.dumps({k:p.get(k) for k in ['number','html_url','head','mergeable','mergeable_state']},default=str))
else:
    p=api('/pulls/'+sys.argv[2]); sha=p['head']['sha']
    checks=api('/commits/'+sha+'/check-runs'); status=api('/commits/'+sha+'/status')
    print(json.dumps({'number':p['number'],'merged':p['merged'],'mergeable':p['mergeable'],'mergeable_state':p['mergeable_state'],'sha':sha,'checks':[{k:c.get(k) for k in ['name','status','conclusion','details_url']} for c in checks['check_runs']], 'statuses':[{k:s.get(k) for k in ['context','state','description']} for s in status['statuses']]}))
    if sys.argv[1]=='merge':
        assert p['mergeable'] and p['mergeable_state']=='clean', 'PR must be clean before merging'
        assert all(c['status']=='completed' and c['conclusion'] in ['success','neutral','skipped'] for c in checks['check_runs']), 'Checks pending or failed'
        assert all(s['state']=='success' for s in status['statuses']), 'Statuses pending or failed'
        print(json.dumps(api('/pulls/'+sys.argv[2]+'/merge','PUT',{'sha':sha,'merge_method':'squash','commit_title':p['title']+' (#'+sys.argv[2]+')'})))
