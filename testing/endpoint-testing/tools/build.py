"""Expand the Lune Bruno (OpenCollection YAML) collection with tests for every documented condition."""
import copy
import json
import os
import sys

import yaml

ROOT = sys.argv[1]  # path to lune-reference-api (run on a copy; files are overwritten)

SETTINGS = {
    "encodeUrl": True,
    "timeout": 0,
    "followRedirects": True,
    "maxRedirects": 5,
    "forwardAuthorizationHeader": True,
}


class Literal(str):
    pass


def literal_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")


def str_representer(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


yaml.add_representer(Literal, literal_representer)
yaml.add_representer(str, str_representer)


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, sort_keys=False, allow_unicode=True, width=1000)


# ---------------------------------------------------------------- JS snippets

AUTH_HEADER = {"name": "Cookie", "value": "Lune_auth={{token}}"}

CAPTURE_COOKIE = """// Keep the auth cookie so later requests can send it explicitly.
const raw = res.headers['set-cookie'];
const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
const auth = cookies.find(c => c.startsWith('Lune_auth='));
if (auth) bru.setVar('token', auth.split(';')[0].substring('Lune_auth='.length));"""

CLEAR_COOKIE = "bru.setVar('token', '');"

SETUP_RUN_VARS = """// Unique test users for this run, so the collection can be run repeatedly.
const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
bru.setVar('runEmail', `lune.${id}@test.com`);
bru.setVar('runEmail2', `lune.${id}.2@test.com`);
bru.setVar('runEmail3', `lune.${id}.3@test.com`);
bru.setVar('runName', `u${id}`);       // 12 characters
bru.setVar('runNameNew', `n${id}`);    // 12 characters"""

HAS_KEY = """function hasErrorKey(body, name) {
  const keys = Object.keys((body && body.errors) || {});
  return keys.some(k => k.toLowerCase() === name.toLowerCase());
}"""


def t_status(code):
    return f"""test('returns {code}', () => {{
  expect(res.status).to.equal({code});
}});"""


def t_validation(key):
    return f"""{HAS_KEY}

test('returns 400', () => {{
  expect(res.status).to.equal(400);
}});

test('reports an error for {key}', () => {{
  expect(hasErrorKey(res.body, '{key}'), JSON.stringify(res.body.errors)).to.equal(true);
}});"""


T_PAGED = """test('returns a paged result', () => {
  const b = res.body;
  expect(b).to.have.property('items').that.is.an('array');
  ['page', 'pageSize', 'totalCount', 'totalPages'].forEach(k => expect(b[k], k).to.be.a('number'));
  expect(b.items.length).to.be.at.most(b.pageSize);
  expect(b.totalPages).to.equal(b.pageSize > 0 ? Math.ceil(b.totalCount / b.pageSize) : 0);
});"""

T_GAME_SUMMARY = """test('items have the game summary shape', () => {
  res.body.items.forEach(g => {
    expect(g.id).to.be.a('number');
    expect(g.name).to.be.a('string');
    expect(g.genres).to.be.an('array');
    expect(g.platforms).to.be.an('array');
  });
});"""

T_USER = """test('returns the user shape', () => {
  expect(res.body.id).to.be.a('string').and.not.be.empty;
  expect(res.body).to.have.property('email');
  expect(res.body).to.have.property('displayName');
});"""


def tests(*blocks):
    return "\n\n".join(blocks)


# ---------------------------------------------------------------- request builder

def body(obj):
    return {"type": "json", "data": json.dumps(obj, indent=2, ensure_ascii=False)}


