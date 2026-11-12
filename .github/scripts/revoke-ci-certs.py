# Trekt ontwikkelcertificaten in die een eerdere TestFlight-build via de API heeft aangemaakt.
# De privésleutel blijft op de weggegooide GitHub-runner achter, dus zo'n certificaat is daarna onbruikbaar.
# Apple weigert een nieuw certificaat zodra het maximum bereikt is. Eigen certificaten (niet "Created via API") blijven staan.
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

API = 'https://api.appstoreconnect.apple.com/v1/certificates'


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def der_to_raw(sig):
    # OpenSSL levert een ECDSA-handtekening als ASN.1. JWT wil R en S achter elkaar, elk 32 bytes.
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


def request(tok, url, method='GET'):
    req = urllib.request.Request(url, method=method, headers={'Authorization': f'Bearer {tok}'})
    try:
        with urllib.request.urlopen(req) as res:
            body = res.read()
            return res.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def subject_of(content_b64):
    if not content_b64:
        return ''
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'cert.der')
        with open(path, 'wb') as f:
            f.write(base64.b64decode(content_b64))
        out = subprocess.check_output(['openssl', 'x509', '-inform', 'DER', '-noout', '-subject', '-in', path], text=True)
    return out.strip()


def main():
    tok = token()
    status, body = request(tok, API + '?limit=200')
    if status != 200:
        print(f'::warning::Certificaten ophalen lukte niet ({status}). Het archief probeert het daarna zelf.')
        print(body.decode()[:500])
        return
    revoked = 0
    for cert in json.loads(body).get('data', []):
        attrs = cert.get('attributes') or {}
        kind = attrs.get('certificateType') or ''
        name = attrs.get('name') or ''
        subject = ''
        if kind in ('DEVELOPMENT', 'IOS_DEVELOPMENT'):
            subject = subject_of(attrs.get('certificateContent'))
        print(f'{kind}  {name}  {attrs.get("expirationDate") or ""}  {subject}')
        blob = f'{name}\n{subject}'
        if kind in ('DEVELOPMENT', 'IOS_DEVELOPMENT') and 'Created via API' in blob:
            code, err = request(tok, f'{API}/{cert["id"]}', 'DELETE')
            if code in (200, 204):
                revoked += 1
                print(f'ingetrokken: {cert["id"]}')
            else:
                print(f'::warning::Intrekken van {cert["id"]} lukte niet ({code}).')
                print(err.decode()[:300])
    print(f'{revoked} CI-certificaat(en) ingetrokken.')


if __name__ == '__main__':
    main()
