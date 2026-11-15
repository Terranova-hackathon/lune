"""Write each request's enabled query params into its URL.

The Bruno CLI builds the request from `http.url` and ignores `type: query` entries in
`http.params`, so without this every query parameter is silently dropped.

Usage: python3 fix_query_params.py path/to/lune-reference-api
Safe to run more than once: it rebuilds the query string from the params each time.
"""
import glob
import os
import sys

import yaml


def str_representer(dumper, data):
    style = "|" if "\n" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


yaml.add_representer(str, str_representer)

root = sys.argv[1]
changed = 0
for path in sorted(glob.glob(os.path.join(root, "**", "*.yml"), recursive=True)):
    if path.endswith(("folder.yml", "opencollection.yml")) or f"{os.sep}environments{os.sep}" in path:
        continue
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    http = (data or {}).get("http")
    if not http or "url" not in http:
        continue

    query = [p for p in http.get("params", [])
             if p.get("type") == "query" and not p.get("disabled")]
    base = http["url"].split("?", 1)[0]
    url = base + ("?" + "&".join(f"{p['name']}={p.get('value', '')}" for p in query) if query else "")
    if url != http["url"]:
        http["url"] = url
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, sort_keys=False, allow_unicode=True, width=1000)
        changed += 1
        print(f"{os.path.relpath(path, root)}: {url}")

print(f"\nupdated {changed} request(s)")