def request(name, seq, method, url, *, params=None, auth=False, json_body=None, raw_body=None,
            before=None, after=None, test=None, docs=None, folder=None, base=None):
    """Build a request dict. With `base`, start from an existing file and keep its examples/docs."""
    if base:
        data = load(os.path.join(ROOT, base))
    else:
        data = {"info": {"name": name, "type": "http", "seq": seq, "tags": [folder]},
                "http": {}, "settings": copy.deepcopy(SETTINGS)}

    data["info"]["name"] = name
    data["info"]["seq"] = seq

    http = data.setdefault("http", {})
    http["method"] = method
    if params is not None:
        http["params"] = params
    else:
        http.pop("params", None)
    # The Bruno CLI only sends what is in `url`, so the enabled query params must be in it too.
    query = [p for p in (params or []) if p["type"] == "query" and not p.get("disabled")]
    http["url"] = url + ("?" + "&".join(f"{p['name']}={p['value']}" for p in query) if query else "")
    headers = [dict(AUTH_HEADER)] if auth else []
    if headers:
        http["headers"] = headers
    else:
        http.pop("headers", None)
    if json_body is not None:
        http["body"] = body(json_body)
    elif raw_body is not None:
        http["body"] = {"type": "json", "data": raw_body}
    else:
        http.pop("body", None)
    http["auth"] = "inherit"

    scripts = []
    if before:
        scripts.append({"type": "before-request", "code": Literal(before)})
    if after:
        scripts.append({"type": "after-response", "code": Literal(after)})
    if test:
        scripts.append({"type": "tests", "code": Literal(test)})
    runtime = {"scripts": scripts} if scripts else None

    # Rebuild in a stable key order: info, http, runtime, settings, examples, docs
    ordered = {"info": data["info"], "http": http}
    if runtime:
        ordered["runtime"] = runtime
    ordered["settings"] = data.get("settings", copy.deepcopy(SETTINGS))
    if "examples" in data:
        ordered["examples"] = data["examples"]
    if docs is not None:
        ordered["docs"] = docs
    elif "docs" in data:
        ordered["docs"] = data["docs"]
    return ordered


def q(name, value, disabled=False):
    p = {"name": name, "value": str(value), "type": "query"}
    if disabled:
        p["disabled"] = True
    return p


def path(name, value):
    return {"name": name, "value": str(value), "type": "path"}


# ---------------------------------------------------------------- collection

OUT = {}  # relative path -> data
REMOVE = []


def add(rel, data):
    OUT[rel] = data


B = "{{baseUrl}}"

# ---------- Health
add("Health/Health Check.yml", request(
    "Health Check", 1, "GET", f"{B}/health", base="Health/Health Check.yml",
    test=tests(t_status(200), """test('body is "ok"', () => {
  expect(String(res.body).trim()).to.equal('ok');
});""")))

add("Health/Readiness Check.yml", request(
    "Readiness Check", 2, "GET", f"{B}/health/ready", base="Health/Readiness Check.yml",
    test=tests(t_status(200), """test('database check is healthy', () => {
  expect(res.body.status).to.equal('Healthy');
  expect(res.body.checks).to.have.property('database', 'Healthy');
});""")))

# ---------- Games
SEARCH_BASE = "Games/Search Games.yml"
search_defaults = load(os.path.join(ROOT, SEARCH_BASE))["http"]["params"]


def search_params(**values):
    """Copy the documented search params; enable and set the ones given."""
    out = []
    for p in search_defaults:
        p = {k: v for k, v in p.items()}
        if p["name"] in values:
            p["value"] = str(values[p["name"]])
            p.pop("disabled", None)
        elif p["name"] not in ("page", "pageSize"):
            p["value"] = ""
            p["disabled"] = True
        out.append(p)
    return out


def search(name, seq, test, base=None, after=None, **values):
    return request(name, seq, "GET", f"{B}/api/games", params=search_params(**values),
                   test=test, after=after, base=base, folder="Games")


add(SEARCH_BASE, search("Search Games", 1, tests(t_status(200), T_PAGED, T_GAME_SUMMARY, """test('browsing returns games', () => {
  expect(res.body.totalCount).to.be.above(0);
  expect(res.body.page).to.equal(1);
  expect(res.body.pageSize).to.equal(20);
});"""), base=SEARCH_BASE, page=1, pageSize=20))

add("Games/Search Games - By Name.yml", search("Search Games - By Name", 2, tests(t_status(200), T_PAGED, """test('every result name contains the search term', () => {
  expect(res.body.items.length).to.be.above(0);
  res.body.items.forEach(g => expect(g.name.toLowerCase()).to.include('mario'));
});"""), search="mario", page=1, pageSize=20))

add("Games/Search Games - Paging Clamped.yml", search("Search Games - Paging Clamped", 3, tests(t_status(200), """test('page below 1 becomes 1', () => {
  expect(res.body.page).to.equal(1);
});

test('pageSize above 40 becomes 40', () => {
  expect(res.body.pageSize).to.equal(40);
  expect(res.body.items.length).to.be.at.most(40);
});"""), page=0, pageSize=100))

add("Games/Search Games - Invalid Ordering.yml", search(
    "Search Games - Invalid Ordering", 4, t_validation("ordering"), page=1, pageSize=20, ordering="popularity"))

add("Games/Search Games - Metacritic Min Above Max.yml", search(
    "Search Games - Metacritic Min Above Max", 5, t_validation("metacriticMax"),
    page=1, pageSize=20, metacriticMin=80, metacriticMax=50))

