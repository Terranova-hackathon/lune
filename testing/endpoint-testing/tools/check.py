import glob, json, re, subprocess, sys, yaml, os
root = sys.argv[1]
env = yaml.safe_load(open(f"{root}/environments/Development.yml"))
defined = {v["name"] for v in env["variables"]}
set_vars = set()
scripts = []
used = set()
for f in sorted(glob.glob(f"{root}/**/*.yml", recursive=True)):
    d = yaml.safe_load(open(f))
    if "environments" in f or f.endswith("opencollection.yml") or f.endswith("folder.yml"):
        continue
    text = json.dumps(d.get("http", {}))
    used |= set(re.findall(r"\{\{(\w+)\}\}", text))
    for s in d.get("runtime", {}).get("scripts", []):
        scripts.append((f, s["type"], s["code"]))
        set_vars |= set(re.findall(r"bru\.setVar\('(\w+)'", s["code"]))
        used |= set(re.findall(r"bru\.getVar\('(\w+)'\)", s["code"]))
        for m in re.findall(r"bru\.getEnvVar\('(\w+)'\)", s["code"]):
            assert m in defined, (f, m)
    if d.get("http", {}).get("body", {}).get("type") == "json":
        data = re.sub(r"\{\{\w+\}\}", "x", d["http"]["body"]["data"])
        json.loads(data)
missing = used - defined - set_vars
print("vars used but never defined:", missing or "none")
print("scripts:", len(scripts))
js = "const bru={setVar(){},getVar(){return ''},getEnvVar(){return 'x'}},res={},test=()=>{},expect=()=>{};\n"
for i,(f,t,c) in enumerate(scripts):
    js += f"function s{i}(){{\n{c}\n}}\n"
import tempfile
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tmp:
    tmp.write(js)
r = subprocess.run(["node", "--check", tmp.name], capture_output=True, text=True)
print("node syntax:", "ok" if r.returncode == 0 else r.stderr)
os.remove(tmp.name)
