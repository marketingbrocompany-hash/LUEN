#!/usr/bin/env python3
"""Read-only Cloudflare Pages production-host discovery. Never logs credentials or private data."""
import json, os, urllib.request, urllib.error, sys
account = os.environ.get("CLOUDFLARE_ACCOUNT_ID","")
token = os.environ.get("CLOUDFLARE_API_TOKEN","")
assert account and token, "Missing Cloudflare credentials"
base = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects"
def query(url):
    req = urllib.request.Request(url,headers={"Authorization":f"Bearer {token}","Accept":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=28) as resp:
            data=json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"CLOUDFLARE_API_ERROR status={e.code} path={url.split('client/v4/')[-1].split('?')[0].split('/')[-1]}")
        raise SystemExit(2)
    except Exception as e:
        print("CLOUDFLARE_API_UNAVAILABLE",type(e).__name__)
        raise SystemExit(3)
    if not data.get('success'):
        errs=data.get('errors',[])
        print("CLOUDFLARE_API_NOT_SUCCESS codes=",[i.get('code') for i in errs])
        raise SystemExit(4)
    return data
projects=[]
for page in range(1,8):
    data=query(base+f"?per_page=100&page={page}")
    page_projects=data.get('result',[]) or []
    projects.extend(page_projects)
    if len(page_projects)<100:break
print("CLOUDFLARE_PAGES_PROJECT_COUNT",len(projects))
matches=[]
for project in projects:
    name=project.get("name","")
    if not name:continue
    encoded=urllib.parse.quote(name,safe="")
    domains=query(base+"/"+encoded+"/domains").get("result",[]) or []
    results=[{"name":x.get("name"),"status":x.get("status")} for x in domains]
    if any("luenkorea.com" == x.get("name") or "www.luenkorea.com" == x.get("name") for x in results):
        match={"project":name,"subdomain":project.get("subdomain"),"production_branch":project.get("production_branch"),
               "domains":results}
        data=query(base+"/"+encoded+"/deployments?env=production&per_page=2")
        deploys=data.get('result',[]) or []
        match['previous_deployments']=[{"id":x.get('id'),"environment":x.get('environment'),"url":x.get('url'),
                                       "created_on":x.get('created_on'),"latest_stage":x.get('latest_stage',{}).get('status')}
                                      for x in deploys]
        matches.append(match)
    print("PAGES_PROJECT",json.dumps({"name":name,"subdomain":project.get('subdomain'),
       "production_branch":project.get("production_branch"),"custom_domains":results},ensure_ascii=False))
print("OPERATING_DOMAIN_MATCHES",json.dumps(matches,ensure_ascii=False))
if len(matches)!=1:
    print("BLOCK_PRODUCTION_DEPLOY exact_owner_project_count=",len(matches))
    sys.exit(10)
m=matches[0]
if not any(d.get('name')=='luenkorea.com' and d.get('status')=='active' for d in m['domains']):
    print("BLOCK_PRODUCTION_DEPLOY domain_not_active")
    sys.exit(11)
if not m.get('previous_deployments') or not m.get('production_branch'):
    print("BLOCK_PRODUCTION_DEPLOY missing_rollback_pointer")
    sys.exit(12)
print("SAFE_DISCOVERY_OK operating_site_matches_active_Pages_project_and_previous_deployment")