add("Games/Search Games - Metacritic Out Of Range.yml", search(
    "Search Games - Metacritic Out Of Range", 6, t_validation("metacriticMin"), page=1, pageSize=20, metacriticMin=101))

add("Games/Search Games - Invalid Platforms.yml", search(
    "Search Games - Invalid Platforms", 7, t_validation("platforms"), page=1, pageSize=20, platforms="pc,ps5"))

add("Games/Search Games - Too Many Genres.yml", search(
    "Search Games - Too Many Genres", 8, t_validation("genres"),
    page=1, pageSize=20, genres="a,b,c,d,e,f,g,h,i,j,k"))

add("Games/Search Games - Invalid Genre Slug.yml", search(
    "Search Games - Invalid Genre Slug", 9, t_validation("genres"), page=1, pageSize=20, genres="Role Playing!"))

add("Games/Get Filter Options.yml", request(
    "Get Filter Options", 10, "GET", f"{B}/api/games/filters", base="Games/Get Filter Options.yml",
    after="""// Save a real genre slug for the filtered search.
if (res.status === 200 && res.body.genres.length) bru.setVar('genreSlug', res.body.genres[0].value);""",
    test=tests(t_status(200), """test('returns genres, platforms and orderings', () => {
  ['genres', 'platforms', 'orderings'].forEach(k => {
    expect(res.body[k], k).to.be.an('array').that.is.not.empty;
    res.body[k].forEach(o => {
      expect(o.value).to.be.a('string');
      expect(o.name).to.be.a('string');
    });
  });
});

test('orderings are the six documented sort orders', () => {
  const values = res.body.orderings.map(o => o.value).sort();
  expect(values).to.deep.equal(['-added', '-metacritic', '-rating', '-released', 'name', 'released']);
});

test('platform values are numeric IDs and include PC (6)', () => {
  res.body.platforms.forEach(p => expect(p.value).to.match(/^\\d+$/));
  expect(res.body.platforms.map(p => p.value)).to.include('6');
});""")))

add("Games/Search Games - Filtered.yml", search("Search Games - Filtered", 11, tests(t_status(200), T_PAGED, """test('every result matches the genre and platform', () => {
  const genre = bru.getVar('genreSlug');
  res.body.items.forEach(g => {
    expect(g.genres.map(o => o.value), g.name).to.include(genre);
    expect(g.platforms.map(o => o.value), g.name).to.include('6');
  });
});

test('results are sorted by rating, high to low', () => {
  const ratings = res.body.items.map(g => g.rating);
  for (let i = 1; i < ratings.length; i++) expect(ratings[i]).to.be.at.most(ratings[i - 1]);
});"""), page=1, pageSize=20, genres="{{genreSlug}}", platforms=6, ordering="-rating"))

COMPANIES_BASE = "Games/Search Companies.yml"


def companies(name, seq, test, after=None, base=None, **values):
    params = [q("kind", values.get("kind", ""), "kind" not in values),
              q("search", values.get("search", ""), "search" not in values)]
    return request(name, seq, "GET", f"{B}/api/games/companies", params=params, test=test,
                   after=after, base=base, folder="Games")


add(COMPANIES_BASE, companies("Search Companies", 12, tests(t_status(200), """test('returns at most 10 companies, most games first', () => {
  const list = res.body;
  expect(list).to.be.an('array').that.is.not.empty;
  expect(list.length).to.be.at.most(10);
  list.forEach(c => {
    expect(c.slug).to.be.a('string');
    expect(c.name).to.be.a('string');
    expect(c.gamesCount).to.be.a('number');
  });
  for (let i = 1; i < list.length; i++) expect(list[i].gamesCount).to.be.at.most(list[i - 1].gamesCount);
});

test('every name contains the search term', () => {
  const term = bru.getEnvVar('developer').toLowerCase();
  res.body.forEach(c => expect(c.name.toLowerCase()).to.include(term));
});"""), after="if (res.status === 200 && res.body.length) bru.setVar('developerSlug', res.body[0].slug);",
    base=COMPANIES_BASE, kind="developer", search="{{developer}}"))

add("Games/Search Companies - Missing Kind.yml", companies(
    "Search Companies - Missing Kind", 13, t_validation("kind"), search="{{developer}}"))
add("Games/Search Companies - Invalid Kind.yml", companies(
    "Search Companies - Invalid Kind", 14, t_validation("kind"), kind="studio", search="{{developer}}"))
