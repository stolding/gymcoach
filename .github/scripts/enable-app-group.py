# Zet de App Group op de twee App ID's van GymCoach Sync, en gooit oude profielen weg
# die de groep nog niet kennen. Xcode maakt bij het archief daarna een nieuw profiel.
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

API = 'https://api.appstoreconnect.apple.com'
GROUP = 'group.com.stolding.gymcoachsync'
BUNDLES = ('com.stolding.gymcoachsync', 'com.stolding.gymcoachsync.widgets')


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def der_to_raw(sig):
    if sig[0] != 0x30:
        raise ValueError('geen DER-handtekening')
    i = 2
    if sig[i] != 0x02:
        raise ValueError('geen R')
    i += 1
    lr = sig[i]
    i += 1
    r = sig[i:i + lr]
    i += lr
    if sig[i] != 0x02:
        raise ValueError('geen S')
    i += 1
    ls = sig[i]
    i += 1
    s = sig[i:i + ls]
    return r[-32:].rjust(32, b'\x00') + s[-32:].rjust(32, b'\x00')


def token():
    now = int(time.time())
    header = b64url(json.dumps({'alg': 'ES256', 'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'}, separators=(',', ':')).encode())
    payload = b64url(json.dumps({
        'iss': os.environ['ASC_ISSUER_ID'],
        'iat': now,
        'exp': now + 600,
        'aud': 'appstoreconnect-v1',
    }, separators=(',', ':')).encode())
    signing = f'{header}.{payload}'.encode()
    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, 'in')
        out = os.path.join(tmp, 'sig')
        with open(inp, 'wb') as f:
            f.write(signing)
        subprocess.check_call(['openssl', 'dgst', '-sha256', '-sign', os.environ['ASC_KEY_PATH'], '-out', out, inp], stdout=subprocess.DEVNULL)
        with open(out, 'rb') as f:
            sig = der_to_raw(f.read())
    return f'{header}.{payload}.{b64url(sig)}'


def request(tok, url, method='GET', payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {'Authorization': f'Bearer {tok}'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def bundle_id(tok, identifier):
    status, body = request(tok, f'{API}/v1/bundleIds?filter[identifier]={identifier}&limit=5')
    if status != 200:
        print(f'::warning::App ID {identifier} ophalen lukte niet ({status}).')
        print(body.decode()[:400])
        return None
    rows = json.loads(body).get('data') or []
    return rows[0] if rows else None


def ensure_capability(tok, bid):
    status, body = request(tok, f'{API}/v1/bundleIds/{bid}/bundleIdCapabilities?limit=50')
    if status == 200:
        for cap in json.loads(body).get('data') or []:
            if (cap.get('attributes') or {}).get('capabilityType') == 'APP_GROUPS':
                print(f'APP_GROUPS staat al op {bid}')
                return
    code, err = request(tok, f'{API}/v1/bundleIdCapabilities', 'POST', {
        'data': {
            'type': 'bundleIdCapabilities',
            'attributes': {'capabilityType': 'APP_GROUPS'},
            'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}}},
        },
    })
    if code in (200, 201):
        print(f'APP_GROUPS aangezet op {bid}')
    elif code == 409:
        print(f'APP_GROUPS stond al op {bid}')
    else:
        print(f'::warning::APP_GROUPS op {bid} lukte niet ({code}). Zet {GROUP} zelf aan in developer.apple.com.')
        print(err.decode()[:400])


def drop_profiles(tok, identifier):
    status, body = request(tok, f'{API}/v1/profiles?limit=200')
    if status != 200:
        print(f'::warning::Profielen ophalen lukte niet ({status}).')
        return
    for profile in json.loads(body).get('data') or []:
        name = (profile.get('attributes') or {}).get('name') or ''
        if identifier not in name:
            continue
        code, err = request(tok, f'{API}/v1/profiles/{profile["id"]}', 'DELETE')
        if code in (200, 204):
            print(f'profiel weg: {name}')
        else:
            print(f'::warning::Profiel {name} verwijderen lukte niet ({code}).')
            print(err.decode()[:200])


def main():
    tok = token()
    print(f'App Group die in de entitlements staat: {GROUP}')
    for identifier in BUNDLES:
        row = bundle_id(tok, identifier)
        if not row:
            print(f'::warning::Geen App ID {identifier}. Xcode maakt die bij het archief.')
            continue
        print(f'{identifier} → {row["id"]}')
        ensure_capability(tok, row['id'])
        drop_profiles(tok, identifier)


if __name__ == '__main__':
    main()