add("Games/Search Companies - Search Too Short.yml", companies(
    "Search Companies - Search Too Short", 15, t_validation("search"), kind="publisher", search="e"))

add("Games/Search Games - By Developer.yml", search("Search Games - By Developer", 16, tests(t_status(200), T_PAGED, """test('the developer has games', () => {
  expect(res.body.totalCount).to.be.above(0);
});"""), page=1, pageSize=20, developers="{{developerSlug}}"))

BYID_BASE = "Games/Get Game By ID.yml"
add(BYID_BASE, request(
    "Get Game By ID", 17, "GET", f"{B}/api/games/:id",
    params=[path("id", "{{gameId}}"), q("page", 1), q("pageSize", 2)], base=BYID_BASE,
    test=tests(t_status(200), """test('returns the requested game', () => {
  expect(res.body.id).to.equal(Number(bru.getEnvVar('gameId')));
  expect(res.body.name).to.be.a('string');
});

test('includes details and media lists', () => {
  ['externalGames', 'genres', 'platforms', 'developers', 'publishers', 'screenshots', 'artworks', 'videos']
    .forEach(k => expect(res.body[k], k).to.be.an('array'));
});

test('media are full URLs', () => {
  res.body.screenshots.concat(res.body.artworks).forEach(u => expect(u).to.match(/^https?:\\/\\//));
  res.body.videos.forEach(u => expect(u).to.match(/youtube/));
});

test('relatedGames is paged by page and pageSize', () => {
  const r = res.body.relatedGames;
  expect(r.page).to.equal(1);
  expect(r.pageSize).to.equal(2);
  expect(r.items.length).to.be.at.most(2);
});""")))

add("Games/Get Game By ID - Not Found.yml", request(
    "Get Game By ID - Not Found", 18, "GET", f"{B}/api/games/:id",
    params=[path("id", "{{unknownGameId}}")], folder="Games", test=t_status(404)))

add("Games/Get Featured Games.yml", request(
    "Get Featured Games", 19, "GET", f"{B}/api/games/featured", base="Games/Get Featured Games.yml",
    test=tests(t_status(200), """test('returns up to 10 games', () => {
  expect(res.body).to.be.an('array').that.is.not.empty;
  expect(res.body.length).to.be.at.most(10);
});

test('relatedGames is always empty', () => {
  res.body.forEach(g => expect(g.relatedGames.items, g.name).to.be.an('array').that.is.empty);
});

test('no duplicate games', () => {
  const ids = res.body.map(g => g.id);
  expect(new Set(ids).size).to.equal(ids.length);
});""")))

# ---------- Prices
PRICE_BASE = "Prices/Get Price Comparison.yml"
add(PRICE_BASE, request(
    "Get Price Comparison", 1, "GET", f"{B}/api/prices/:Id", params=[path("Id", "{{gameId}}")], base=PRICE_BASE,
    test=tests(t_status(200), """test('returns prices for the requested game', () => {
  expect(res.body.gameId).to.equal(Number(bru.getEnvVar('gameId')));
  expect(res.body.steamAppId).to.be.a('number');
  expect(res.body.platforms).to.be.an('array').that.is.not.empty;
});

test('platforms are Steam or GG.deals', () => {
  res.body.platforms.forEach(p => expect(['Steam', 'GG.deals']).to.include(p.platform));
});

test('averagePrice is not filled in yet', () => {
  res.body.platforms.forEach(p => expect(p.averagePrice, p.platform).to.equal(null));
});

test('Steam has no historical low', () => {
  const steam = res.body.platforms.find(p => p.platform === 'Steam');
  if (steam) expect(steam.historicalLow).to.equal(null);
});""")))

add("Prices/Get Price Comparison - Not On Steam.yml", request(
    "Get Price Comparison - Not On Steam", 2, "GET", f"{B}/api/prices/:Id",
    params=[path("Id", "{{nonSteamGameId}}")], folder="Prices",
    test=tests(t_status(404), """test('explains that there is no price data', () => {
  expect(res.body.title).to.equal('No price data found.');
});""")))

# ---------- Auth
# Negative registration tests use Bruno's {{$randomEmail}}, so a test that unexpectedly
# succeeds can't take an email the main flow needs.
THROWAWAY = "{{$randomEmail}}"
REG_BASE = "Auth/Register.yml"
LOGIN_BASE = "Auth/Login.yml"
PROFILE_BASE = "Auth/Update Profile.yml"
ME_BASE = "Auth/Get Current User.yml"
LOGOUT_BASE = "Auth/Logout.yml"


def reg(name, seq, payload, test, base=None, after=None, folder="Auth"):
    return request(name, seq, "POST", f"{B}/api/auth/register", json_body=payload, test=test,
                   after=after, base=base, folder=folder)


def login(name, seq, payload, test, base=None, after=None, folder="Auth"):
    return request(name, seq, "POST", f"{B}/api/auth/login", json_body=payload, test=test,
                   after=after, base=base, folder=folder)


def sign_in(name, seq, email_var, folder):
    return login(name, seq, {"email": "{{%s}}" % email_var, "password": "{{password}}"},
                 tests(t_status(200), T_USER), after=CAPTURE_COOKIE, folder=folder)


def sign_out(name, seq, folder, before=None):
    return request(name, seq, "POST", f"{B}/api/auth/logout", before=before, after=CLEAR_COOKIE,
                   test=t_status(204), folder=folder)


def me(name, seq, test, auth, base=None, folder="Auth", cookie=None):
    data = request(name, seq, "GET", f"{B}/api/auth/me", auth=auth, test=test, base=base, folder=folder)
    if cookie:
        data["http"]["headers"] = [{"name": "Cookie", "value": cookie}]
    return data


def profile(name, seq, payload, test, auth=True, base=None, raw=None):
    return request(name, seq, "PUT", f"{B}/api/auth/profile", auth=auth, json_body=payload, raw_body=raw,
                   test=test, base=base, folder="Auth")


VALID = {"password": "{{password}}", "acceptedPrivacyPolicy": True}

add("Auth/Sign Out (setup).yml", sign_out("Sign Out (setup)", 1, "Auth", before=SETUP_RUN_VARS))
add("Auth/Get Current User - Signed Out.yml", me("Get Current User - Signed Out", 2, t_status(401), auth=False))
add("Auth/Get Current User - Invalid Token.yml", me(
    "Get Current User - Invalid Token", 3, t_status(401), auth=False, cookie="Lune_auth=not-a-real-token"))
add("Auth/Update Profile - Signed Out.yml", profile(
    "Update Profile - Signed Out", 4, {"displayName": "{{runNameNew}}"}, t_status(401), auth=False))

add("Auth/Register - Privacy Not Sent.yml", reg(
    "Register - Privacy Not Sent", 5, {"email": THROWAWAY, "password": "{{password}}"},
    t_validation("AcceptedPrivacyPolicy")))
add("Auth/Register - Privacy Declined.yml", reg(
    "Register - Privacy Declined", 6,
    {"email": THROWAWAY, "password": "{{password}}", "acceptedPrivacyPolicy": False},
    t_validation("AcceptedPrivacyPolicy")))
add("Auth/Register - Password Too Short.yml", reg(
    "Register - Password Too Short", 7,
    {"email": THROWAWAY, "password": "Ab1!", "acceptedPrivacyPolicy": True}, t_validation("Password")))
add("Auth/Register - Weak Password.yml", reg(
    "Register - Weak Password", 8,
    {"email": THROWAWAY, "password": "password123", "acceptedPrivacyPolicy": True},
    tests(t_status(400), """test('reports password rule errors (Identity codes)', () => {
  const keys = Object.keys(res.body.errors || {});
  expect(keys.some(k => /password/i.test(k)), JSON.stringify(keys)).to.equal(true);
});""")))
add("Auth/Register - Invalid Email.yml", reg(
    "Register - Invalid Email", 9, dict(email="not-an-email", **VALID), t_validation("Email")))
add("Auth/Register - Display Name Too Long.yml", reg(
    "Register - Display Name Too Long", 10,
    dict(email=THROWAWAY, displayName="abcdefghijklmnopqrstu", **VALID), t_validation("DisplayName")))

add(REG_BASE, reg("Register", 11, dict(email="{{runEmail}}", displayName="{{runName}}", **VALID), tests(
    t_status(201), T_USER, """test('returns the new user', () => {
  expect(res.body.email).to.equal(bru.getVar('runEmail'));
  expect(res.body.displayName).to.equal(bru.getVar('runName'));
});

test('Location points to /api/auth/me', () => {
  expect(res.headers.location).to.match(/\\/api\\/auth\\/me$/);
});

test('sets the auth cookie', () => {
  expect(bru.getVar('token'), 'Lune_auth cookie').to.be.a('string').and.not.be.empty;
});"""), base=REG_BASE, after=CAPTURE_COOKIE))

add("Auth/Register - Duplicate Email.yml", reg(
    "Register - Duplicate Email", 12, dict(email="{{runEmail}}", **VALID),
    tests(t_status(400), """test('reports the email as already registered', () => {
  const keys = Object.keys(res.body.errors || {});
  expect(keys.some(k => /duplicate|email/i.test(k)), JSON.stringify(keys)).to.equal(true);
});""")))
add("Auth/Register - Duplicate Display Name.yml", reg(
    "Register - Duplicate Display Name", 13, dict(email=THROWAWAY, displayName="{{runName}}", **VALID),
    t_validation("DisplayName")))

T_NULL_NAME = """test('displayName is null', () => {
  expect(res.body.displayName).to.equal(null);
});"""
add("Auth/Register - No Display Name.yml", reg(
    "Register - No Display Name", 14, dict(email="{{runEmail2}}", **VALID),
    tests(t_status(201), T_USER, T_NULL_NAME), after=CAPTURE_COOKIE))
add("Auth/Register - Second User Without Display Name.yml", reg(
    "Register - Second User Without Display Name", 15, dict(email="{{runEmail3}}", displayName=None, **VALID),
    tests(t_status(201), T_NULL_NAME, """test('several users can have no display name', () => {
  expect(res.body.email).to.equal(bru.getVar('runEmail3'));
});"""), after=CAPTURE_COOKIE))

add("Auth/Update Profile - Name Taken.yml", profile(
    "Update Profile - Name Taken", 16, {"displayName": "{{runName}}"}, t_validation("DisplayName")))
add("Auth/Update Profile - Name Taken (Different Case).yml", request(
    "Update Profile - Name Taken (Different Case)", 17, "PUT", f"{B}/api/auth/profile", auth=True,
    json_body={"displayName": "{{runNameUpper}}"}, folder="Auth",
    before="bru.setVar('runNameUpper', bru.getVar('runName').toUpperCase());",
    test=t_validation("DisplayName")))

add("Auth/Login - Wrong Password.yml", login(
    "Login - Wrong Password", 18, {"email": "{{runEmail}}", "password": "Wrong-Password1!"},
    tests(t_status(401), """test('says the email or password is invalid', () => {
  expect(res.body.title).to.equal('Invalid email or password.');
});""")))
add("Auth/Login - Unknown Email.yml", login(
    "Login - Unknown Email", 19, {"email": "nobody.{{runEmail}}", "password": "{{password}}"},
    tests(t_status(401), """test('gives the same answer as a wrong password', () => {
  expect(res.body.title).to.equal('Invalid email or password.');
});""")))
add("Auth/Login - Missing Password.yml", login(
    "Login - Missing Password", 20, {"email": "{{runEmail}}"}, t_validation("Password")))

add(LOGIN_BASE, login("Login", 21, {"email": "{{runEmail}}", "password": "{{password}}"}, tests(
    t_status(200), T_USER, """test('signs in the first test user', () => {
  expect(res.body.email).to.equal(bru.getVar('runEmail'));
});

test('sets the auth cookie', () => {
  expect(bru.getVar('token'), 'Lune_auth cookie').to.be.a('string').and.not.be.empty;
});"""), base=LOGIN_BASE, after=CAPTURE_COOKIE))

add(ME_BASE, me("Get Current User", 22, tests(t_status(200), T_USER, """test('returns the signed-in user', () => {
  expect(res.body.email).to.equal(bru.getVar('runEmail'));
  expect(res.body.displayName).to.equal(bru.getVar('runName'));
});"""), auth=True, base=ME_BASE))

add(PROFILE_BASE, profile("Update Profile", 23, None, tests(t_status(200), T_USER, """test('saves the trimmed name', () => {
  expect(res.body.displayName).to.equal(bru.getVar('runNameNew'));
});"""), base=PROFILE_BASE, raw='{\n  "displayName": "   {{runNameNew}}   "\n}'))
add("Auth/Update Profile - Unchanged.yml", profile(
    "Update Profile - Unchanged", 24, {"displayName": "{{runNameNew}}"}, tests(t_status(200), """test('re-saving your own name is allowed', () => {
  expect(res.body.displayName).to.equal(bru.getVar('runNameNew'));
});""")))
add("Auth/Update Profile - Too Short.yml", profile(
    "Update Profile - Too Short", 25, {"displayName": "a"}, t_validation("DisplayName")))
add("Auth/Update Profile - Too Long.yml", profile(
    "Update Profile - Too Long", 26, {"displayName": "abcdefghijklmnopqrstu"}, t_validation("DisplayName")))
add("Auth/Update Profile - Missing Name.yml", profile(
    "Update Profile - Missing Name", 27, {}, t_validation("DisplayName")))

add(LOGOUT_BASE, request(
    "Logout", 28, "POST", f"{B}/api/auth/logout", auth=True, base=LOGOUT_BASE, after=CLEAR_COOKIE,
    test=t_status(204)))
add("Auth/Get Current User - After Logout.yml", me("Get Current User - After Logout", 29, t_status(401), auth=False))
add("Auth/Logout - Already Signed Out.yml", request(
    "Logout - Already Signed Out", 30, "POST", f"{B}/api/auth/logout", folder="Auth",
    test=tests(t_status(204), "// Logout always succeeds, even with no session.")))

# Delete Account moves to Teardown (it has to run after Favorites).
REMOVE.append("Auth/Delete Account.yml")

# ---------- Favorites
F = "Favorites"
add("Favorites/Sign Out (setup).yml", sign_out("Sign Out (setup)", 1, F))
add("Favorites/List Favorites - Signed Out.yml", request(
    "List Favorites - Signed Out", 2, "GET", f"{B}/api/favorites", folder=F, test=t_status(401)))
add("Favorites/List Favorite IDs - Signed Out.yml", request(
    "List Favorite IDs - Signed Out", 3, "GET", f"{B}/api/favorites/ids", folder=F, test=t_status(401)))
add("Favorites/Add Favorite - Signed Out.yml", request(
    "Add Favorite - Signed Out", 4, "PUT", f"{B}/api/favorites/:Id", params=[path("Id", "{{gameId}}")],
    folder=F, test=t_status(401)))
add("Favorites/Remove Favorite - Signed Out.yml", request(
    "Remove Favorite - Signed Out", 5, "DELETE", f"{B}/api/favorites/:Id", params=[path("Id", "{{gameId}}")],
    folder=F, test=t_status(401)))
add("Favorites/Sign In.yml", sign_in("Sign In", 6, "runEmail", F))

add("Favorites/List Favorites - Empty.yml", request(
    "List Favorites - Empty", 7, "GET", f"{B}/api/favorites", auth=True, folder=F,
    test=tests(t_status(200), T_PAGED, """test('a new user has no favorites', () => {
  expect(res.body.totalCount).to.equal(0);
  expect(res.body.items).to.be.empty;
});""")))

ADD_BASE = "Favorites/Add Favorite.yml"
add(ADD_BASE, request(
    "Add Favorite", 8, "PUT", f"{B}/api/favorites/:Id", params=[path("Id", "{{gameId}}")], auth=True,
    base=ADD_BASE, test=t_status(201)))
add("Favorites/Add Favorite - Already Saved.yml", request(
    "Add Favorite - Already Saved", 9, "PUT", f"{B}/api/favorites/:Id", params=[path("Id", "{{gameId}}")],
    auth=True, folder=F, test=tests(t_status(201), "// Saving an existing favorite is safe and also returns 201.")))

IDS_BASE = "Favorites/List Favorite IDs.yml"
add(IDS_BASE, request(
    "List Favorite IDs", 10, "GET", f"{B}/api/favorites/ids", auth=True, base=IDS_BASE,
    test=tests(t_status(200), """test('contains the saved game exactly once', () => {
  const id = Number(bru.getEnvVar('gameId'));
  expect(res.body).to.be.an('array');
  expect(res.body.filter(x => x === id).length).to.equal(1);
});""")))

add("Favorites/Add Favorite - Second Game.yml", request(
    "Add Favorite - Second Game", 11, "PUT", f"{B}/api/favorites/:Id",
    params=[path("Id", "{{nonSteamGameId}}")], auth=True, folder=F, test=t_status(201)))

LIST_BASE = "Favorites/List Favorites.yml"
add(LIST_BASE, request(
    "List Favorites", 12, "GET", f"{B}/api/favorites", params=[q("page", 1), q("pageSize", 20)], auth=True,
    base=LIST_BASE, test=tests(t_status(200), T_PAGED, T_GAME_SUMMARY, """test('contains both saved games', () => {
  expect(res.body.totalCount).to.equal(2);
});

test('newest first', () => {
  expect(res.body.items[0].id).to.equal(Number(bru.getEnvVar('nonSteamGameId')));
  expect(res.body.items[1].id).to.equal(Number(bru.getEnvVar('gameId')));
});""")))
add("Favorites/List Favorites - Paged.yml", request(
    "List Favorites - Paged", 13, "GET", f"{B}/api/favorites", params=[q("page", 2), q("pageSize", 1)],
    auth=True, folder=F, test=tests(t_status(200), T_PAGED, """test('second page of one holds the older game', () => {
  expect(res.body.page).to.equal(2);
  expect(res.body.items.length).to.equal(1);
  expect(res.body.totalPages).to.equal(2);
  expect(res.body.items[0].id).to.equal(Number(bru.getEnvVar('gameId')));
});""")))

add("Favorites/Add Favorite - Unknown Game.yml", request(
    "Add Favorite - Unknown Game", 14, "PUT", f"{B}/api/favorites/:Id",
    params=[path("Id", "{{unknownGameId}}")], auth=True, folder=F, test=t_status(404)))
add("Favorites/Add Favorite - Invalid ID.yml", request(
    "Add Favorite - Invalid ID", 15, "PUT", f"{B}/api/favorites/:Id", params=[path("Id", "0")],
    auth=True, folder=F, test=t_status(404)))

REMOVE_BASE = "Favorites/Remove Favorite.yml"
add(REMOVE_BASE, request(
    "Remove Favorite", 16, "DELETE", f"{B}/api/favorites/:Id", params=[path("Id", "{{nonSteamGameId}}")],
    auth=True, base=REMOVE_BASE, test=t_status(204)))
add("Favorites/Remove Favorite - Not Saved.yml", request(
    "Remove Favorite - Not Saved", 17, "DELETE", f"{B}/api/favorites/:Id",
    params=[path("Id", "{{nonSteamGameId}}")], auth=True, folder=F,
    test=tests(t_status(204), "// Removing a game that isn't saved is not an error.")))
add("Favorites/List Favorite IDs - After Remove.yml", request(
    "List Favorite IDs - After Remove", 18, "GET", f"{B}/api/favorites/ids", auth=True, folder=F,
    test=tests(t_status(200), """test('only the first game is left', () => {
  expect(res.body).to.deep.equal([Number(bru.getEnvVar('gameId'))]);
});""")))

# ---------- Teardown
T = "Teardown"
add("Teardown/folder.yml", {
    "info": {"name": "Teardown", "type": "folder", "seq": 6},
    "request": {"auth": "inherit"},
    "docs": {"content": "Deletes every account the test run created. Also tests Delete Account.", "type": "text/markdown"},
})
DEL_BASE = "Auth/Delete Account.yml"


def delete(name, seq, test, auth=True, base=None, after=CLEAR_COOKIE):
    return request(name, seq, "DELETE", f"{B}/api/auth/delete-account", auth=auth, test=test,
                   after=after, base=base, folder=T)


add("Teardown/Delete Account.yml", delete("Delete Account", 1, t_status(204), base=DEL_BASE))
add("Teardown/Get Current User - After Delete.yml", me(
    "Get Current User - After Delete", 2, t_status(401), auth=False, folder=T))
add("Teardown/Login - Deleted Account.yml", login(
    "Login - Deleted Account", 3, {"email": "{{runEmail}}", "password": "{{password}}"}, t_status(401), folder=T))
add("Teardown/Sign In (second user).yml", sign_in("Sign In (second user)", 4, "runEmail2", T))
add("Teardown/Delete Account (second user).yml", delete("Delete Account (second user)", 5, t_status(204)))
add("Teardown/Sign In (third user).yml", sign_in("Sign In (third user)", 6, "runEmail3", T))
add("Teardown/Delete Account (third user).yml", delete("Delete Account (third user)", 7, t_status(204)))
add("Teardown/Delete Account - Signed Out.yml", delete(
    "Delete Account - Signed Out", 8, t_status(401), auth=False, after=None))

# ---------- folder order
for folder, seq in [("Health", 1), ("Games", 2), ("Prices", 3), ("Auth", 4), ("Favorites", 5)]:
    rel = f"{folder}/folder.yml"
    data = load(os.path.join(ROOT, rel))
    data["info"]["seq"] = seq
    add(rel, data)

# ---------- environment
env_rel = "environments/Development.yml"
env = load(os.path.join(ROOT, env_rel))
names = {v["name"] for v in env["variables"]}
for name, value in [("nonSteamGameId", "7346"), ("unknownGameId", "999999999")]:
    if name not in names:
        env["variables"].append({"name": name, "value": value})
add(env_rel, env)

# ---------- write
for rel in REMOVE:
    p = os.path.join(ROOT, rel)
    if os.path.exists(p):
        os.remove(p)
for rel, data in OUT.items():
    dump(os.path.join(ROOT, rel), data)

print(f"wrote {len(OUT)} files, removed {len(REMOVE)}")
